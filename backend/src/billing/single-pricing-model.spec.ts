import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!full.endsWith('.ts')) return [];
    if (full.endsWith('.spec.ts')) return [];
    return [full];
  });
}

/**
 * AegisLead has ONE pricing model: the packages and guard bands in
 * pricing.constants.ts, shown at /settings/plan.
 *
 * A second one used to live in billing.service.ts -- Free/Starter/Growth/
 * Enterprise tiers with enforced caps on users, branches, leads and deals,
 * selected by the BILLING_DEFAULT_PLAN env var rather than by anything the
 * customer had bought. It contradicted the real price table and silently
 * capped paying accounts. These tests stop it coming back.
 */
describe('single pricing model', () => {
  it('has no second plan tier system', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => {
        const contents = readFileSync(file, 'utf8');
        // Comments explaining the removal are fine; code is not.
        const code = contents
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        return (
          /BILLING_DEFAULT_PLAN|BILLING_PLAN_/.test(code) ||
          /\bfeaturesForPlan\b|\bavailablePlans\b/.test(code)
        );
      })
      .map((file) => file.replace(SRC_ROOT, 'src'));

    expect(offenders).toEqual([]);
  });

  it('does not gate tenants on per-plan usage caps', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => {
        const code = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        return /assertCanAddAdminUser|assertCanAddClientUser|assertWithinLimit/.test(
          code,
        );
      })
      .map((file) => file.replace(SRC_ROOT, 'src'));

    expect(offenders).toEqual([]);
  });
});
