/**
 * Source classification — URL to tier and type.
 *
 * Deliberately conservative: an unrecognised host is treated as an aggregator
 * (tier 4), not as trade press. In an evidence product the cost of
 * over-trusting an unknown source is much higher than the cost of
 * under-scoring a good one, and an under-scored row is visible in the output
 * where an over-trusted one is not.
 */

import type { Source, SourceTier } from '../domain.ts';
import { normalizeDomain } from '../domain.ts';

export type SourceType =
  | 'first_party'
  | 'public_record'
  | 'trade_press'
  | 'news'
  | 'aggregator'
  | 'social'
  | 'unknown';

export interface Classification {
  tier: SourceTier;
  type: SourceType;
  publisher: string;
  /** True when the host was not recognised and the tier is a safe default. */
  needsReview: boolean;
}

const PUBLIC_RECORD_SUFFIXES = ['.gov.uk', '.gov', '.gov.scot', '.gov.wales', '.europa.eu'];

const PUBLIC_RECORD_HOSTS = new Set([
  'find-and-update.company-information.service.gov.uk',
  'companieshouse.gov.uk',
  'contractsfinder.service.gov.uk',
  'ted.europa.eu',
]);

const TRADE_PRESS = new Set([
  'thebusinessdesk.com',
  'insidermedia.com',
  'themanufacturer.com',
  'eastmidlandsbusinesslink.co.uk',
  'lovebusinesseastmidlands.com',
  'grocerygazette.co.uk',
  'confectioneryproduction.com',
  'knittingindustry.com',
  'innovationintextiles.com',
  'machinery.co.uk',
  'machinery-market.co.uk',
  'sheetmetalindustries.com',
  'welding-world.com',
  'logisticsmatters.co.uk',
  'retail-systems.com',
  'kbbreview.com',
  'pesmedia.com',
  'mpemagazine.co.uk',
  'insidefoodanddrink.com',
  'industrialnews.co.uk',
  'mfg-outlook.com',
]);

const NEWS = new Set([
  'bbc.co.uk',
  'ft.com',
  'theguardian.com',
  'telegraph.co.uk',
  'motorcyclenews.com',
  'leicestermercury.co.uk',
  'harboroughfm.co.uk',
]);

const AGGREGATORS = new Set([
  'crunchbase.com',
  'zoominfo.com',
  'pitchbook.com',
  'dnb.com',
  'cbinsights.com',
  'bloomberg.com',
  'yell.com',
  'cylex-uk.co.uk',
  '1stdirectory.co.uk',
  'importyeti.com',
  'theorg.com',
  'dealroom.co',
  'companycheck.co.uk',
  'insolvencyintel.co.uk',
  'wheree.com',
  'houzz.co.uk',
  'britaine.co.uk',
]);

const SOCIAL = new Set([
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'youtube.com',
  'tiktok.com',
]);

/** Local-authority and public-body hosts that publish primary announcements. */
const PUBLIC_BODY_PATTERN = /(^|\.)(gov|council|nhs|police)\./;

function hostOf(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return normalizeDomain(url);
  }
}

function matchesSet(host: string, set: Set<string>): boolean {
  if (set.has(host)) return true;
  // Match subdomains: news.example.com against example.com.
  return [...set].some((entry) => host.endsWith(`.${entry}`));
}

/**
 * @param ownedDomains every domain the company is known to own — its canonical
 * domain plus VERIFIED aliases. Unverified aliases must never be passed here:
 * a similar-looking domain is not evidence of ownership.
 */
export function classifySource(
  url: string,
  ownedDomains: string[] = [],
): Classification {
  const host = hostOf(url);

  if (!host) {
    return { tier: 5, type: 'unknown', publisher: 'unknown', needsReview: true };
  }

  for (const candidate of ownedDomains) {
    const own = normalizeDomain(candidate);
    if (own && (host === own || host.endsWith(`.${own}`))) {
      return { tier: 1, type: 'first_party', publisher: host, needsReview: false };
    }
  }

  if (
    PUBLIC_RECORD_HOSTS.has(host) ||
    PUBLIC_RECORD_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    PUBLIC_BODY_PATTERN.test(host)
  ) {
    return { tier: 2, type: 'public_record', publisher: host, needsReview: false };
  }

  if (matchesSet(host, TRADE_PRESS)) {
    return { tier: 3, type: 'trade_press', publisher: host, needsReview: false };
  }
  if (matchesSet(host, NEWS)) {
    return { tier: 3, type: 'news', publisher: host, needsReview: false };
  }
  if (matchesSet(host, AGGREGATORS)) {
    return { tier: 4, type: 'aggregator', publisher: host, needsReview: false };
  }
  if (matchesSet(host, SOCIAL)) {
    return { tier: 5, type: 'social', publisher: host, needsReview: false };
  }

  return { tier: 4, type: 'unknown', publisher: host, needsReview: true };
}

export function toSource(
  url: string,
  ownedDomains: string[] = [],
  originId?: string,
): Source {
  const classification = classifySource(url, ownedDomains);
  return {
    url,
    tier: classification.tier,
    publisher: classification.publisher,
    ...(originId ? { originId } : {}),
  };
}
