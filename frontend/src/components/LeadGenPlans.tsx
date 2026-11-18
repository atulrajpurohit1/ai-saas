'use client';

import React from 'react';
import Link from 'next/link';
import { Coins, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CreditPackAvailability,
  LeadGenPlans as LeadGenPlansData,
  LeadGenTierKey,
} from '@/lib/billing';

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;

const count = (amount: number) => amount.toLocaleString('en-US');

interface Props {
  leadGen: LeadGenPlansData;
  /** False when nothing at all can be bought online yet. */
  configured: boolean;
  /**
   * Whether this account already has Lead Gen -- on a plan of its own, or
   * inside Complete. If it does, these cards sell credits rather than plans.
   */
  holdsLeadGen: boolean;
  /** Credit packs, for the top-up prices. Null until loaded. */
  packs: CreditPackAvailability | null;
  /**
   * The plan this account is on, when it is NOT a Lead Gen one -- e.g.
   * "AegisLead Guard". Lead Gen is bought as an add-on beside it, so the
   * cards say "Add" rather than "Get started", and promise that the existing
   * plan keeps running.
   */
  alongside: string | null;
  /** Tier key, or null for the base plan with no credits. */
  onChoose: (tier: LeadGenTierKey | null) => void;
  onBuyCredits: (pack: LeadGenTierKey) => void;
  pending: LeadGenTierKey | 'BASE' | null;
  pendingPack: string | null;
}

/**
 * The AegisLead Generation plans.
 *
 * Shown above the guard-band chart, and deliberately not inside it: Lead Gen
 * is a sales tool, so the number of guards a company runs says nothing about
 * what it costs to serve them.
 *
 * The cards do one of two jobs, depending on who is looking:
 *
 *  - A customer who does NOT have Lead Gen sees three plans to start on. The
 *    credits are included once, at the door, so they can run a search on the
 *    day they pay.
 *  - A customer who already HAS Lead Gen -- on its own or as part of Complete
 *    -- has nothing to start, so the same three cards sell the same credit
 *    amounts as top-up packs at the credits price. Offering them a plan they
 *    are already paying for is the one thing these cards must not do.
 *
 * Either way the credits never expire, so the copy says "included" and never
 * "per month". A credit figure with "/mo" next to it reads as an allowance
 * that resets, and a customer who believes that will spend to the wall every
 * month expecting the balance back.
 */
export default function LeadGenPlans({
  leadGen,
  configured,
  holdsLeadGen,
  packs,
  alongside,
  onChoose,
  onBuyCredits,
  pending,
  pendingPack,
}: Props) {
  const busy = pending !== null || pendingPack !== null;

  /** The pack that sells this tier's credits, when packs can be bought. */
  const packFor = (key: LeadGenTierKey) =>
    packs?.configured
      ? (packs.packs.find((pack) => pack.key === key) ?? null)
      : null;

  // The base plan is a Lead Gen plan, so it is only worth offering to someone
  // whose plan IS Lead Gen. A Complete customer holds Lead Gen too, but for
  // them "switch to Generation only" is a downgrade out of two other
  // products, and that belongs in the chart below, not in a quiet row here.
  const onLeadGenPlan = leadGen.currentTier !== null || leadGen.onBasePlan;
  const showBaseRow = !holdsLeadGen || onLeadGenPlan;

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {leadGen.tiers.map((tier) => {
          const isCurrent = leadGen.currentTier === tier.key;
          const pack = packFor(tier.key);
          // What the customer is actually buying from this card.
          const price = holdsLeadGen ? (pack?.price ?? null) : tier.price;
          const credits = holdsLeadGen
            ? (pack?.credits ?? tier.includedCredits)
            : tier.includedCredits;
          const searchCost = packs?.costs?.discoverySearch ?? 0;
          const searches = searchCost > 0 ? Math.floor(credits / searchCost) : null;

          return (
            <div
              key={tier.key}
              className={cn(
                'relative flex flex-col rounded-xl border bg-card p-5 text-center',
                tier.popular
                  ? 'border-primary shadow-sm md:-mt-2 md:pt-7'
                  : 'border-border',
                isCurrent && 'ring-2 ring-primary/40',
              )}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                  <Star className="h-3 w-3 fill-current" /> Most popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-foreground">
                {tier.name}
              </h3>
              <p className="mx-auto mt-1 max-w-[16rem] text-xs text-muted-foreground">
                {tier.tagline}
              </p>

              {price === null ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Unavailable right now
                </p>
              ) : (
                <>
                  <p
                    className={cn(
                      'mt-4 text-4xl font-bold tracking-tight',
                      tier.popular ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {money(price)}
                    <span className="ml-1 align-middle text-sm font-medium text-muted-foreground">
                      {holdsLeadGen ? 'one-time' : '/mo'}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {holdsLeadGen
                      ? // What the credits buy, not what each one costs: a
                        // per-credit price at these sizes rounds to the same
                        // couple of cents for every pack and says nothing.
                        searches !== null
                        ? `About ${count(searches)} prospect searches`
                        : 'Credits for prospect searches and AI work'
                      : `${money(leadGen.basePrice)} plan + ${money(
                          tier.creditsPrice,
                        )} credits`}
                  </p>
                </>
              )}

              <p
                className={cn(
                  'mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold',
                  tier.popular
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-foreground',
                )}
              >
                <Coins className="h-4 w-4" />
                {count(credits)} credits{holdsLeadGen ? '' : ' included'}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {holdsLeadGen
                  ? 'Added to your balance — they never expire'
                  : 'Added once, when the plan starts — they never expire'}
              </p>

              <div className="mt-5">
                {holdsLeadGen ? (
                  pack ? (
                    <button
                      type="button"
                      onClick={() => onBuyCredits(tier.key)}
                      disabled={busy}
                      className={cn(
                        'inline-flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60',
                        tier.popular
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-foreground hover:bg-muted',
                      )}
                    >
                      {pendingPack === tier.key
                        ? 'Redirecting…'
                        : `Buy credits · ${money(pack.price)}`}
                    </button>
                  ) : null
                ) : (
                  <button
                    type="button"
                    onClick={() => onChoose(tier.key)}
                    disabled={busy}
                    className={cn(
                      'inline-flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60',
                      tier.popular
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {pending === tier.key
                      ? 'Redirecting…'
                      : `${
                          leadGen.onBasePlan
                            ? 'Switch'
                            : alongside
                              ? 'Add'
                              : 'Get started'
                        } · ${money(tier.price)}/mo`}
                  </button>
                )}

                {isCurrent && (
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Your plan
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/*
        The plan with no credits in it. Deliberately a quiet row rather than a
        fourth card: it is not a way IN to Lead Gen -- a first-time customer
        has to start with credits or the product does nothing on day one --
        it is where a customer who already has credits goes to stop paying for
        more of them.
      */}
      {showBaseRow && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {leadGen.name} only — {money(leadGen.basePrice)}/mo, no credits
              {leadGen.onBasePlan && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Current plan
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {leadGen.baseRequiresPlan
                ? 'Available once you are on Lead Gen. Your first plan has to include credits, or there is nothing to search with on day one.'
                : 'The platform fee on its own. Keep the credits you already have and top up only when you need to.'}
            </p>
          </div>

          {!leadGen.onBasePlan && leadGen.baseSellable && configured && (
            <button
              type="button"
              onClick={() => onChoose(null)}
              disabled={busy}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              {pending === 'BASE'
                ? 'Redirecting…'
                : `Switch · ${money(leadGen.basePrice)}/mo`}
            </button>
          )}
        </div>
      )}

      {/*
        Lead Gen is billed as a second line on the same subscription, so the
        existing plan keeps running. Worth saying plainly: until recently
        buying this replaced whatever you were on, and a customer who
        remembers that will not risk their patrols to find out.
      */}
      {!holdsLeadGen && alongside && (
        <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">
          This is added alongside {alongside}, on the same subscription —{' '}
          {alongside} keeps running and is billed as it is now.
        </p>
      )}

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {holdsLeadGen ? (
          <p>
            Credits are spent on prospect searches, playbooks and the AI
            features. They never expire, so anything you buy here stays on the
            balance until you use it.
          </p>
        ) : (
          <p>
            Lead Gen is the same price whatever your guard count — it is a
            sales tool, not a field operations one. The credits in a starting
            plan are added to your balance once, when the plan begins, and stay
            there until you spend them; renewals pay for the plan, not for more
            credits.
          </p>
        )}
        <p>
          Your balance and purchase history are on the{' '}
          <Link
            href="/settings/credits"
            className="font-medium text-primary hover:underline"
          >
            credits page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
