"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VENDOR_UPLOAD_ALLOWED_EXTENSIONS = exports.VENDOR_UPLOAD_DIR = void 0;
exports.ensureVendorUploadDir = ensureVendorUploadDir;
exports.sanitizeFilename = sanitizeFilename;
exports.vendorUploadMaxMb = vendorUploadMaxMb;
exports.vendorUploadMaxBytes = vendorUploadMaxBytes;
const fs_1 = require("fs");
const path_1 = require("path");
exports.VENDOR_UPLOAD_DIR = (0, path_1.join)(process.cwd(), 'uploads', 'vendor-submissions');
function ensureVendorUploadDir() {
    if (!(0, fs_1.existsSync)(exports.VENDOR_UPLOAD_DIR)) {
        (0, fs_1.mkdirSync)(exports.VENDOR_UPLOAD_DIR, { recursive: true });
    }
    return exports.VENDOR_UPLOAD_DIR;
}
function sanitizeFilename(originalName) {
    const baseName = originalName.split(/[/\\]/).pop() || 'file';
    const cleaned = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return cleaned.slice(-150) || 'file';
}
exports.VENDOR_UPLOAD_ALLOWED_EXTENSIONS = /\.(pdf|docx|xlsx|zip)$/i;
function vendorUploadMaxMb() {
    const parsed = Number(process.env.VENDOR_UPLOAD_MAX_MB || 20);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}
function vendorUploadMaxBytes() {
    return vendorUploadMaxMb() * 1024 * 1024;
}
//# sourceMappingURL=file-storage.util.js.map