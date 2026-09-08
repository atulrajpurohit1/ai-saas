import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  OfflineActionDto,
  SyncOfflineActionsDto,
} from './sync-offline-actions.dto';

/**
 * Regression: SyncOfflineActionsDto.actions was typed OfflineActionDto[] but
 * only decorated with @IsArray(), so class-validator never recursed into the
 * elements. A malformed action (missing actionType / payload / createdAt) then
 * passed validation and crashed GuardPortalService.processSyncQueue with a
 * Prisma error (HTTP 500) instead of being rejected as a 400.
 */
describe('SyncOfflineActionsDto', () => {
  const validate = (payload: unknown) =>
    validateSync(plainToInstance(SyncOfflineActionsDto, payload));

  it('accepts an empty actions array', () => {
    expect(validate({ actions: [] })).toHaveLength(0);
  });

  it('accepts a well-formed action', () => {
    const errors = validate({
      actions: [
        {
          id: 'a1',
          actionType: 'patrol_checkpoint_scan',
          payload: { runId: 'r1', checkpointId: 'c1' },
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an action missing actionType / payload / createdAt (nested validation)', () => {
    const errors = validate({ actions: [{ id: 'x' }] });
    expect(errors.length).toBeGreaterThan(0);
    // the failure is on the `actions` property, from the nested element
    expect(errors[0].property).toBe('actions');
  });

  it('rejects when actions is not an array', () => {
    expect(validate({ actions: 'nope' }).length).toBeGreaterThan(0);
  });

  it('rejects an action with a non-object payload', () => {
    const errors = validate({
      actions: [
        {
          id: 'a1',
          actionType: 'check_in',
          payload: 'not-an-object',
          createdAt: 'now',
        },
      ],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('OfflineActionDto requires all four fields individually', () => {
    const errors = validateSync(plainToInstance(OfflineActionDto, {}));
    const props = errors.map((e) => e.property).sort();
    expect(props).toEqual(['actionType', 'createdAt', 'id', 'payload']);
  });
});
