import { IsEnum } from 'class-validator';

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  PROPOSAL_SENT = 'proposal_sent',
  RESPONDED = 'responded',
  CLOSED = 'closed',
}

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus, {
    message: 'Status must be one of: new, contacted, proposal_sent, responded, closed',
  })
  status: LeadStatus;
}
