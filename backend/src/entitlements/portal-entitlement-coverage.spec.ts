import { readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

const read = (relative: string) =>
  readFileSync(join(SRC_ROOT, relative), 'utf8');

/**
 * Entitlements were only ever enforced on the staff-JWT path, through
 * ModuleGuard on a normal controller. Every other way into the system
 * authenticates differently and so bypassed it completely:
 *
 *   - the public API, with an API key
 *   - the client portal, with a client token
 *   - the guard app, with a guard token
 *
 * The guard app was the costly one. Shift attendance is the Guard Tour
 * product, so a tenant could cancel Guard Tour and their guards would carry on
 * checking in and out indefinitely while the web app correctly locked their
 * own staff out of the same data.
 *
 * These assert the gates stay wired. They read the source rather than
 * exercising the guard because what failed here was never the guard's logic --
 * it was nobody having attached it.
 */
describe('portal entitlement coverage', () => {
  describe('client portal', () => {
    const source = read('client-portal/client-portal.controller.ts');

    it('wires ModuleGuard', () => {
      expect(source).toMatch(/@UseGuards\(JwtAuthGuard, ModuleGuard\)/);
    });

    it('gates every proposal route on LEAD_GEN', () => {
      const ungated = source
        .split(/\n(?= {2}@(?:Get|Post)\()/)
        .slice(1)
        .filter((segment) => /@(?:Get|Post)\('proposals/.test(segment))
        .filter((segment) => !segment.includes("@RequireModule('LEAD_GEN')"))
        .map((segment) => segment.split('\n')[0].trim());

      expect(ungated).toEqual([]);
    });

    // Proving the above is not vacuous: if the routes were renamed away from
    // the 'proposals' prefix the filter would silently match nothing.
    it('finds the proposal routes it claims to check', () => {
      expect(source.match(/@(?:Get|Post)\('proposals/g)?.length).toBe(8);
    });
  });

  describe('guard portal', () => {
    const source = read('guard-portal/guard-portal.controller.ts');

    it('wires ModuleGuard', () => {
      expect(source).toMatch(
        /@UseGuards\(JwtAuthGuard, RolesGuard, ModuleGuard\)/,
      );
    });

    // Shifts are rostered under Operations and attendance is executed under
    // Guard, so either service legitimately runs the app. A tenant with
    // neither cannot have guards at all.
    it('gates shift and attendance routes on GUARD_TOUR or FINANCE', () => {
      const ungated = source
        .split(/\n(?= {2}@(?:Get|Post)\()/)
        .slice(1)
        .filter((segment) => /@(?:Get|Post)\('(?:shifts|sync)/.test(segment))
        .filter(
          (segment) =>
            !segment.includes("@RequireModule('GUARD_TOUR', 'FINANCE')"),
        )
        .map((segment) => segment.split('\n')[0].trim());

      expect(ungated).toEqual([]);
    });

    // Deliberately open: it is the first call the app makes after login, so
    // gating it would present a lapsed plan as a broken login.
    it('leaves the guard profile route open', () => {
      const profile = source
        .split(/\n(?= {2}@(?:Get|Post)\()/)
        .find((segment) => segment.trimStart().startsWith("@Get('me')"));

      expect(profile).toBeDefined();
      expect(profile).not.toContain('@RequireModule');
    });
  });

  describe('CRM connectors', () => {
    const source = read('crm-connectors/crm-connectors.controller.ts');

    // These write Lead rows. 'integrations.manage' alone satisfies the
    // permission guard and sits on the CORE integrations module, so without a
    // module gate any account could import a CRM contact list as leads having
    // bought nothing -- the side door into the table LeadsController guards.
    it('gates both lead-writing routes on LEAD_GEN', () => {
      for (const route of [
        "@Post(':provider/import-contacts')",
        "@Post(':provider/contacts')",
      ]) {
        const segment = source
          .split(/\n(?= {2}@(?:Get|Post)\()/)
          .find((part) => part.trimStart().startsWith(route));

        expect(segment).toBeDefined();
        expect(segment).toContain("@RequireModule('LEAD_GEN')");
        expect(segment).toContain('ModuleGuard');
      }
    });

    // Connecting an integration is core; only the lead writes are Lead Gen.
    it('leaves connection management on the core integrations module', () => {
      const status = source
        .split(/\n(?= {2}@(?:Get|Post)\()/)
        .find((part) => part.trimStart().startsWith("@Get('status')"));

      expect(status).toBeDefined();
      expect(status).not.toContain('@RequireModule');
    });
  });

  // The vendor portal is deliberately NOT gated: it is a public token-link
  // flow used by an external vendor replying to an RFP invitation that a
  // tenant could only have sent while it held Lead Gen. Gating it would strand
  // a third party mid-submission to protect revenue that was already
  // collected. Pinned so the omission reads as a decision.
  it('leaves the vendor invitation flow ungated by design', () => {
    const source = read('vendor-portal/vendor-portal.controller.ts');

    expect(source).not.toContain('@RequireModule');
  });

  // Also deliberately NOT gated. A guard raising an emergency alert is a
  // life-safety path, and refusing one because a subscription lapsed trades
  // somebody's safety for revenue that an alert does not earn anyway. A
  // tenant with no guard product has no guards to raise one.
  it('leaves guard emergency alerts ungated by design', () => {
    const source = read(
      'emergency-alerts/guard-emergency-alerts.controller.ts',
    );

    expect(source).not.toContain('@RequireModule');
  });
});
