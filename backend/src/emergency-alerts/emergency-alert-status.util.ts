import { BadRequestException } from '@nestjs/common';

// Phase 3D: panic/duress alert lifecycle. A strict, one-directional state
// machine - no reopening (RESOLVED -> ACTIVE) since the product requirement
// only calls for forward progress through the emergency workflow.
export enum EmergencyAlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export function assertCanAcknowledge(status: string): void {
  if (status !== (EmergencyAlertStatus.ACTIVE as string)) {
    throw new BadRequestException(
      `Cannot acknowledge an alert with status "${status}" - only ACTIVE alerts can be acknowledged.`,
    );
  }
}

export function assertCanResolve(status: string): void {
  if (status !== (EmergencyAlertStatus.ACKNOWLEDGED as string)) {
    throw new BadRequestException(
      `Cannot resolve an alert with status "${status}" - only ACKNOWLEDGED alerts can be resolved.`,
    );
  }
}
