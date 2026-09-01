"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_INSURANCE_ALLOWED_MIME_TYPES = exports.CLIENT_INSURANCE_UPLOAD_ALLOWED_EXTENSIONS = exports.CLIENT_INSURANCE_UPLOAD_DIR = exports.INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS = exports.INCIDENT_EVIDENCE_VIDEO_MIME_TYPES = exports.INCIDENT_EVIDENCE_IMAGE_MIME_TYPES = exports.INCIDENT_EVIDENCE_UPLOAD_DIR = exports.GUARD_COMPLIANCE_UPLOAD_ALLOWED_EXTENSIONS = exports.GUARD_COMPLIANCE_UPLOAD_DIR = exports.VENDOR_UPLOAD_ALLOWED_EXTENSIONS = exports.VENDOR_UPLOAD_DIR = void 0;
exports.ensureVendorUploadDir = ensureVendorUploadDir;
exports.sanitizeFilename = sanitizeFilename;
exports.vendorUploadMaxMb = vendorUploadMaxMb;
exports.vendorUploadMaxBytes = vendorUploadMaxBytes;
exports.ensureGuardComplianceUploadDir = ensureGuardComplianceUploadDir;
exports.guardComplianceUploadMaxMb = guardComplianceUploadMaxMb;
exports.guardComplianceUploadMaxBytes = guardComplianceUploadMaxBytes;
exports.ensureIncidentEvidenceUploadDir = ensureIncidentEvidenceUploadDir;
exports.classifyIncidentEvidence = classifyIncidentEvidence;
exports.incidentEvidenceImageMaxMb = incidentEvidenceImageMaxMb;
exports.incidentEvidenceVideoMaxMb = incidentEvidenceVideoMaxMb;
exports.incidentEvidenceImageMaxBytes = incidentEvidenceImageMaxBytes;
exports.incidentEvidenceVideoMaxBytes = incidentEvidenceVideoMaxBytes;
exports.incidentEvidenceUploadMaxBytes = incidentEvidenceUploadMaxBytes;
exports.incidentEvidenceMaxBytesFor = incidentEvidenceMaxBytesFor;
exports.ensureClientInsuranceUploadDir = ensureClientInsuranceUploadDir;
exports.isAllowedClientInsuranceDocument = isAllowedClientInsuranceDocument;
exports.clientInsuranceUploadMaxMb = clientInsuranceUploadMaxMb;
exports.clientInsuranceUploadMaxBytes = clientInsuranceUploadMaxBytes;
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
exports.GUARD_COMPLIANCE_UPLOAD_DIR = (0, path_1.join)(process.cwd(), 'uploads', 'guard-compliance');
function ensureGuardComplianceUploadDir() {
    if (!(0, fs_1.existsSync)(exports.GUARD_COMPLIANCE_UPLOAD_DIR)) {
        (0, fs_1.mkdirSync)(exports.GUARD_COMPLIANCE_UPLOAD_DIR, { recursive: true });
    }
    return exports.GUARD_COMPLIANCE_UPLOAD_DIR;
}
exports.GUARD_COMPLIANCE_UPLOAD_ALLOWED_EXTENSIONS = /\.(pdf|jpg|jpeg|png)$/i;
function guardComplianceUploadMaxMb() {
    const parsed = Number(process.env.GUARD_COMPLIANCE_UPLOAD_MAX_MB || 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}
function guardComplianceUploadMaxBytes() {
    return guardComplianceUploadMaxMb() * 1024 * 1024;
}
exports.INCIDENT_EVIDENCE_UPLOAD_DIR = (0, path_1.join)(process.cwd(), 'uploads', 'incident-evidence');
function ensureIncidentEvidenceUploadDir() {
    if (!(0, fs_1.existsSync)(exports.INCIDENT_EVIDENCE_UPLOAD_DIR)) {
        (0, fs_1.mkdirSync)(exports.INCIDENT_EVIDENCE_UPLOAD_DIR, { recursive: true });
    }
    return exports.INCIDENT_EVIDENCE_UPLOAD_DIR;
}
exports.INCIDENT_EVIDENCE_IMAGE_MIME_TYPES = {
    'image/jpeg': true,
    'image/png': true,
    'image/webp': true,
    'image/gif': true,
    'image/heic': true,
    'image/heif': true,
};
exports.INCIDENT_EVIDENCE_VIDEO_MIME_TYPES = {
    'video/mp4': true,
    'video/quicktime': true,
    'video/webm': true,
    'video/x-m4v': true,
};
exports.INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|gif|heic|heif|mp4|mov|m4v|webm)$/i;
function classifyIncidentEvidence(originalName, mimeType) {
    if (!exports.INCIDENT_EVIDENCE_ALLOWED_EXTENSIONS.test(originalName)) {
        return null;
    }
    const normalized = (mimeType || '').toLowerCase().split(';')[0].trim();
    if (exports.INCIDENT_EVIDENCE_IMAGE_MIME_TYPES[normalized]) {
        return 'image';
    }
    if (exports.INCIDENT_EVIDENCE_VIDEO_MIME_TYPES[normalized]) {
        return 'video';
    }
    return null;
}
function incidentEvidenceImageMaxMb() {
    const parsed = Number(process.env.INCIDENT_EVIDENCE_IMAGE_MAX_MB || 15);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}
function incidentEvidenceVideoMaxMb() {
    const parsed = Number(process.env.INCIDENT_EVIDENCE_VIDEO_MAX_MB || 100);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}
function incidentEvidenceImageMaxBytes() {
    return incidentEvidenceImageMaxMb() * 1024 * 1024;
}
function incidentEvidenceVideoMaxBytes() {
    return incidentEvidenceVideoMaxMb() * 1024 * 1024;
}
function incidentEvidenceUploadMaxBytes() {
    return Math.max(incidentEvidenceImageMaxBytes(), incidentEvidenceVideoMaxBytes());
}
function incidentEvidenceMaxBytesFor(mediaType) {
    return mediaType === 'image'
        ? incidentEvidenceImageMaxBytes()
        : incidentEvidenceVideoMaxBytes();
}
exports.CLIENT_INSURANCE_UPLOAD_DIR = (0, path_1.join)(process.cwd(), 'uploads', 'client-insurance');
function ensureClientInsuranceUploadDir() {
    if (!(0, fs_1.existsSync)(exports.CLIENT_INSURANCE_UPLOAD_DIR)) {
        (0, fs_1.mkdirSync)(exports.CLIENT_INSURANCE_UPLOAD_DIR, { recursive: true });
    }
    return exports.CLIENT_INSURANCE_UPLOAD_DIR;
}
exports.CLIENT_INSURANCE_UPLOAD_ALLOWED_EXTENSIONS = /\.(pdf|jpe?g|png|webp)$/i;
exports.CLIENT_INSURANCE_ALLOWED_MIME_TYPES = {
    'application/pdf': true,
    'image/jpeg': true,
    'image/png': true,
    'image/webp': true,
};
function isAllowedClientInsuranceDocument(originalName, mimeType) {
    if (!exports.CLIENT_INSURANCE_UPLOAD_ALLOWED_EXTENSIONS.test(originalName)) {
        return false;
    }
    const normalized = (mimeType || '').toLowerCase().split(';')[0].trim();
    return Boolean(exports.CLIENT_INSURANCE_ALLOWED_MIME_TYPES[normalized]);
}
function clientInsuranceUploadMaxMb() {
    const parsed = Number(process.env.CLIENT_INSURANCE_UPLOAD_MAX_MB || 15);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}
function clientInsuranceUploadMaxBytes() {
    return clientInsuranceUploadMaxMb() * 1024 * 1024;
}
//# sourceMappingURL=file-storage.util.js.map