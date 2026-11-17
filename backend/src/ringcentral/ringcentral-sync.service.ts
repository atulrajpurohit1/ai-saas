import { Injectable, Logger } from '@nestjs/common';
import { TelephonyConnection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber } from '../calls/phone.util';
import { RingCentralClientService } from './ringcentral-client.service';
import { RingCentralConnectionService } from './ringcentral-connection.service';

/** RingCentral's party status for a call that has ended. */
const DISCONNECTED = 'Disconnected';

/**
 * How RingCentral's call-log `result` maps onto the outcome vocabulary
 * CallRecord already uses (dialed | connected | no_answer | voicemail |
 * wrong_number | failed).
 *
 * RingCentral does not publish the full enumeration of `result`, so this is a
 * best-effort map over the values their docs and payloads show. Anything
 * unrecognised falls through to a conservative default rather than being
 * guessed at -- a call wrongly marked "connected" corrupts the rep's own
 * follow-up list.
 */
const RESULT_TO_OUTCOME: Record<string, string> = {
  Accepted: 'connected',
  'Call connected': 'connected',
  Completed: 'connected',
  Missed: 'no_answer',
  'No Answer': 'no_answer',
  Voicemail: 'voicemail',
  'Voice Mail': 'voicemail',
  Busy: 'failed',
  Rejected: 'failed',
  'Call Failed': 'failed',
  'Call Fail': 'failed',
  Unknown: 'dialed',
};

interface TelephonyParty {
  direction?: string;
  to?: { phoneNumber?: string; extensionId?: string };
  from?: { phoneNumber?: string; extensionId?: string };
  status?: { code?: string };
  missedCall?: boolean;
}

interface TelephonyEvent {
  body?: {
    telephonySessionId?: string;
    sessionId?: string;
    eventTime?: string;
    accountId?: string;
    parties?: TelephonyParty[];
  };
}

interface CallLogRecord {
  id?: string;
  telephonySessionId?: string;
  sessionId?: string;
  startTime?: string;
  duration?: number;
  type?: string;
  direction?: string;
  result?: string;
  to?: { phoneNumber?: string };
  from?: { phoneNumber?: string };
  recording?: { id?: string; contentUri?: string };
}

/**
 * Turns RingCentral call activity into CallRecord rows.
 *
 * Split into two phases on purpose:
 *
 *   ingest      - synchronous, from the webhook. Writes what the event knows
 *                 (which number, which direction, that a call happened) and
 *                 nothing more.
 *   reconcile   - asynchronous, from the scheduler. Fills in duration, result
 *                 and the recording by reading the call log.
 *
 * The split exists because telephony events carry NO duration and NO result --
 * those live only in the call log, which RingCentral populates with "a small
 * latency" after the call ends. Reading the log inline from the webhook would
 * mean either blocking the handler on a sleep or reading it too early and
 * getting nothing.
 */
@Injectable()
export class RingCentralSyncService {
  private readonly logger = new Logger(RingCentralSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: RingCentralClientService,
    private readonly connections: RingCentralConnectionService,
  ) {}

  connectionForSecret(secret: string) {
    return this.connections.findByWebhookSecret(secret);
  }

  /**
   * Records that a call happened.
   *
   * Idempotent by construction: the same telephony session arrives several
   * times (one event per party, plus retries), and the unique index on
   * (tenantId, externalSessionId) turns every repeat into an update of the
   * same row rather than a duplicate entry in the rep's call log.
   */
  async ingestTelephonyEvent(connection: TelephonyConnection, payload: unknown) {
    const event = payload as TelephonyEvent;
    const sessionId = event?.body?.telephonySessionId || event?.body?.sessionId;
    if (!sessionId) return { ignored: 'no-session-id' };

    const parties = event.body?.parties || [];
    // Only act once the call is over. Mid-call events (Proceeding, Answered)
    // would otherwise each write a row that the final event rewrites, and the
    // call log has nothing to say about a call still in progress.
    const ended = parties.some((party) => party.status?.code === DISCONNECTED);
    if (!ended) return { ignored: 'call-in-progress' };

    const details = this.extractParty(parties);
    if (!details.phoneNumber) return { ignored: 'no-counterparty-number' };

    const existing = await this.prisma.callRecord.findFirst({
      where: { tenantId: connection.tenantId, externalSessionId: sessionId },
      select: { id: true },
    });
    if (existing) return { ignored: 'already-recorded', callId: existing.id };

    const match = await this.matchLeadOrDeal(connection.tenantId, details.phoneNumber);

    const call = await this.prisma.callRecord.create({
      data: {
        tenantId: connection.tenantId,
        externalSessionId: sessionId,
        source: 'ringcentral',
        phoneNumber: details.phoneNumber,
        direction: details.direction,
        // Not "connected": the event does not say whether anyone answered.
        // Reconciliation settles it from the call log a few minutes later.
        outcome: details.missed ? 'no_answer' : 'dialed',
        leadId: match.leadId,
        dealId: match.dealId,
      },
    });

    await this.prisma.telephonyConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });

    return { callId: call.id, created: true };
  }

  /**
   * Fills in duration, outcome and the recording reference for calls ingested
   * but not yet reconciled.
   *
   * One call-log read covers every pending call in the window, rather than one
   * read per call: RingCentral throttles by rate-limit group, and a tenant
   * with a busy afternoon would otherwise burn the budget on near-identical
   * requests.
   */
  async reconcileTenant(connection: TelephonyConnection, now = new Date()) {
    const pending = await this.prisma.callRecord.findMany({
      where: {
        tenantId: connection.tenantId,
        source: 'ringcentral',
        durationSec: null,
        // Give RingCentral time to populate the log, and stop retrying calls
        // old enough that the record is never going to appear.
        createdAt: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(now.getTime() - 2 * 60 * 1000),
        },
      },
      select: { id: true, externalSessionId: true, createdAt: true },
      take: 200,
    });

    if (pending.length === 0) return { reconciled: 0, pending: 0 };

    const oldest = pending.reduce(
      (earliest, row) => (row.createdAt < earliest ? row.createdAt : earliest),
      pending[0].createdAt,
    );

    const records = await this.fetchCallLog(connection, oldest);
    const bySession = new Map<string, CallLogRecord>();
    for (const record of records) {
      const key = record.telephonySessionId || record.sessionId;
      if (key) bySession.set(key, record);
    }

    let reconciled = 0;
    for (const row of pending) {
      const record = row.externalSessionId
        ? bySession.get(row.externalSessionId)
        : undefined;
      if (!record) continue;

      await this.prisma.callRecord.update({
        where: { id: row.id },
        data: {
          durationSec: typeof record.duration === 'number' ? record.duration : null,
          outcome: this.mapOutcome(record.result),
          externalRecordingId: record.recording?.id || null,
        },
      });
      reconciled += 1;
    }

    return { reconciled, pending: pending.length - reconciled };
  }

  /** Call-log records for everything since `since`, with recordings included. */
  private async fetchCallLog(
    connection: TelephonyConnection,
    since: Date,
  ): Promise<CallLogRecord[]> {
    const params = new URLSearchParams({
      dateFrom: since.toISOString(),
      recordingType: 'All',
      view: 'Detailed',
      perPage: '250',
    });

    const response = await this.client.request<{ records?: CallLogRecord[] }>(
      connection.id,
      this.connections.credentialOf(connection),
      `/restapi/v1.0/account/~/call-log?${params.toString()}`,
    );

    return response.records || [];
  }

  /**
   * Picks the counterparty number and the call's direction out of the party
   * list.
   *
   * A session has one party per participant. The one carrying an extensionId
   * is ours; the number on the other side of it is the customer's, and which
   * side that is flips with the direction.
   */
  private extractParty(parties: TelephonyParty[]) {
    const ended =
      parties.find((party) => party.status?.code === DISCONNECTED) || parties[0];

    const direction = (ended?.direction || '').toLowerCase() === 'inbound'
      ? 'inbound'
      : 'outbound';

    const counterparty =
      direction === 'inbound' ? ended?.from?.phoneNumber : ended?.to?.phoneNumber;

    return {
      direction,
      missed: Boolean(ended?.missedCall),
      phoneNumber: this.normalize(counterparty),
    };
  }

  /** RingCentral already sends E.164, but a blocked or internal call can send
   *  something else entirely; those are stored as-is rather than rejected. */
  private normalize(raw?: string): string | null {
    if (!raw || !raw.trim()) return null;
    try {
      return normalizePhoneNumber(raw, process.env.DEFAULT_PHONE_COUNTRY_CODE);
    } catch {
      return raw.trim();
    }
  }

  private mapOutcome(result?: string): string {
    if (!result) return 'dialed';
    return RESULT_TO_OUTCOME[result] || 'dialed';
  }

  /**
   * Finds the lead or deal this number belongs to.
   *
   * Matched on the last 9 digits rather than the whole string because the two
   * sides are written differently: RingCentral sends strict E.164, while
   * Lead.phone holds whatever a rep typed ("(415) 555-1234", "+1 415 555
   * 1234", "00 1 415..."). Comparing raw strings would match almost nothing.
   *
   * The digits are stripped in SQL rather than in memory so this stays one
   * indexed-table scan instead of loading every lead the tenant owns. The
   * suffix is parameterised -- it is derived from an inbound webhook payload
   * and must never be concatenated into the statement.
   */
  private async matchLeadOrDeal(tenantId: string, phoneNumber: string) {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 7) return { leadId: null, dealId: null };

    const suffix = digits.slice(-9);

    const leads = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Lead"
      WHERE "tenantId" = ${tenantId}
        AND "phone" IS NOT NULL
        AND regexp_replace("phone", '[^0-9]', '', 'g') LIKE ${'%' + suffix}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;

    const leadId = leads[0]?.id || null;
    if (!leadId) return { leadId: null, dealId: null };

    // Attach the lead's most recent open deal too, so the call lands on the
    // deal timeline a rep is actually looking at rather than only the lead.
    const deal = await this.prisma.deal.findFirst({
      where: { tenantId, leadId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    return { leadId, dealId: deal?.id || null };
  }
}
