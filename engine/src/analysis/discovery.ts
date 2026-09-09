/**
 * Discovery measurement — kept separate from downstream precision.
 *
 * These are different failures with different fixes, and one number hides
 * both. A signal the engine never found is a discovery failure; a signal it
 * found and then judged wrongly is not. v4 scored 75% precision while missing
 * the best opportunity in the corpus, because precision only counts what was
 * put in front of a salesperson.
 *
 * DISCOVERY RECALL asks: of the companies the gold set says have a genuine
 * opportunity, for how many did the engine surface a commercial signal at all
 * — whatever happened to it afterwards?
 */

import type { GoldEntry } from '../../benchmark/gold-set.ts';
import type { ChangeFamilyId } from '../research/change-families.ts';
import type { FirstPartySection } from '../research/first-party.ts';
import type { ResearchCoverage, ResearchState } from '../research/history.ts';
import { isGenuineNegative } from '../research/history.ts';
import { isGenuineOpportunity } from './evaluation.ts';

/**
 * Stages a company can only reach if discovery already succeeded — a change
 * was found and a claim chain was built for it. A rejection here is a
 * downstream JUDGEMENT on a discovered signal, not a failure to find one.
 */
export const POST_DISCOVERY_STAGES = [
  'identity',
  'identity_collision',
  'identity_unresolved',
  'stale',
  'contradiction',
  'invalid_chain',
  'invalid_claims',
  'insufficient_evidence',
  'no_commercial_consequence',
];

/** What discovery did for one company, whatever the downstream verdict. */
export interface DiscoveryOutcome {
  domain: string;
  company: string;
  /** Terminal research state for this company in this run. */
  state: ResearchState;
  /**
   * True when a commercial change was found and reached the downstream
   * pipeline — including when the pipeline then rejected it. This is the
   * discovery question. Whether the rejection was right is a separate one.
   */
  changeFound: boolean;
  /** True when a signal survived the pipeline as far as scoring. */
  signalDiscovered: boolean;
  /** Rejection stage, when the company produced no signal. */
  rejectedAt?: string;
  coverage: ResearchCoverage;
  /** Sources whose identity gate rejected them, by verdict. */
  identityRejections: { url: string; status: string }[];
}

export interface DiscoveryMetrics {
  companiesInUniverse: number;
  companiesResearched: number;
  companiesPrescreened: number;
  queriesTotal: number;
  queriesFirstParty: number;
  queriesChangeFamily: number;
  queriesByFamily: Record<string, number>;
  familiesCovered: number;
  firstPartySourcesChecked: number;
  firstPartySectionsCovered: Record<string, number>;
  firstPartySectionsUnchecked: Record<string, number>;
  firstPartyRetrievalBlocked: number;
  sourcesSeen: number;
  changesFound: number;
  signalsDiscovered: number;
  identityCollisions: number;
  identityUnresolved: number;
  staleSignals: number;
  contradictionRejections: number;
  genuineNegativesRetained: number;
  researchFailures: number;
}

export function discoveryMetrics(
  outcomes: DiscoveryOutcome[],
  prescreened: number,
  universeSize: number,
): DiscoveryMetrics {
  const queriesByFamily: Record<string, number> = {};
  const covered: Record<string, number> = {};
  const unchecked: Record<string, number> = {};

  let firstPartyQueries = 0;
  let familyQueries = 0;
  let firstPartySources = 0;
  let blocked = 0;
  let sourcesSeen = 0;

  for (const outcome of outcomes) {
    for (const family of outcome.coverage.familiesChecked) {
      queriesByFamily[family] = (queriesByFamily[family] ?? 0) + 1;
    }
    // Counted from the plan, not from family attribution: the legacy template
    // strategy produces queries that belong to no family, and they still cost
    // a search call.
    familyQueries += outcome.coverage.queriesRun.length - outcome.coverage.firstPartyQueriesRun;
    for (const section of outcome.coverage.firstPartySectionsCovered) {
      covered[section] = (covered[section] ?? 0) + 1;
    }
    for (const section of outcome.coverage.firstPartySectionsUnchecked) {
      unchecked[section] = (unchecked[section] ?? 0) + 1;
    }
    firstPartyQueries += outcome.coverage.firstPartyQueriesRun;
    firstPartySources += outcome.coverage.firstPartySourcesFound;
    if (outcome.coverage.retrievalBlocked) blocked += 1;
    sourcesSeen += outcome.coverage.sourcesSeen;
  }

  const countState = (state: ResearchState) =>
    outcomes.filter((o) => o.state === state).length;

  return {
    companiesInUniverse: universeSize,
    companiesResearched: outcomes.filter((o) => o.coverage.queriesRun.length > 0).length,
    companiesPrescreened: prescreened,
    queriesTotal: firstPartyQueries + familyQueries,
    queriesFirstParty: firstPartyQueries,
    queriesChangeFamily: familyQueries,
    queriesByFamily,
    familiesCovered: Object.keys(queriesByFamily).length,
    firstPartySourcesChecked: firstPartySources,
    firstPartySectionsCovered: covered,
    firstPartySectionsUnchecked: unchecked,
    firstPartyRetrievalBlocked: blocked,
    sourcesSeen,
    changesFound: outcomes.filter((o) => o.changeFound).length,
    signalsDiscovered: outcomes.filter((o) => o.signalDiscovered).length,
    identityCollisions: outcomes.reduce(
      (sum, o) =>
        sum + o.identityRejections.filter((r) => r.status === 'identity_collision').length,
      0,
    ),
    identityUnresolved: countState('identity_unresolved'),
    staleSignals: outcomes.filter((o) => o.rejectedAt === 'stale').length,
    contradictionRejections: outcomes.filter((o) => o.rejectedAt === 'contradiction').length,
    genuineNegativesRetained: outcomes.filter((o) => isGenuineNegative(o.state)).length,
    researchFailures: countState('research_failure'),
  };
}

export interface DiscoveryRecall {
  /** Gold entries with a genuine opportunity (labels A and B). */
  opportunities: number;
  /** Of those, how many produced a change that reached the pipeline. */
  discovered: number;
  /** Of those, how many survived the pipeline as far as scoring. */
  scored: number;
  recall: number;
  /** Opportunities that produced no signal, with the state that explains it. */
  missed: { company: string; state: ResearchState; rejectedAt?: string }[];
  /**
   * Signals discovered for companies the gold set does NOT call an
   * opportunity. A false discovery is not yet a false positive — the
   * downstream pipeline may still reject it — so the two are counted apart.
   */
  falseDiscoveries: { company: string; label: string }[];
}

export function discoveryRecall(
  gold: GoldEntry[],
  outcomes: DiscoveryOutcome[],
): DiscoveryRecall {
  const byDomain = new Map(outcomes.map((o) => [o.domain.toLowerCase(), o]));
  const wanted = gold.filter((g) => isGenuineOpportunity(g.label));

  const missed: DiscoveryRecall['missed'] = [];
  let discovered = 0;

  let scored = 0;
  for (const entry of wanted) {
    const outcome = byDomain.get(entry.domain.toLowerCase());
    if (outcome?.changeFound) {
      discovered += 1;
      if (outcome.signalDiscovered) scored += 1;
      continue;
    }
    missed.push({
      company: entry.company,
      state: outcome?.state ?? 'not_researched',
      ...(outcome?.rejectedAt ? { rejectedAt: outcome.rejectedAt } : {}),
    });
  }

  const falseDiscoveries = gold
    .filter((g) => !isGenuineOpportunity(g.label))
    .filter((g) => byDomain.get(g.domain.toLowerCase())?.changeFound)
    .map((g) => ({ company: g.company, label: g.label }));

  return {
    opportunities: wanted.length,
    discovered,
    scored,
    recall: wanted.length === 0 ? 0 : discovered / wanted.length,
    missed,
    falseDiscoveries,
  };
}

/**
 * Signals a previous run missed that this one found.
 *
 * Takes the previous run's outcomes rather than a hard-coded list, so it
 * measures recovery generally instead of checking for one company.
 */
export function recoveredSignals(
  previous: DiscoveryOutcome[],
  current: DiscoveryOutcome[],
): { company: string; previousState: ResearchState; nowRejectedAt?: string; reported: boolean }[] {
  const before = new Map(previous.map((o) => [o.domain.toLowerCase(), o]));

  return current
    .filter((o) => o.changeFound && before.get(o.domain.toLowerCase())?.changeFound === false)
    .map((o) => ({
      company: o.company,
      previousState: before.get(o.domain.toLowerCase())!.state,
      ...(o.rejectedAt ? { nowRejectedAt: o.rejectedAt } : {}),
      reported: o.signalDiscovered,
    }));
}

/** Research cost, in the units the provider ledger already speaks. */
export interface DiscoveryCost {
  searchCalls: number;
  pageRetrievals: number;
  credits: number;
  currency: number;
}

export function discoveryCost(
  outcomes: DiscoveryOutcome[],
  costPerSearch = 0,
  costPerRetrieval = 0,
): DiscoveryCost {
  const searchCalls = outcomes.reduce((sum, o) => sum + o.coverage.queriesRun.length, 0);
  const pageRetrievals = outcomes.reduce(
    (sum, o) => sum + o.coverage.firstPartyPathsAttempted,
    0,
  );
  return {
    searchCalls,
    pageRetrievals,
    credits: searchCalls * costPerSearch + pageRetrievals * costPerRetrieval,
    currency: 0,
  };
}

export type { ChangeFamilyId, FirstPartySection };
