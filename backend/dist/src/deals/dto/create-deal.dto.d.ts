export declare enum DealStage {
    NEW = "New",
    CONTACTED = "Contacted",
    PROPOSAL = "Proposal",
    WON = "Won",
    LOST = "Lost"
}
export declare class CreateDealDto {
    name: string;
    leadId: string;
    stage?: DealStage;
}
