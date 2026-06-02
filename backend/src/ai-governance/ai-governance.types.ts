export type AiSafetyStatus = 'passed' | 'review_required' | 'blocked';

export type AiApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'blocked';

export interface AiSafetyFinding {
  rule: string;
  severity: AiSafetyStatus;
  message: string;
}

export interface AiSafetyResult {
  status: AiSafetyStatus;
  findings: AiSafetyFinding[];
}

export interface PromptUsageDefinition {
  moduleName: string;
  promptKey: string;
  label: string;
  description: string;
  defaultVersion: string;
}

export interface ResolvedPromptVersion {
  promptVersion: string;
  promptVersionId: string | null;
  promptText: string | null;
}
