import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../billing/credits.service';
import { UpstreamBudgetService } from './upstream-budget.service';
import { UpstreamSolvencyService } from './upstream-solvency.service';

describe('UpstreamSolvencyService', () => {
  let creditsService: { totalOutstandingCredits: jest.Mock };
  let upstreamBudget: { getBalanceUsd: jest.Mock };
  let errors: string[];
  let warnings: string[];

  const build = (env: Record<string, string | undefined> = {}) => {
    const configService = { get: jest.fn((key: string) => env[key]) };
    const service = new UpstreamSolvencyService(
      configService as unknown as ConfigService,
      creditsService as unknown as CreditsService,
      upstreamBudget as unknown as UpstreamBudgetService,
    );
    errors = [];
    warnings = [];
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((message) => void errors.push(String(message)));
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((message) => void warnings.push(String(message)));
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    return service;
  };

  beforeEach(() => {
    creditsService = { totalOutstandingCredits: jest.fn() };
    upstreamBudget = { getBalanceUsd: jest.fn() };
  });

  afterEach(() => jest.restoreAllMocks());

  it('values outstanding credits at the measured cost per credit', async () => {
    creditsService.totalOutstandingCredits.mockResolvedValue(10_000);
    upstreamBudget.getBalanceUsd.mockResolvedValue(1000);

    // 10,000 credits at the default $0.05 is a $500 liability against $1,000.
    await expect(build().getSolvency()).resolves.toEqual({
      outstandingCredits: 10_000,
      liabilityUsd: 500,
      prepaidBalanceUsd: 1000,
      coverage: 2,
    });
  });

  it('reads a fresh balance rather than the cached one', async () => {
    creditsService.totalOutstandingCredits.mockResolvedValue(100);
    upstreamBudget.getBalanceUsd.mockResolvedValue(500);

    await build().getSolvency();

    expect(upstreamBudget.getBalanceUsd).toHaveBeenCalledWith(true);
  });

  /**
   * The state worth paging someone about: the credits are already sold, so
   * the shortfall is not a forecast. Nothing in code can fix it -- topping up
   * the BlackPearl balance is console-only -- so the alert IS the remedy.
   */
  it('logs an error when the pot cannot cover the credits already sold', async () => {
    creditsService.totalOutstandingCredits.mockResolvedValue(20_000);
    upstreamBudget.getBalanceUsd.mockResolvedValue(400);

    const service = build();
    await service.check();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('does NOT cover');
    // $1,000 of liability against $400.
    expect(errors[0]).toContain('$600.00');
  });

  it('warns when the pot covers the liability but only just', async () => {
    creditsService.totalOutstandingCredits.mockResolvedValue(10_000);
    upstreamBudget.getBalanceUsd.mockResolvedValue(520);

    const service = build();
    await service.check();

    // $500 liability, $520 balance: covered, but inside the headroom margin.
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('little room');
  });

  it('says nothing alarming when the pot comfortably covers the liability', async () => {
    creditsService.totalOutstandingCredits.mockResolvedValue(1000);
    upstreamBudget.getBalanceUsd.mockResolvedValue(900);

    const service = build();
    await service.check();

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  /**
   * Same posture as the spend guard: a status endpoint being down is a
   * monitoring problem, not a solvency one, and must not raise an alert that
   * sends someone to top up an account that may be perfectly healthy.
   */
  it('reports unknown rather than insolvent when the balance cannot be read', async () => {
    creditsService.totalOutstandingCredits.mockResolvedValue(20_000);
    upstreamBudget.getBalanceUsd.mockResolvedValue(null);

    const service = build();
    const solvency = await service.check();

    expect(errors).toHaveLength(0);
    expect(warnings[0]).toContain('solvency unknown');
    expect(solvency.coverage).toBeNull();
  });

  it('honours a configured cost per credit', async () => {
    creditsService.totalOutstandingCredits.mockResolvedValue(1000);
    upstreamBudget.getBalanceUsd.mockResolvedValue(1000);

    const service = build({ BLACKPEARL_USD_PER_CREDIT: '0.02' });

    await expect(service.getSolvency()).resolves.toMatchObject({
      liabilityUsd: 20,
    });
  });

  it('ignores a cost per credit that is not a positive number', async () => {
    creditsService.totalOutstandingCredits.mockResolvedValue(1000);
    upstreamBudget.getBalanceUsd.mockResolvedValue(1000);

    const service = build({ BLACKPEARL_USD_PER_CREDIT: 'cheap' });

    // Falls back to the measured default rather than valuing credits at zero,
    // which would report every account as solvent.
    await expect(service.getSolvency()).resolves.toMatchObject({
      liabilityUsd: 50,
    });
  });
});
