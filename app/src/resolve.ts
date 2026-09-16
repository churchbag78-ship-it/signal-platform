/**
 * Stage 6: a company mentioned in an article becomes an identity Signal can
 * research — or is refused.
 *
 * This is the inverse of the identity gate, and the audit found it was the one
 * capability nobody had noticed was missing. `attributeSource()` answers "is
 * this source about the company I named?". Nothing answered "which company is
 * this, and can I research it?". The existing code looked like it covered this
 * and did not: `IdentityFingerprint` appears throughout the engine and is never
 * once constructed — every occurrence is a parameter.
 *
 * Without this, a discovered candidate cannot enter the engine at all, because
 * the identity gate has nothing to gate against.
 *
 * The refusal is the important half. A fingerprint built on a guessed domain is
 * worse than no fingerprint: it passes the gate, attributes sources to the
 * wrong company, and produces a confident brief about a business that never had
 * the event. So a candidate with no domain is either resolved by evidence or
 * declined — never assumed.
 */

import type { IdentityFingerprint } from '../../engine/src/domain.ts';
import { normalizeDomain } from '../../engine/src/domain.ts';
import { compareNames } from '../../engine/src/identity.ts';
import type { SearchClient } from '../../engine/src/research/types.ts';
import type { CandidateMention } from './discovery.ts';

export type ResolutionStatus = 'resolved' | 'unresolvable' | 'ambiguous';

export interface Resolution {
  status: ResolutionStatus;
  candidate: CandidateMention;
  fingerprint?: IdentityFingerprint;
  /** How the domain was established. Provenance, not decoration. */
  basis?: 'stated_in_source' | 'confirmed_by_search';
  explanation: string;
  /** Domains considered and rejected, so an ambiguous case can be reviewed. */
  considered?: { domain: string; name: string; verdict: string }[];
}

/** Hosts that are never a company's own site. */
const NON_CORPORATE = [
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'youtube.com', 'wikipedia.org', 'crunchbase.com', 'bloomberg.com',
  'companieshouse.gov.uk', 'find-and-update.company-information.service.gov.uk',
  'endole.co.uk', 'opencorporates.com', 'zoominfo.com', 'apollo.io',
  'glassdoor.com', 'indeed.com', 'trustpilot.com', 'yell.com', 'google.com',
  'gov.uk', 'reuters.com', 'bbc.co.uk', 'theguardian.com', 'ft.com',
];

export function isCorporateHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return !NON_CORPORATE.some((bad) => host === bad || host.endsWith(`.${bad}`));
  } catch {
    return false;
  }
}

/**
 * Does this domain plausibly belong to this company?
 *
 * Deliberately strict. The cost of a wrong domain is a brief about the wrong
 * company; the cost of a refusal is one lost candidate.
 */
/** Words that carry no identity: they appear in half the company names there are. */
const NAME_NOISE = /\b(ltd|limited|plc|llp|group|holdings|uk|the|and|co|company|services|solutions)\b/g;

export function domainMatchesName(domain: string, companyName: string): boolean {
  const host = domain.replace(/^www\./, '').split('.')[0] ?? '';
  let hostTokens = host.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (hostTokens.length < 3) return false;

  // The same noise words are stripped from the host as from the name, so
  // "thephoenixgroup" and "Phoenix Group" reduce to the same thing while
  // "phoenixinsgrp" does not.
  hostTokens = hostTokens.replace(/^the/, '').replace(/(group|holdings|uk|ltd|plc)$/, '');
  if (hostTokens.length < 3) hostTokens = host.replace(/[^a-z0-9]/gi, '').toLowerCase();

  const nameTokens = companyName
    .toLowerCase()
    .replace(NAME_NOISE, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);

  if (nameTokens.length === 0) return false;

  const joined = nameTokens.join('');

  // A one-word name is the dangerous case, and a real run proved it.
  // "Phoenix Group" reduces to the single token "phoenix", which is a
  // substring of "phoenixinsgrp" — so a FTSE 100 UK life assurer resolved to
  // an unrelated insurance agency in Texas. A wrong identity is worse than no
  // identity: it passes the identity gate, attributes sources to the wrong
  // company, and produces a confident brief about a business that never had
  // the event. So a single-token name must MATCH the host, not merely appear
  // inside it.
  if (nameTokens.length === 1) return hostTokens === joined;

  if (hostTokens.includes(joined) || joined.includes(hostTokens)) return true;
  return nameTokens.every((token) => hostTokens.includes(token));
}

function fingerprintFor(candidate: CandidateMention, domain: string): IdentityFingerprint {
  const geography: IdentityFingerprint['geography'] = {};
  if (candidate.location) {
    // The model gives a free-text location; the town is the useful part and
    // the rest is kept verbatim rather than parsed into false precision.
    geography.town = candidate.location.split(',')[0]!.trim();
    if (candidate.location.includes(',')) {
      geography.region = candidate.location.split(',').slice(1).join(',').trim();
    }
  }

  return {
    canonicalName: candidate.companyName,
    canonicalDomain: normalizeDomain(domain),
    ...(Object.keys(geography).length > 0 ? { geography } : {}),
    ...(candidate.industryHint ? { industry: candidate.industryHint } : {}),
  };
}

export interface ResolveOptions {
  candidate: CandidateMention;
  /** Used only when the candidate carries no domain. Optional by design. */
  search?: SearchClient;
}

/**
 * Resolve one candidate.
 *
 * Path 1, the cheap one: the discovery step read a domain out of the source.
 * Accept it only if it is a corporate host AND the name matches it.
 *
 * Path 2: ask search for the company's own website and accept a result only on
 * the same two tests. Every rejected option is recorded so an ambiguous case
 * can be reviewed rather than silently lost.
 */
export async function resolveCandidate(options: ResolveOptions): Promise<Resolution> {
  const { candidate } = options;

  if (candidate.domain) {
    const url = `https://${candidate.domain}`;
    if (isCorporateHost(url) && domainMatchesName(candidate.domain, candidate.companyName)) {
      return {
        status: 'resolved',
        candidate,
        fingerprint: fingerprintFor(candidate, candidate.domain),
        basis: 'stated_in_source',
        explanation: `the source gives ${candidate.domain}, which matches the company name`,
      };
    }
  }

  if (!options.search) {
    return {
      status: 'unresolvable',
      candidate,
      explanation:
        candidate.domain
          ? `${candidate.domain} does not look like ${candidate.companyName}'s own website, and no search was available to confirm one`
          : 'no domain in the source and no search available to find one',
    };
  }

  const query = candidate.location
    ? `${candidate.companyName} ${candidate.location} official website`
    : `${candidate.companyName} official website`;

  let results;
  try {
    results = await options.search.search(query);
  } catch (error) {
    return {
      status: 'unresolvable',
      candidate,
      explanation: `could not search for this company's website: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const considered: { domain: string; name: string; verdict: string }[] = [];
  const accepted: { domain: string; title: string }[] = [];

  for (const result of results.slice(0, 10)) {
    let host: string;
    try {
      host = new URL(result.url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      continue;
    }
    if (considered.some((entry) => entry.domain === host)) continue;

    if (!isCorporateHost(result.url)) {
      considered.push({ domain: host, name: result.title, verdict: 'not a corporate website' });
      continue;
    }
    if (!domainMatchesName(host, candidate.companyName)) {
      considered.push({ domain: host, name: result.title, verdict: 'domain does not match the name' });
      continue;
    }
    // A last check on the page title, which usually carries the company name.
    const nameMatch = compareNames(candidate.companyName, result.title);
    if (nameMatch === 'none') {
      considered.push({ domain: host, name: result.title, verdict: 'page title names a different company' });
      continue;
    }

    considered.push({ domain: host, name: result.title, verdict: 'accepted' });
    accepted.push({ domain: host, title: result.title });
  }

  if (accepted.length === 1) {
    return {
      status: 'resolved',
      candidate,
      fingerprint: fingerprintFor(candidate, accepted[0]!.domain),
      basis: 'confirmed_by_search',
      explanation: `search confirms ${accepted[0]!.domain} as ${candidate.companyName}'s own website`,
      considered,
    };
  }

  if (accepted.length > 1) {
    return {
      status: 'ambiguous',
      candidate,
      explanation:
        `${accepted.length} different websites match "${candidate.companyName}" ` +
        `(${accepted.map((a) => a.domain).join(', ')}) — resolving to one of them would be a guess`,
      considered,
    };
  }

  return {
    status: 'unresolvable',
    candidate,
    explanation: `no website could be confirmed for "${candidate.companyName}"`,
    considered,
  };
}

export async function resolveAll(
  candidates: CandidateMention[],
  search?: SearchClient,
  onProgress?: (done: number, total: number) => void,
): Promise<Resolution[]> {
  const resolutions: Resolution[] = [];
  for (const [index, candidate] of candidates.entries()) {
    resolutions.push(await resolveCandidate({ candidate, ...(search ? { search } : {}) }));
    onProgress?.(index + 1, candidates.length);
  }
  return resolutions;
}
