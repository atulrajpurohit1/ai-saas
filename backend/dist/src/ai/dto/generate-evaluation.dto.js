"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateEvaluationDto = exports.VendorSubmissionSummaryDto = void 0;
class VendorSubmissionSummaryDto {
    companyName;
    contactPerson;
    servicesOffered;
    submittedDocuments;
    missingDocuments;
    notes;
    proposalExcerpt;
    pricingExcerpt;
    submittedAt;
}
exports.VendorSubmissionSummaryDto = VendorSubmissionSummaryDto;
class GenerateEvaluationDto {
    rfpTitle;
    clientName;
    industry;
    securityTypes;
    numberOfLocations;
    guardsRequired;
    estimatedBudget;
    additionalRequirements;
    vendors;
}
exports.GenerateEvaluationDto = GenerateEvaluationDto;
//# sourceMappingURL=generate-evaluation.dto.js.map