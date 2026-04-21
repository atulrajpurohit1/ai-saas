export class CreateProposalDto {
  title: string;
  content: string;
  status?: string;
  leadId?: string;
  dealId?: string;
}
