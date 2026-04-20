export declare enum LeadStatus {
    NEW = "new",
    CONTACTED = "contacted",
    PROPOSAL_SENT = "proposal_sent",
    RESPONDED = "responded",
    CLOSED = "closed"
}
export declare class UpdateLeadStatusDto {
    status: LeadStatus;
}
