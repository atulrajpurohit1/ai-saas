import { BadRequestException } from '@nestjs/common';
import {
  EmergencyAlertStatus,
  assertCanAcknowledge,
  assertCanResolve,
} from './emergency-alert-status.util';

describe('emergency-alert-status.util', () => {
  describe('assertCanAcknowledge', () => {
    it('allows acknowledging an ACTIVE alert', () => {
      expect(() =>
        assertCanAcknowledge(EmergencyAlertStatus.ACTIVE),
      ).not.toThrow();
    });

    it('rejects acknowledging an already-ACKNOWLEDGED alert', () => {
      expect(() =>
        assertCanAcknowledge(EmergencyAlertStatus.ACKNOWLEDGED),
      ).toThrow(BadRequestException);
    });

    it('rejects acknowledging a RESOLVED alert', () => {
      expect(() => assertCanAcknowledge(EmergencyAlertStatus.RESOLVED)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertCanResolve', () => {
    it('allows resolving an ACKNOWLEDGED alert', () => {
      expect(() =>
        assertCanResolve(EmergencyAlertStatus.ACKNOWLEDGED),
      ).not.toThrow();
    });

    it('rejects resolving an ACTIVE alert directly (must be acknowledged first)', () => {
      expect(() => assertCanResolve(EmergencyAlertStatus.ACTIVE)).toThrow(
        BadRequestException,
      );
    });

    it('rejects resolving an already-RESOLVED alert (no double-resolve)', () => {
      expect(() => assertCanResolve(EmergencyAlertStatus.RESOLVED)).toThrow(
        BadRequestException,
      );
    });
  });
});
