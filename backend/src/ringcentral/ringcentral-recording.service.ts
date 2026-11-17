import { Injectable, Logger } from '@nestjs/common';
import { TelephonyConnection } from '@prisma/client';
import { randomBytes } from 'crypto';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  CALL_RECORDING_UPLOAD_DIR,
  callRecordingUploadMaxBytes,
  ensureCallRecordingUploadDir,
} from '../common/file-storage.util';
import { persistUpload } from '../common/object-storage.util';
import {
  RingCentralApiError,
  RingCentralClientService,
} from './ringcentral-client.service';
import { RingCentralConnectionService } from './ringcentral-connection.service';
import { ringcentralServerUrl } from './ringcentral.config';

/**
 * RingCentral serves call recordings as MP3. The content-type header is
 * trusted when it looks like audio and this is used otherwise, because the
 * stored mime type is what the playback endpoint later sends to the browser.
 */
const DEFAULT_MIME_TYPE = 'audio/mpeg';

/**
 * Pulls call recordings out of RingCentral and attaches them to the call.
 *
 * Deliberately does NOT kick off transcription. Transcription is metered
 * against the tenant's AI credits, and auto-transcribing every recorded call
 * would spend a customer's balance on calls nobody asked about -- a surprise
 * bill is a worse failure than an extra click. The recording lands on the call
 * and the existing rep-triggered transcribe -> coach flow picks it up
 * unchanged.
 */
@Injectable()
export class RingCentralRecordingService {
  private readonly logger = new Logger(RingCentralRecordingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: RingCentralClientService,
    private readonly connections: RingCentralConnectionService,
  ) {}

  /**
   * Downloads recordings for calls that have one but have not fetched it yet.
   *
   * Bounded by the same 24-hour window the reconciliation sweep uses. That
   * doubles as the give-up rule: RingCentral does not retain recordings under
   * 30 seconds, so some calls will carry a recording id whose content 404s
   * forever, and without a window the sweep would retry them indefinitely.
   */
  async downloadPending(connection: TelephonyConnection, now = new Date()) {
    const pending = await this.prisma.callRecord.findMany({
      where: {
        tenantId: connection.tenantId,
        source: 'ringcentral',
        externalRecordingId: { not: null },
        recordingStoredFileName: null,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true, externalRecordingId: true },
      take: 25,
    });

    let downloaded = 0;
    for (const call of pending) {
      try {
        await this.downloadOne(connection, call.id, call.externalRecordingId!);
        downloaded += 1;
      } catch (error) {
        if (error instanceof RingCentralApiError && error.status === 404) {
          // Expected for calls under 30 seconds, which RingCentral discards.
          // Not an error worth alarming anyone about.
          this.logger.debug(
            `No recording content for call ${call.id}; likely too short to retain.`,
          );
          continue;
        }
        this.logger.warn(
          `Could not download recording for call ${call.id}: ` +
            (error instanceof Error ? error.message : 'unknown error'),
        );
      }
    }

    return { downloaded, pending: pending.length - downloaded };
  }

  private async downloadOne(
    connection: TelephonyConnection,
    callId: string,
    recordingId: string,
  ) {
    // Built from the account-scoped path rather than the contentUri the call
    // log returns. Both work, but the call log's URI points at a different
    // host (media.ringcentral.com) and storing it would mean a URL captured
    // today has to still resolve whenever the sweep gets to it.
    const contentUri =
      `${ringcentralServerUrl()}/restapi/v1.0/account/~/recording/` +
      `${encodeURIComponent(recordingId)}/content`;

    const { buffer, contentType } = await this.client.downloadContent(
      connection.id,
      this.connections.credentialOf(connection),
      contentUri,
    );

    if (buffer.length === 0) {
      throw new Error('RingCentral returned an empty recording');
    }

    // The same ceiling the manual upload path enforces. A recording past it
    // cannot be transcribed anyway, and writing it would fill the disk for
    // nothing.
    const maxBytes = callRecordingUploadMaxBytes();
    if (buffer.length > maxBytes) {
      throw new Error(
        `Recording is ${Math.round(buffer.length / 1024 / 1024)}MB, over the ` +
          `${Math.round(maxBytes / 1024 / 1024)}MB limit`,
      );
    }

    // Name follows the manual upload convention: unpredictable prefix, no
    // user-supplied component at all, so nothing here can traverse a path.
    const storedFileName = `${Date.now()}-${randomBytes(6).toString(
      'hex',
    )}-ringcentral-${recordingId}.mp3`;

    const dir = ensureCallRecordingUploadDir();
    const filePath = join(dir, storedFileName);
    writeFileSync(filePath, buffer);

    try {
      // Into durable storage before the row points at it, matching
      // CallsService.attachRecording -- a row referencing a file that was
      // never uploaded is worse than no row at all.
      await persistUpload(CALL_RECORDING_UPLOAD_DIR, storedFileName);

      await this.prisma.callRecord.update({
        where: { id: callId },
        data: {
          recordingFileName: `ringcentral-${recordingId}.mp3`,
          recordingStoredFileName: storedFileName,
          recordingMimeType: this.resolveMimeType(contentType),
          recordingSizeBytes: buffer.length,
          recordedAt: new Date(),
        },
      });
    } catch (error) {
      // Leave no orphan on disk if the row could not be written.
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch {
          // Best effort.
        }
      }
      throw error;
    }
  }

  private resolveMimeType(contentType: string | null): string {
    const normalized = (contentType || '').toLowerCase().split(';')[0].trim();
    if (normalized.startsWith('audio/') || normalized.startsWith('video/')) {
      return normalized;
    }
    return DEFAULT_MIME_TYPE;
  }
}
