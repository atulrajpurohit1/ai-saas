import { PricingModelValue } from '../../rfp/dto/create-rfp.dto';
export declare class GenerateRfpDto {
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
    additionalRequirements?: string;
    pricingModel?: PricingModelValue;
    requiredPricingItems?: string[];
    paymentTerms?: string;
    pricingValidity?: string;
    pricingNotes?: string;
}
