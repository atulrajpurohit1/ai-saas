export declare class VendorSubmissionSummaryDto {
    companyName: string;
    contactPerson?: string | null;
    servicesOffered: string[];
    submittedDocuments: string[];
    missingDocuments: string[];
    notes?: string | null;
    proposalExcerpt?: string | null;
    pricingExcerpt?: string | null;
    submittedAt: string | null;
}
export declare class GenerateEvaluationDto {
    rfpTitle: string;
    clientName: string;
    industry?: string | null;
    securityTypes: string[];
    numberOfLocations?: number | null;
    guardsRequired?: number | null;
    estimatedBudget?: number | null;
    additionalRequirements?: string | null;
    vendors: VendorSubmissionSummaryDto[];
}
