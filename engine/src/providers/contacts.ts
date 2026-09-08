/**
 * Contact enrichment — a provider-agnostic, optional layer.
 *
 * Two rules hold this in place, both from explicit product direction:
 *
 *  1. Absence of contact data must never prevent an opportunity from being
 *     generated. Opportunities are produced by the reasoning layer; contacts
 *     are attached afterwards, or not at all.
 *  2. Enrichment runs only for opportunities that have already earned it, so a
 *     paid lookup is never spent on a candidate that was going to be dropped.
 *
 * Apollo, Clearbit, a CRM export or a human researcher all satisfy this
 * interface. None of them is a dependency of the engine.
 */

import type { CompanyIdentity, ContactResult, DecisionMakerRole } from '../domain.ts';
import type { ProviderOperation } from './registry.ts';
import { CostLedger, requiresApproval } from './registry.ts';

export interface ContactQuery {
  company: CompanyIdentity;
  /** The function that owns the problem — from the reasoning layer. */
  role: DecisionMakerRole;
}

export interface ContactProvider {
  readonly id: string;
  /** Cost, availability and confidence, so routing can reason about it. */
  describe(): ProviderOperation;
  find(query: ContactQuery): Promise<ContactResult>;
}

/**
 * The default. Signal runs end to end with this in place: every opportunity is
 * still produced, with the decision-maker FUNCTION identified by reasoning and
 * the person left for the salesperson.
 */
export class NullContactProvider implements ContactProvider {
  readonly id = 'null';

  describe(): ProviderOperation {
    return {
      providerId: this.id,
      operation: 'null.contacts',
      dataType: 'contacts',
      cost: { credits: 0 },
      availability: 'available',
      confidence: 0,
      notes: 'no contact provider configured; roles are identified by reasoning only',
    };
  }

  async find(): Promise<ContactResult> {
    return { status: 'not_attempted' };
  }
}

export interface EnrichmentPolicy {
  /** Opportunities below this score do not justify a paid lookup. */
  minScore: number;
  /** Credits this run may spend on contacts in total. */
  creditBudget: number;
  /** Paid operations require explicit authorisation before any spend. */
  approvedForSpend: boolean;
}

export const DEFAULT_ENRICHMENT_POLICY: EnrichmentPolicy = {
  minScore: 75,
  creditBudget: 0,
  approvedForSpend: false,
};

export interface EnrichmentTarget {
  company: CompanyIdentity;
  role?: DecisionMakerRole;
  score: number;
}

export interface EnrichmentOutcome {
  company: CompanyIdentity;
  result: ContactResult;
  /** Why enrichment was or wasn't attempted — routing must be auditable. */
  reason: string;
}

/**
 * Attempts contact enrichment for targets that qualify. Never throws on
 * provider failure: a failed lookup degrades to `not_available` and the
 * opportunity stands.
 */
export async function enrichContacts(
  targets: EnrichmentTarget[],
  provider: ContactProvider,
  policy: EnrichmentPolicy = DEFAULT_ENRICHMENT_POLICY,
  ledger: CostLedger = new CostLedger(),
): Promise<EnrichmentOutcome[]> {
  const op = provider.describe();
  const perCall = op.cost.credits ?? 0;
  let spent = 0;

  const outcomes: EnrichmentOutcome[] = [];

  for (const target of targets) {
    if (target.score < policy.minScore) {
      outcomes.push({
        company: target.company,
        result: { status: 'not_attempted' },
        reason: `score ${target.score} below enrichment threshold ${policy.minScore}`,
      });
      continue;
    }
    if (!target.role) {
      outcomes.push({
        company: target.company,
        result: { status: 'not_attempted' },
        reason: 'decision-maker function not identified — nothing to look up',
      });
      continue;
    }
    if (op.availability !== 'available') {
      outcomes.push({
        company: target.company,
        result: { status: 'not_available' },
        reason: `provider ${op.providerId} unavailable: ${op.availability}`,
      });
      continue;
    }
    if (requiresApproval(op) && !policy.approvedForSpend) {
      outcomes.push({
        company: target.company,
        result: { status: 'not_attempted' },
        reason: `operation costs ${perCall} credits and spend is not approved`,
      });
      continue;
    }
    if (spent + perCall > policy.creditBudget) {
      outcomes.push({
        company: target.company,
        result: { status: 'not_attempted' },
        reason: `credit budget ${policy.creditBudget} exhausted`,
      });
      continue;
    }

    let result: ContactResult;
    try {
      result = await provider.find({ company: target.company, role: target.role });
    } catch {
      // A provider outage must not cost us the opportunity.
      result = { status: 'not_available' };
    }

    spent += perCall;
    ledger.record({
      operation: op.operation,
      credits: perCall,
      useful: result.status === 'found',
      companyDomain: target.company.domain,
    });

    outcomes.push({
      company: target.company,
      result,
      reason: result.status === 'found' ? 'contact found' : 'provider returned no contact',
    });
  }

  return outcomes;
}
