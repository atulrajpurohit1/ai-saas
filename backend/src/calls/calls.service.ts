import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CallRecord } from '@prisma/client';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CALL_RECORDING_UPLOAD_DIR,
  isAllowedCallRecording,
} from '../common/file-storage.util';
import {
  openStoredFile,
  persistUpload,
  removeStoredFile,
} from '../common/object-storage.util';
import { LogCallDto } from './dto/log-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { normalizePhoneNumber } from './phone.util';

/**
 * The on-disk / bucket name of a recording is an internal storage detail; a
 * client only needs to know a recording exists and fetches it by call id.
 */
function toPublicCall<T extends Partial<CallRecord>>(call: T) {
  const { recordingStoredFileName, ...rest } = call;
  return { ...rest, hasRecording: Boolean(recordingStoredFileName) };
}

function removeLocalUpload(file: Express.Multer.File) {
  try {
    if (file.path && existsSync(file.path)) unlinkSync(file.path);
  } catch {
    // Best-effort cleanup of a rejected upload.
  }
}

@Injectable()
export class CallsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Records that a rep initiated a dial. Called the moment the tel: link opens,
   * not when the call ends -- the app never learns whether it connected, so the
   * row starts at outcome "dialed" and the rep settles it afterwards.
   */
  async logCall(dto: LogCallDto, tenantId: string, userId?: string) {
    const phoneNumber = normalizePhoneNumber(
      dto.phoneNumber,
      process.env.DEFAULT_PHONE_COUNTRY_CODE,
    );

    // Ownership check before writing: a leadId from another tenant must not be
    // attachable to this tenant's call record.
    if (dto.leadId) await this.assertLead(dto.leadId, tenantId);
    if (dto.dealId) await this.assertDeal(dto.dealId, tenantId);

    const call = await this.prisma.callRecord.create({
      data: {
        tenantId,
        leadId: dto.leadId || null,
        dealId: dto.dealId || null,
        phoneNumber,
        outcome: dto.outcome || 'dialed',
        durationSec: dto.durationSec ?? null,
        notes: dto.notes || null,
        createdBy: userId || null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'CALL',
      entityId: call.id,
      details: `Dialed ${phoneNumber}`,
    });

    return toPublicCall(call);
  }

  async findAll(
    tenantId: string,
    filters: {
      leadId?: string;
      dealId?: string;
      limit?: number;
      hasRecording?: boolean;
    } = {},
  ) {
    const calls = await this.prisma.callRecord.findMany({
      where: {
        tenantId,
        ...(filters.leadId ? { leadId: filters.leadId } : {}),
        ...(filters.dealId ? { dealId: filters.dealId } : {}),
        ...(filters.hasRecording
          ? { recordingStoredFileName: { not: null } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 50, 200),
      include: {
        lead: { select: { id: true, name: true, company: true } },
        deal: { select: { id: true, name: true } },
      },
    });
    return calls.map(toPublicCall);
  }

  async findOne(id: string, tenantId: string) {
    return toPublicCall(await this.findOwned(id, tenantId));
  }

  /** Tenant-scoped lookup that keeps the storage fields, for internal use. */
  private async findOwned(id: string, tenantId: string) {
    const call = await this.prisma.callRecord.findFirst({
      where: { id, tenantId },
      include: {
        lead: { select: { id: true, name: true, company: true } },
        deal: { select: { id: true, name: true } },
      },
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async update(
    id: string,
    dto: UpdateCallDto,
    tenantId: string,
    userId?: string,
  ) {
    await this.findOwned(id, tenantId);

    const call = await this.prisma.callRecord.update({
      where: { id },
      data: {
        ...(dto.outcome !== undefined ? { outcome: dto.outcome } : {}),
        ...(dto.durationSec !== undefined
          ? { durationSec: dto.durationSec }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.transcript !== undefined ? { transcript: dto.transcript } : {}),
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'CALL',
      entityId: call.id,
      details: `Updated call to ${call.phoneNumber} (${call.outcome})`,
    });

    return toPublicCall(call);
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const call = await this.findOwned(id, tenantId);
    await this.prisma.callRecord.delete({ where: { id } });
    if (call.recordingStoredFileName) {
      removeStoredFile(CALL_RECORDING_UPLOAD_DIR, call.recordingStoredFileName);
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'CALL',
      entityId: id,
      details: `Deleted call record for ${call.phoneNumber}`,
    });

    return { success: true };
  }

  /**
   * Attaches the audio recorded during a call. A second upload for the same
   * call replaces the first (the rep re-recorded, or the browser retried), and
   * the old file is removed so it does not linger unreferenced.
   */
  async attachRecording(
    id: string,
    file: Express.Multer.File,
    tenantId: string,
    userId?: string,
    durationSec?: number,
  ) {
    let previous: string | null;
    try {
      previous = (await this.findOwned(id, tenantId)).recordingStoredFileName;
      if (!isAllowedCallRecording(file.originalname, file.mimetype)) {
        throw new BadRequestException(
          'Unsupported recording type. Allowed: WebM, OGG, M4A, MP4, MP3, WAV.',
        );
      }
      if (!file.size) {
        throw new BadRequestException('The recording is empty.');
      }
    } catch (error) {
      removeLocalUpload(file);
      throw error;
    }

    // Into durable storage before the row points at it.
    await persistUpload(CALL_RECORDING_UPLOAD_DIR, file.filename);

    const call = await this.prisma.callRecord.update({
      where: { id },
      data: {
        recordingFileName: file.originalname,
        recordingStoredFileName: file.filename,
        recordingMimeType: file.mimetype,
        recordingSizeBytes: file.size,
        recordingDurationSec:
          durationSec !== undefined &&
          Number.isFinite(durationSec) &&
          durationSec >= 0
            ? Math.min(Math.round(durationSec), 86400)
            : null,
        recordedAt: new Date(),
      },
    });

    if (previous && previous !== file.filename) {
      removeStoredFile(CALL_RECORDING_UPLOAD_DIR, previous);
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CALL_RECORDING_UPLOADED',
      entityType: 'CALL',
      entityId: call.id,
      details: `Recording saved for call to ${call.phoneNumber}`,
    });

    return toPublicCall(call);
  }

  async getRecordingFile(id: string, tenantId: string) {
    const call = await this.findOwned(id, tenantId);
    if (!call.recordingStoredFileName) {
      throw new NotFoundException('This call has no recording');
    }

    const stream = await openStoredFile(
      CALL_RECORDING_UPLOAD_DIR,
      call.recordingStoredFileName,
    );
    if (!stream) {
      throw new NotFoundException('Recording file not found on server');
    }

    return {
      stream,
      mimeType: call.recordingMimeType,
      fileName: call.recordingFileName || 'call-recording',
      fileSizeBytes: call.recordingSizeBytes,
    };
  }

  private async assertLead(leadId: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
  }

  private async assertDeal(dealId: string, tenantId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      select: { id: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
  }
}
