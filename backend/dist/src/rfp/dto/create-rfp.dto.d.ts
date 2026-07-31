export declare const RFP_STATUSES: readonly ["DRAFT", "GENERATED", "FINALIZED"];
export type RfpStatusValue = (typeof RFP_STATUSES)[number];
export declare const PRICING_MODELS: readonly ["Hourly", "Monthly", "Annual", "Project Based"];
export type PricingModelValue = (typeof PRICING_MODELS)[number];
export declare class CreateRfpDto {
    title: string;
    clientName: string;
    companyName?: string;
    industry?: string;
    projectName?: string;
    dueDate?: string;
    startDate?: string;
    endDate?: string;
    estimatedBudget?: number;
    securityTypes?: string[];
    numberOfLocations?: number;
    address?: string;
    operatingHours?: string;
    guardsRequired?: number;
    pricingModel?: PricingModelValue;
    requiredPricingItems?: string[];
    paymentTerms?: string;
    pricingValidity?: string;
    pricingNotes?: string;
    additionalRequirements?: string;
    generatedContent?: string;
    status?: RfpStatusValue;
}
