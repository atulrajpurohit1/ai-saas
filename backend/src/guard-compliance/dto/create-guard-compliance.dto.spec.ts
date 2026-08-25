import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGuardComplianceDto } from './create-guard-compliance.dto';

describe('CreateGuardComplianceDto', () => {
  it('accepts a well-formed compliance record', async () => {
    const dto = plainToInstance(CreateGuardComplianceDto, {
      guard_id: 'guard-1',
      type: 'guard_license',
      document_number: 'GL-12345',
      issuing_authority: 'State Board',
      issue_date: '2026-01-01T00:00:00.000Z',
      expiration_date: '2027-01-01T00:00:00.000Z',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a record with only the required fields', async () => {
    const dto = plainToInstance(CreateGuardComplianceDto, {
      guard_id: 'guard-1',
      type: 'other',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a compliance type outside the configured list', async () => {
    const dto = plainToInstance(CreateGuardComplianceDto, {
      guard_id: 'guard-1',
      type: 'not_a_real_type',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects a missing guard_id', async () => {
    const dto = plainToInstance(CreateGuardComplianceDto, {
      type: 'guard_license',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'guard_id')).toBe(true);
  });

  it('rejects a malformed issue_date', async () => {
    const dto = plainToInstance(CreateGuardComplianceDto, {
      guard_id: 'guard-1',
      type: 'guard_license',
      issue_date: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'issue_date')).toBe(true);
  });

  it('rejects a malformed expiration_date', async () => {
    const dto = plainToInstance(CreateGuardComplianceDto, {
      guard_id: 'guard-1',
      type: 'guard_license',
      expiration_date: '31-13-2026',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'expiration_date')).toBe(true);
  });
});
