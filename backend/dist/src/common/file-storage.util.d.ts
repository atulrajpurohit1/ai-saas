export declare const VENDOR_UPLOAD_DIR: string;
export declare function ensureVendorUploadDir(): string;
export declare function sanitizeFilename(originalName: string): string;
export declare const VENDOR_UPLOAD_ALLOWED_EXTENSIONS: RegExp;
export declare function vendorUploadMaxMb(): number;
export declare function vendorUploadMaxBytes(): number;
