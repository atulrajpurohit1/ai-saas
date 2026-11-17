import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber } from '../calls/phone.util';
import {
  RingCentralApiError,
  RingCentralClientService,
} from './ringcentral-client.service';
import { RingCentralConnectionService } from './ringcentral-connection.service';
import { DialDto } from './dto/dial.dto';

interface RingOutResponse {
  id?: string;
  status?: {
    callStatus?: string;
    callerStatus?: string;
    calleeStatus?: string;
  };
}

/**
 * Click-to-call via RingCentral RingOut.
 *
 * RingOut is a two-legged dial: RingCentral rings the REP's own phone first,
 * and only connects the customer once the rep picks up. That is why a callback
 * number is required and cannot be inferred -- the JWT credential belongs to
 * whichever admin created it, so dialling from "~" would ring that person's
 * desk for every rep in the company.
 */
@Injectable()
export class RingCentralDialService {
  private readonly logger = new Logger(RingCentralDialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: RingCentralClientService,
    private readonly connections: RingCentralConnectionService,
    private readonly auditService: AuditService,
  ) {}

  async dial(user: ActiveUser, dto: DialDto) {
    const connection = await this.connections.findForTenant(user.tenantId);
    if (!connection) {
      throw new NotFoundException(
        'RingCentral is not connected. Connect it on the Integrations page.',
      );
    }

    const defaultCountry = process.env.DEFAULT_PHONE_COUNTRY_CODE;
    const to = normalizePhoneNumber(dto.toNumber, defaultCountry);
    const from = normalizePhoneNumber(dto.fromNumber, defaultCountry);

    // Ownership check before dialling, not after: a leadId from another tenant
    // must not become attachable to this tenant's call record.
    if (dto.leadId) await this.assertLead(dto.leadId, user.tenantId);
    if (dto.dealId) await this.assertDeal(dto.dealId, user.tenantId);

    let response: RingOutResponse;
    try {
      response = await this.client.request<RingOutResponse>(
        connection.id,
        this.connections.credentialOf(connection),
        '/restapi/v1.0/account/~/extension/~/ring-out',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: { phoneNumber: from },
            to: { phoneNumber: to },
            // The "press 1 to connect" prompt. Off: the rep already knows they
            // asked for this call, and the prompt adds a step before the
            // customer's phone even starts ringing.
            playPrompt: false,
          }),
        },
      );
    } catch (error) {
      throw this.explain(error);
    }

    // The CallRecord is NOT created here. The telephony webhook creates it
    // when the call actually ends, keyed on the session id -- writing one now
    // would produce a duplicate that nothing can reconcile, because a RingOut
    // id is not a telephonySessionId.
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CALL_DIALED',
      entityType: 'CallRecord',
      entityId: response.id || undefined,
      details: `RingOut to ${to}`,
    });

    return {
      ringout_id: response.id || null,
      status: response.status?.callStatus || 'InProgress',
      to,
      from,
    };
  }

  /** Turns RingCentral's failure modes into something a rep can act on. */
  private explain(error: unknown) {
    if (error instanceof RingCentralApiError) {
      if (error.isPermissionFailure) {
        return new BadRequestException(
          'This RingCentral app is not permitted to place calls. The RingOut ' +
            'permission is missing.',
        );
      }
      if (error.isCredentialFailure) {
        return new BadRequestException(
          'The RingCentral connection has expired. Reconnect it on the ' +
            'Integrations page.',
        );
      }
    }
    return error;
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
