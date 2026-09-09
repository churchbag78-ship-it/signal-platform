/**
 * First-party source sweep.
 *
 * A company's own newsroom is where its changes are announced first, and it is
 * the most authoritative source for a claim about that company. The v4 engine
 * never looked at one: NMS's $427m Zambian health programme is on its own news
 * pages, and the engine returned `no_trigger_found`.
 *
 * The sweep runs BEFORE any change-family query, for every researched company,
 * and uses two channels because either can be unavailable:
 *
 *   1. DIRECT — fetch conventional first-party paths (/news, /press, /careers…)
 *      through the injected `PageRetriever`.
 *   2. SITE-SCOPED SEARCH — `site:domain news` style queries through the
 *      injected `SearchClient`, which reaches the same pages when direct
 *      retrieval is unavailable and also finds paths this file does not guess.
 *
 * Both channels are recorded. A section that could not be checked is reported
 * as unchecked, never as absent: "we could not look" and "there is nothing
 * there" are different statements and the history must keep them apart.
 *
 * IDENTITY: only the canonical domain and VERIFIED alias domains are swept. An
 * unverified alias confers nothing, here as everywhere else.
 */

import type { IdentityFingerprint } from '../domain.ts';
import { ownedDomains } from '../identity.ts';
import type { PageRetriever, RetrievedPage } from './retrieval.ts';
import type { SearchClient, SearchResult } from './types.ts';
import type { PlannedQuery } from './change-families.ts';

export type FirstPartySection =
  | 'newsroom'
  | 'press_releases'
  | 'announcements'
  | 'investors'
  | 'careers'
  | 'projects';

export interface FirstPartyPath {
  section: FirstPartySection;
  path: string;
}

/**
 * Conventional paths, most common first. Guessing paths is cheap and often
 * wrong, which is why the site-scoped search channel exists alongside it.
 */
export const FIRST_PARTY_PATHS: FirstPartyPath[] = [
  { section: 'newsroom', path: '/news' },
  { section: 'newsroom', path: '/newsroom' },
  { section: 'newsroom', path: '/blog' },
  { section: 'newsroom', path: '/journal' },
  { section: 'press_releases', path: '/press' },
  { section: 'press_releases', path: '/press-releases' },
  { section: 'press_releases', path: '/media' },
  { section: 'announcements', path: '/announcements' },
  { section: 'announcements', path: '/latest' },
  { section: 'investors', path: '/investors' },
  { section: 'investors', path: '/investor-relations' },
  { section: 'careers', path: '/careers' },
  { section: 'careers', path: '/jobs' },
  { section: 'careers', path: '/vacancies' },
  { section: 'projects', path: '/projects' },
  { section: 'projects', path: '/our-projects' },
  { section: 'projects', path: '/case-studies' },
];

/** The search vocabulary for each section, used for site-scoped queries. */
export const SECTION_QUERY_TERMS: Record<FirstPartySection, string> = {
  newsroom: 'news',
  press_releases: 'press release announcement',
  announcements: 'announcement',
  investors: 'investment funding',
  careers: 'careers jobs vacancies',
  projects: 'projects contract',
};

/** Sections swept for every company, in order. */
export const SWEPT_SECTIONS: FirstPartySection[] = [
  'newsroom',
  'press_releases',
  'announcements',
  'projects',
  'investors',
  'careers',
];

export interface FirstPartyCandidate {
  url: string;
  domain: string;
  section: FirstPartySection;
}

/** Candidate URLs on every domain the company is known to own. */
export function firstPartyCandidates(target: IdentityFingerprint): FirstPartyCandidate[] {
  const domains = ownedDomains(target);
  const candidates: FirstPartyCandidate[] = [];

  for (const domain of domains) {
    for (const { section, path } of FIRST_PARTY_PATHS) {
      candidates.push({ url: `https://${domain}${path}`, domain, section });
    }
  }
  return candidates;
}

/** Site-scoped search queries, one per swept section per owned domain. */
export function firstPartyQueries(
  target: IdentityFingerprint,
  sections: FirstPartySection[] = SWEPT_SECTIONS,
): PlannedQuery[] {
  const domains = ownedDomains(target);
  const queries: PlannedQuery[] = [];
  let priority = 0;

  for (const domain of domains) {
    for (const section of sections) {
      queries.push({
        query: `site:${domain} ${SECTION_QUERY_TERMS[section]}`,
        kind: 'first_party',
        section,
        priority: priority += 1,
      });
    }
  }
  return queries;
}

export type SweepOutcome = 'retrieved' | 'not_found' | 'unavailable';

export interface SweptPath {
  url: string;
  section: FirstPartySection;
  outcome: SweepOutcome;
  /** Why, when the outcome is not `retrieved`. */
  detail?: string;
}

export interface FirstPartySweep {
  /** Domains actually swept — canonical plus verified aliases only. */
  domains: string[];
  sections: FirstPartySection[];
  /** Direct-retrieval attempts. */
  paths: SweptPath[];
  /** Pages that came back. */
  pages: RetrievedPage[];
  /** Site-scoped queries actually executed. */
  queries: PlannedQuery[];
  /** Site-scoped queries the transport could not execute. */
  unexecuted: { query: string; reason: string }[];
  /** Results those queries returned. */
  results: SearchResult[];
  /** Sections for which at least one source was obtained, by either channel. */
  sectionsCovered: FirstPartySection[];
  /** Sections nothing could be checked for. Not the same as "nothing there". */
  sectionsUnchecked: FirstPartySection[];
  /** True when direct retrieval was unavailable for every path attempted. */
  retrievalBlocked: boolean;
  /** Total first-party sources obtained across both channels. */
  sourcesFound: number;
}

export interface SweepOptions {
  target: IdentityFingerprint;
  retriever: PageRetriever;
  search: SearchClient;
  sections?: FirstPartySection[];
  /** Cap on direct path fetches. Retrieval is the expensive channel. */
  maxPaths?: number;
}

/**
 * Sweep a company's own sources. Mandatory: every researched company gets one,
 * and its coverage is recorded whether or not anything was found.
 */
export async function sweepFirstParty(options: SweepOptions): Promise<FirstPartySweep> {
  const sections = options.sections ?? SWEPT_SECTIONS;
  const domains = ownedDomains(options.target);

  const candidates = firstPartyCandidates(options.target).filter((c) =>
    sections.includes(c.section),
  );
  const limited = candidates.slice(0, options.maxPaths ?? candidates.length);

  const paths: SweptPath[] = [];
  const pages: RetrievedPage[] = [];
  let attempted = 0;
  let unavailable = 0;

  for (const candidate of limited) {
    attempted += 1;
    const outcome = await options.retriever.retrieve(candidate.url);
    if (outcome.status === 'retrieved') {
      pages.push(outcome.page);
      paths.push({ url: candidate.url, section: candidate.section, outcome: 'retrieved' });
      continue;
    }
    // A retriever that cannot reach anything is a coverage failure, not a
    // finding. Distinguishing the two is the whole point of recording it:
    // `unavailable` means we could not look, `not_found` means we looked.
    const blocked = outcome.status === 'unavailable';
    if (blocked) unavailable += 1;
    paths.push({
      url: candidate.url,
      section: candidate.section,
      outcome: blocked ? 'unavailable' : 'not_found',
      detail: outcome.reason,
    });
  }

  const queries = firstPartyQueries(options.target, sections);
  const executed: PlannedQuery[] = [];
  const unexecuted: { query: string; reason: string }[] = [];
  const perQuery: { section: FirstPartySection; results: SearchResult[] }[] = [];
  const results: SearchResult[] = [];

  for (const planned of queries) {
    // A query the transport cannot execute is a coverage failure. Its section
    // stays UNCHECKED rather than being reported as empty — "we could not
    // look" must never read as "there is nothing there".
    try {
      const found = await options.search.search(planned.query);
      executed.push(planned);
      perQuery.push({ section: planned.section as FirstPartySection, results: found });
      results.push(...found);
    } catch (error) {
      unexecuted.push({
        query: planned.query,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const owned = new Set(domains);
  const isOwned = (url: string) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      return owned.has(host);
    } catch {
      return false;
    }
  };

  // A section counts as covered only when ITS OWN query returned a source on a
  // domain the company owns. A hit from another section's query proves nothing
  // about this one.
  const coveredBySearch = new Set<FirstPartySection>();
  for (const { section, results: found } of perQuery) {
    if (found.some((r) => isOwned(r.url))) coveredBySearch.add(section);
  }

  const coveredByPath = new Set(
    paths.filter((p) => p.outcome === 'retrieved').map((p) => p.section),
  );
  const sectionsCovered = sections.filter(
    (s) => coveredByPath.has(s) || coveredBySearch.has(s),
  );

  return {
    domains,
    sections,
    paths,
    pages,
    queries: executed,
    unexecuted,
    results,
    sectionsCovered,
    sectionsUnchecked: sections.filter((s) => !sectionsCovered.includes(s)),
    retrievalBlocked: attempted > 0 && unavailable === attempted,
    sourcesFound: pages.length + results.filter((r) => isOwned(r.url)).length,
  };
}
