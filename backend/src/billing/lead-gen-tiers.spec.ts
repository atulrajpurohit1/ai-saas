import {
  LEAD_GEN_BASE_PRICE,
  LEAD_GEN_TIERS,
  LEAD_GEN_TIER_KEYS,
  allLeadGenTierLookupKeys,
  isLeadGenTierKey,
  leadGenCreditsKey,
  leadGenTierForLookupKey,
  leadGenTierLookupKey,
} from './lead-gen-tiers.constants';
import { GUARD_BAND_PACKAGE_KEYS, PACKAGE_KEYS } from './pricing.constants';

describe('Lead Gen tiers', () => {
  describe('the published plans', () => {
    // The plans as the client set them. Checkout charges from these numbers,
    // so a typo here is a wrong invoice.
    it('matches every published plan', () => {
      expect(
        LEAD_GEN_TIER_KEYS.map((key) => {
          const tier = LEAD_GEN_TIERS[key];
          return [tier.name, tier.price, tier.includedCredits];
        }),
      ).toEqual([
        ['Starter', 448, 3000],
        ['Pro', 548, 13000],
        ['Elite', 648, 23000],
      ]);
    });

    it('prices every tier as the base fee plus its allocation', () => {
      for (const key of LEAD_GEN_TIER_KEYS) {
        const tier = LEAD_GEN_TIERS[key];
        expect(tier.price).toBe(LEAD_GEN_BASE_PRICE + tier.creditsPrice);
      }
      expect(LEAD_GEN_BASE_PRICE).toBe(299);
    });

    // More money must buy more credits, or the ladder is nonsense.
    it('grows both price and credits with every step up', () => {
      const tiers = LEAD_GEN_TIER_KEYS.map((key) => LEAD_GEN_TIERS[key]);
      for (let i = 1; i < tiers.length; i += 1) {
        expect(tiers[i].price).toBeGreaterThan(tiers[i - 1].price);
        expect(tiers[i].includedCredits).toBeGreaterThan(
          tiers[i - 1].includedCredits,
        );
      }
    });

    it('highlights exactly one plan', () => {
      const popular = LEAD_GEN_TIER_KEYS.filter(
        (key) => LEAD_GEN_TIERS[key].popular,
      );
      expect(popular).toEqual(['PRO']);
    });

    it('gives every credit a lower unit price as the tier grows', () => {
      const perCredit = LEAD_GEN_TIER_KEYS.map(
        (key) =>
          LEAD_GEN_TIERS[key].creditsPrice /
          LEAD_GEN_TIERS[key].includedCredits,
      );
      for (let i = 1; i < perCredit.length; i += 1) {
        expect(perCredit[i]).toBeLessThan(perCredit[i - 1]);
      }
    });
  });

  describe('Stripe lookup keys', () => {
    it('names the tier, allocation and amount', () => {
      expect(leadGenTierLookupKey('PRO')).toBe(
        'aegislead_leadgen_pro_13000cr_548usd_monthly',
      );
      expect(leadGenTierLookupKey('STARTER')).toBe(
        'aegislead_leadgen_starter_3000cr_448usd_monthly',
      );
    });

    it('covers the three tiers exactly once', () => {
      const keys = allLeadGenTierLookupKeys();
      expect(keys).toHaveLength(3);
      expect(new Set(keys).size).toBe(3);
    });

    it('round-trips back to the tier it names', () => {
      for (const key of LEAD_GEN_TIER_KEYS) {
        expect(leadGenTierForLookupKey(leadGenTierLookupKey(key))?.key).toBe(
          key,
        );
      }
    });

    // The webhook feeds it whatever Stripe sent, including a plan key, a
    // legacy price with no lookup key at all, or nothing.
    it('resolves nothing for a key that is not a Lead Gen tier', () => {
      expect(
        leadGenTierForLookupKey('aegislead_guard_26_50_149usd_monthly'),
      ).toBeNull();
      expect(leadGenTierForLookupKey(null)).toBeNull();
      expect(leadGenTierForLookupKey(undefined)).toBeNull();
      expect(leadGenTierForLookupKey('')).toBeNull();
    });

    it('cannot be confused with a guard-band plan key', () => {
      const planLike = allLeadGenTierLookupKeys().filter((key) =>
        /^aegislead_(generation|guard|operations|complete)_/.test(key),
      );
      expect(planLike).toEqual([]);
    });
  });

  it('accepts only the three tier keys', () => {
    expect(isLeadGenTierKey('PRO')).toBe(true);
    expect(isLeadGenTierKey('GENERATION')).toBe(false);
    expect(isLeadGenTierKey('toString')).toBe(false);
  });

  it('keys the credits on the invoice that paid for them', () => {
    expect(leadGenCreditsKey('in_123')).toBe('leadgen-credits:in_123');
    expect(leadGenCreditsKey('in_123')).not.toBe(leadGenCreditsKey('in_124'));
  });

  // The base plan is the platform fee with no credits, and it is the same
  // $299 Generation price that existed before the tiers -- so a tenant on the
  // old flat plan is already on it, with nothing to migrate.
  it('prices the base plan at the platform fee alone', () => {
    expect(LEAD_GEN_BASE_PRICE).toBe(299);
    for (const key of LEAD_GEN_TIER_KEYS) {
      expect(LEAD_GEN_TIERS[key].price).toBeGreaterThan(LEAD_GEN_BASE_PRICE);
    }
  });

  // The point of the change: Lead Gen left the guard-band chart, because a
  // sales tool does not cost more to run for a company with more guards.
  it('is not one of the packages priced by guard count', () => {
    expect(GUARD_BAND_PACKAGE_KEYS).not.toContain('GENERATION');
    expect(GUARD_BAND_PACKAGE_KEYS).toEqual([
      'GUARD',
      'OPERATIONS',
      'COMPLETE',
    ]);
    // Still a package: existing Generation subscriptions resolve through it.
    expect(PACKAGE_KEYS).toContain('GENERATION');
  });
});
