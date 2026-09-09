/**
 * Change-family query generation.
 *
 * The v4 engine ran two fixed templates per company. That is why NMS's $427m
 * Zambian health programme was invisible: no query was shaped like a contract
 * award, and none looked at the company's own newsroom.
 *
 * A change family is a KIND of commercial change, with its own vocabulary. The
 * families here are the ones `docs/ORBITAL_COMMERCIAL_BENCHMARK.md` recognises,
 * and the query terms are the family's vocabulary — not one company's. Nothing
 * in this file names a target, an industry or a country, so no company can be
 * special-cased into being found.
 *
 * Query generation is discovery only. It changes what the engine looks at; it
 * changes nothing about how what it finds is judged.
 */

import type { IdentityFingerprint } from '../domain.ts';
import type { ClientProfile } from '../pipeline.ts';
import type { ClaimTopic } from './registry.ts';

export type ChangeFamilyId =
  | 'expansion'
  | 'relocation'
  | 'new_premises'
  | 'major_contract'
  | 'project'
  | 'investment'
  | 'acquisition'
  | 'new_market'
  | 'hiring'
  | 'partnership'
  | 'tender'
  | 'manufacturing_change'
  | 'distribution_change'
  | 'technology_automation'
  | 'restructuring'
  | 'customer_win';

export interface ChangeFamily {
  id: ChangeFamilyId;
  label: string;
  /**
   * How directly this family alters the physical movement of goods, per the
   * benchmark. Used to order queries under a budget — never to score.
   */
  strength: 'strong' | 'moderate';
  /** The family's search vocabulary. */
  terms: string[];
  /** The topic its findings usually belong to, for source classification. */
  topic: ClaimTopic;
}

/**
 * Ordered strong-first. Contraction sits among the rest deliberately: a
 * restructuring is a change with consequences, not an absence of signal.
 */
export const CHANGE_FAMILIES: ChangeFamily[] = [
  {
    id: 'major_contract',
    label: 'Major contract win',
    strength: 'strong',
    terms: ['contract awarded', 'wins contract', 'signs agreement', 'secures deal'],
    topic: 'contract_win',
  },
  {
    id: 'project',
    label: 'Project or programme activity',
    strength: 'strong',
    terms: ['project', 'programme', 'construction', 'delivery phase', 'site works'],
    topic: 'contract_win',
  },
  {
    id: 'new_market',
    label: 'New market or geography',
    strength: 'strong',
    terms: ['enters market', 'new market', 'export', 'overseas expansion', 'first shipment'],
    topic: 'export_trade',
  },
  {
    id: 'expansion',
    label: 'Capacity or business expansion',
    strength: 'strong',
    terms: ['expansion', 'expands', 'capacity increase', 'scaling up', 'growth'],
    topic: 'premises',
  },
  {
    id: 'new_premises',
    label: 'New premises or facility',
    strength: 'strong',
    terms: ['new facility', 'opens site', 'distribution centre', 'warehouse', 'new factory'],
    topic: 'premises',
  },
  {
    id: 'relocation',
    label: 'Relocation or site move',
    strength: 'strong',
    terms: ['relocation', 'relocates', 'moves to', 'site consolidation', 'new headquarters'],
    topic: 'premises',
  },
  {
    id: 'manufacturing_change',
    label: 'Manufacturing change',
    strength: 'strong',
    terms: ['production line', 'manufacturing investment', 'reshoring', 'new production', 'plant upgrade'],
    topic: 'premises',
  },
  {
    id: 'distribution_change',
    label: 'Distribution or logistics change',
    strength: 'strong',
    terms: ['logistics', 'distribution', 'supply chain', 'fulfilment', 'third-party logistics'],
    topic: 'premises',
  },
  {
    id: 'acquisition',
    label: 'Acquisition or divestment',
    strength: 'strong',
    terms: ['acquires', 'acquisition', 'merger', 'sells division', 'takeover'],
    topic: 'corporate_identity',
  },
  {
    id: 'tender',
    label: 'Tender activity',
    strength: 'strong',
    terms: ['tender', 'framework agreement', 'bid', 'preferred bidder', 'procurement'],
    topic: 'contract_win',
  },
  {
    id: 'customer_win',
    label: 'Major customer win',
    strength: 'strong',
    terms: ['new customer', 'supply agreement', 'approved supplier', 'partnership with', 'listed by'],
    topic: 'contract_win',
  },
  {
    id: 'investment',
    label: 'Investment or funding',
    strength: 'moderate',
    terms: ['investment', 'funding', 'raises', 'finance facility', 'backing'],
    topic: 'funding',
  },
  {
    id: 'hiring',
    label: 'Hiring',
    strength: 'moderate',
    terms: ['hiring', 'recruiting', 'jobs', 'new roles', 'vacancies'],
    topic: 'hiring',
  },
  {
    id: 'partnership',
    label: 'Partnership or joint venture',
    strength: 'moderate',
    terms: ['partnership', 'joint venture', 'collaboration', 'teams up'],
    topic: 'general',
  },
  {
    id: 'technology_automation',
    label: 'Technology or automation',
    strength: 'moderate',
    terms: ['automation', 'robotics', 'new technology', 'digital transformation', 'system upgrade'],
    topic: 'product',
  },
  {
    id: 'restructuring',
    label: 'Restructuring or contraction',
    strength: 'moderate',
    terms: ['restructuring', 'redundancies', 'consultation', 'closure', 'administration'],
    topic: 'restructuring',
  },
];

export const CHANGE_FAMILY_IDS = CHANGE_FAMILIES.map((f) => f.id);

export function changeFamily(id: ChangeFamilyId): ChangeFamily {
  const family = CHANGE_FAMILIES.find((f) => f.id === id);
  if (!family) throw new Error(`unknown change family: ${id}`);
  return family;
}

/** Where a planned query came from. */
export type QuerySourceKind = 'first_party' | 'change_family';

export interface PlannedQuery {
  query: string;
  kind: QuerySourceKind;
  /** Set for change-family queries. */
  family?: ChangeFamilyId;
  /** Set for first-party queries. */
  section?: string;
  /** Lower runs first. */
  priority: number;
}

/**
 * The distinguishing context appended to every query. A bare company name
 * collides with same-named businesses worldwide — the v1 run lost three of
 * seven companies that way. This is the first line of defence only; the
 * source-level identity gate is the one that must not be skipped.
 */
export function disambiguator(target: IdentityFingerprint): string {
  return (
    target.geography?.town ??
    target.geography?.region ??
    target.industry ??
    target.descriptors?.[0] ??
    target.geography?.country ??
    ''
  );
}

const tidy = (query: string) => query.replace(/\s+/g, ' ').trim();

/** One query per family: the family's terms OR'd together, plus disambiguation. */
export function familyQuery(target: IdentityFingerprint, family: ChangeFamily): string {
  const terms = family.terms.map((t) => (t.includes(' ') ? `"${t}"` : t)).join(' OR ');
  return tidy(`${target.canonicalName} ${disambiguator(target)} (${terms})`);
}

/**
 * The order families are queried in when the budget is smaller than the
 * catalogue.
 *
 * Ordering is a COST decision, not a scoring one: it decides which questions
 * get asked first, never what an answer is worth.
 *
 * It is the catalogue order within strength bands — strong families first —
 * and the client's own demand triggers deliberately do NOT reorder it. The
 * opposite was tried first, promoting families whose vocabulary matched
 * Orbital's stated triggers, and it pushed `major_contract` and `project`
 * below a small budget. Those are the two families that surface NMS's $427m
 * programme. A client's trigger list describes the changes they have already
 * thought of; the whole point of discovery is to reach the ones they have not.
 */
export function orderFamilies(_client: ClientProfile, families = CHANGE_FAMILIES): ChangeFamily[] {
  return families
    .map((family, index) => ({ family, index }))
    .sort(
      (a, b) =>
        (a.family.strength === 'strong' ? 0 : 1) - (b.family.strength === 'strong' ? 0 : 1) ||
        a.index - b.index,
    )
    .map((entry) => entry.family);
}

export interface QueryPlanOptions {
  /** Maximum change-family queries. First-party queries are counted separately. */
  familyBudget?: number;
  /** Restrict to these families. Defaults to all of them. */
  families?: ChangeFamilyId[];
}

/**
 * The change-family half of a company's query plan. The first-party half is
 * built in `first-party.ts` and always runs first.
 */
export function planFamilyQueries(
  target: IdentityFingerprint,
  client: ClientProfile,
  options: QueryPlanOptions = {},
): PlannedQuery[] {
  const allowed = options.families
    ? CHANGE_FAMILIES.filter((f) => options.families!.includes(f.id))
    : CHANGE_FAMILIES;

  const ordered = orderFamilies(client, allowed);
  const budget = options.familyBudget ?? ordered.length;

  return ordered.slice(0, Math.max(0, budget)).map((family, index) => ({
    query: familyQuery(target, family),
    kind: 'change_family' as const,
    family: family.id,
    priority: 100 + index,
  }));
}
