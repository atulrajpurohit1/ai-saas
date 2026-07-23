export declare const VENDOR_STATUSES: readonly ["ACTIVE", "INACTIVE"];
export type VendorStatusValue = (typeof VENDOR_STATUSES)[number];
export declare class CreateVendorDto {
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    services?: string[];
    notes?: string;
    status?: VendorStatusValue;
}
