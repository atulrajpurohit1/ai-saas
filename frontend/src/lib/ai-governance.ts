import api from './api';

export type PromptStatus = 'active' | 'inactive';
export type SafetyStatus = 'passed' | 'review_required' | 'blocked';
export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'blocked';

export interface PromptVersion {
  id: string;
  tenantId: string;
  moduleName: string;
  promptKey: string;
  version: string;
  promptText: string;
  status: PromptStatus;
  createdBy: string | null;
  createdAt: string;
}

export interface PromptRegistryEntry {
  moduleName: string;
  promptKey: string;
  label: string;
  description: string;
  defaultVersion: string;
  activeVersion: PromptVersion | null;
  versions: PromptVersion[];
}

export interface CreatePromptVersionPayload {
  moduleName: string;
  promptKey: string;
  version: string;
  promptText: string;
  status?: PromptStatus;
}

export interface AiSafetyFinding {
  rule: string;
  severity: SafetyStatus;
  message: string;
}

export interface AiAuditRecord {
  id: string;
  tenantId: string;
  promptVersion: string;
  promptVersionId: string | null;
  modelUsed: string;
  sourceModule: string;
  inputSource: unknown | null;
  generatedOutput: unknown;
  fallbackUsed: boolean;
  status: string;
  errorMessage: string | null;
  clientVisible: boolean;
  approvalStatus: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  safetyStatus: SafetyStatus;
  safetyFindings: AiSafetyFinding[];
  createdBy: string | null;
  createdAt: string;
  feedbackScore: number | null;
  feedbackCount: number;
  promptVersionRecord?: PromptVersion | null;
  feedback?: unknown[];
  actions?: unknown[];
}

export async function getPromptRegistry() {
  const response = await api.get<PromptRegistryEntry[]>('ai-prompts');
  return response.data;
}

export async function createPromptVersion(payload: CreatePromptVersionPayload) {
  const response = await api.post<PromptVersion>('ai-prompts', payload);
  return response.data;
}

export async function activatePromptVersion(id: string) {
  const response = await api.post<PromptVersion>(`ai-prompts/${id}/activate`);
  return response.data;
}

export async function deactivatePromptVersion(id: string) {
  const response = await api.post<PromptVersion>(`ai-prompts/${id}/deactivate`);
  return response.data;
}

export async function getAiAudit() {
  const response = await api.get<AiAuditRecord[]>('ai-audit');
  return response.data;
}

export async function getAiAuditRecord(id: string) {
  const response = await api.get<AiAuditRecord>(`ai-audit/${id}`);
  return response.data;
}

export async function approveAiOutput(id: string) {
  const response = await api.post<AiAuditRecord>(`ai-audit/${id}/approve`);
  return response.data;
}
