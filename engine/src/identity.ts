/**
 * Company identity resolution.
 *
 * The live Pilot A run lost three of seven companies to name collisions:
 * "Bramble Group" returned Brambles Ltd (CHEP pallets, Australia), "NMS
 * International Group" returned a Chinese mining-equipment maker, and
 * "Slack & Parr" returned academic papers about organisational slack. Query
 * disambiguation reduces that, but it cannot be the only defence — a search
 * engine will always be able to hand back the wrong company.
 *
 * So identity is enforced at the SOURCE, not at the query: nothing enters the
 * evidence corpus until it has been attributed to the target fingerprint.
 *
 * The governing rule: **a matching company name is never sufficient on its
 * own.** Name plus a corroborating attribute is a match; name alone is
 * unresolved; name with a conflicting attribute is a collision.
 */

import type {
  AliasDomain,
  AliasVerification,
  Geography,
  IdentityFingerprint,
  IdentityVerdict,
  IsoDate,
  SourceAttribution,
} from './domain.ts';
import { normalizeDomain } from './domain.ts';

export type {
  AliasDomain,
  AliasVerification,
  Geography,
  IdentityFingerprint,
  IdentityVerdict,
  SourceAttribution,
};

// --- normalisation ---------------------------------------------------------

const LEGAL_SUFFIXES = new Set([
  'ltd', 'limited', 'plc', 'llp', 'llc', 'inc', 'incorporated', 'corp',
  'corporation', 'gmbh', 'bv', 'nv', 'sa', 'ag', 'pty', 'co', 'company',
  'group', 'holdings', 'holding', 'international', 'uk', 'usa', 'the',
]);

/** Tokens that carry identity, with legal noise and plurals removed. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[&.,'"()]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((token) => !LEGAL_SUFFIXES.has(token))
    // "Brambles" and "Bramble" must collide, not silently pass as different.
    .map((token) => (token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token));
}

export type NameMatch = 'exact' | 'strong' | 'weak' | 'none';

export function compareNames(target: string, candidate: string): NameMatch {
  const a = nameTokens(target);
  const b = nameTokens(candidate);
  if (a.length === 0 || b.length === 0) return 'none';

  const setA = new Set(a);
  const setB = new Set(b);
  const shared = [...setA].filter((t) => setB.has(t));
  if (shared.length === 0) return 'none';

  if (setA.size === setB.size && shared.length === setA.size) return 'exact';

  // One name contained in the other: "deVOL" within "deVOL Kitchens".
  if (shared.length === Math.min(setA.size, setB.size)) return 'strong';

  const jaccard = shared.length / (setA.size + setB.size - shared.length);
  return jaccard >= 0.5 ? 'strong' : 'weak';
}

function normaliseGeoToken(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'united kingdom',
  gb: 'united kingdom',
  'great britain': 'united kingdom',
  england: 'united kingdom',
  scotland: 'united kingdom',
  wales: 'united kingdom',
  us: 'united states',
  usa: 'united states',
  america: 'united states',
};

function canonicalCountry(value?: string): string {
  const raw = normaliseGeoToken(value);
  return COUNTRY_ALIASES[raw] ?? raw;
}

/** Do two industry/descriptor descriptions share any meaningful ground? */
function descriptorOverlap(a: string[], b: string[]): boolean {
  const tokensOf = (values: string[]) =>
    new Set(
      values
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 3),
    );

  const setA = tokensOf(a);
  const setB = tokensOf(b);
  if (setA.size === 0 || setB.size === 0) return true; // nothing to disagree about

  for (const token of setA) if (setB.has(token)) return true;
  return false;
}

/** Alias domains that actually count — unverified ones confer nothing. */
export function verifiedAliases(fingerprint: IdentityFingerprint): string[] {
  return (fingerprint.aliasDomains ?? [])
    .filter((alias) => alias.verifiedBy !== 'unverified')
    .map((alias) => normalizeDomain(alias.domain));
}

export function ownedDomains(fingerprint: IdentityFingerprint): string[] {
  return [normalizeDomain(fingerprint.canonicalDomain), ...verifiedAliases(fingerprint)].filter(
    Boolean,
  );
}

function hostOf(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return '';
  }
}

function domainBelongs(host: string, owned: string[]): boolean {
  return owned.some((own) => host === own || host.endsWith(`.${own}`));
}

// --- the matcher -----------------------------------------------------------

/**
 * Decides whether a source may speak for the target company.
 *
 * Ordering matters: a hard identifier (company number, owned domain) settles
 * it; otherwise conflicts are weighed before corroborations, so a
 * geography or industry clash beats a name that happens to line up.
 */
export function attributeSource(
  fingerprint: IdentityFingerprint,
  attribution: SourceAttribution,
): IdentityVerdict {
  const corroborations: string[] = [];
  const conflicts: string[] = [];

  // 1. Registry identifier — decisive either way.
  if (fingerprint.companyNumber && attribution.statedCompanyNumber) {
    if (
      fingerprint.companyNumber.replace(/\s/g, '').toUpperCase() ===
      attribution.statedCompanyNumber.replace(/\s/g, '').toUpperCase()
    ) {
      return {
        status: 'match',
        confidence: 0.99,
        corroborations: ['company number'],
        conflicts: [],
        explanation: 'registry identifier matches',
      };
    }
    conflicts.push(
      `company number ${attribution.statedCompanyNumber} is not ${fingerprint.companyNumber}`,
    );
  }

  // 2. Owned domain — publishing on the company's own verified domain.
  const owned = ownedDomains(fingerprint);
  const host = hostOf(attribution.url);
  const statedHost = attribution.statedDomain ? normalizeDomain(attribution.statedDomain) : '';

  if (host && domainBelongs(host, owned)) {
    corroborations.push(`published on owned domain ${host}`);
  }
  if (statedHost && domainBelongs(statedHost, owned)) {
    corroborations.push(`source names owned domain ${statedHost}`);
  }
  if (statedHost && !domainBelongs(statedHost, owned) && attribution.statedDomain) {
    // The source names a company website that is not one of ours.
    conflicts.push(`source attributes to domain ${statedHost}, not ${owned.join('/')}`);
  }

  if (conflicts.length === 0 && corroborations.length > 0) {
    return {
      status: 'match',
      confidence: 0.95,
      corroborations,
      conflicts,
      explanation: 'attributed by owned domain',
    };
  }

  // 3. Name, against canonical and trading names.
  const candidates = [fingerprint.canonicalName, ...(fingerprint.tradingNames ?? [])];
  let nameMatch: NameMatch = 'none';
  if (attribution.statedName) {
    for (const candidate of candidates) {
      const result = compareNames(candidate, attribution.statedName);
      if (result === 'exact' || (result === 'strong' && nameMatch !== 'exact')) nameMatch = result;
      else if (result === 'weak' && nameMatch === 'none') nameMatch = 'weak';
    }
  }

  // A source about a declared subsidiary speaks for this identity.
  if (attribution.statedName) {
    for (const subsidiary of fingerprint.subsidiaries ?? []) {
      if (compareNames(subsidiary, attribution.statedName) !== 'none') {
        corroborations.push(`names declared subsidiary "${subsidiary}"`);
        nameMatch = nameMatch === 'none' ? 'strong' : nameMatch;
      }
    }
  }

  // A source about the PARENT is not about this company.
  if (attribution.statedName && fingerprint.parent) {
    if (compareNames(fingerprint.parent, attribution.statedName) === 'exact') {
      return {
        status: 'unresolved',
        confidence: 0.2,
        corroborations: [],
        conflicts: [`source is about the parent company "${fingerprint.parent}"`],
        explanation:
          'a claim about the parent cannot be attributed to the subsidiary without further evidence',
      };
    }
  }

  // 4. Geography.
  const targetCountry = canonicalCountry(fingerprint.geography?.country);
  const statedCountry = canonicalCountry(attribution.statedGeography?.country);
  if (targetCountry && statedCountry) {
    if (targetCountry === statedCountry) corroborations.push('country agrees');
    else conflicts.push(`country ${statedCountry} conflicts with ${targetCountry}`);
  }

  const targetTown = normaliseGeoToken(fingerprint.geography?.town);
  const statedTown = normaliseGeoToken(attribution.statedGeography?.town);
  if (targetTown && statedTown) {
    if (targetTown === statedTown) corroborations.push('town agrees');
    else if (!targetCountry || !statedCountry || targetCountry === statedCountry) {
      // Different town in the same country is weaker evidence than a country
      // clash: companies have multiple sites.
      conflicts.push(`town ${statedTown} differs from ${targetTown}`);
    }
  }

  // 5. Industry and descriptors.
  const targetDescriptors = [fingerprint.industry, ...(fingerprint.descriptors ?? [])].filter(
    (d): d is string => Boolean(d),
  );
  const statedDescriptors = [
    attribution.statedIndustry,
    ...(attribution.statedDescriptors ?? []),
  ].filter((d): d is string => Boolean(d));

  if (targetDescriptors.length > 0 && statedDescriptors.length > 0) {
    if (descriptorOverlap(targetDescriptors, statedDescriptors)) {
      corroborations.push('industry/descriptors overlap');
    } else {
      conflicts.push(
        `industry "${statedDescriptors.join(', ')}" does not overlap "${targetDescriptors.join(', ')}"`,
      );
    }
  }

  // --- verdict -------------------------------------------------------------

  const strongConflicts = conflicts.filter(
    (c) => c.startsWith('country') || c.startsWith('industry') || c.startsWith('company number') || c.startsWith('source attributes to domain'),
  );

  if (nameMatch !== 'none' && strongConflicts.length > 0) {
    // The dangerous case: right name, wrong company.
    return {
      status: 'identity_collision',
      confidence: 0.9,
      corroborations,
      conflicts,
      explanation:
        'the name matches but a strong identity attribute conflicts — this is a different company',
    };
  }

  if (strongConflicts.length > 0) {
    return {
      status: 'identity_collision',
      confidence: 0.75,
      corroborations,
      conflicts,
      explanation: 'strong identity attributes conflict',
    };
  }

  if (nameMatch === 'none') {
    return {
      status: 'unresolved',
      confidence: 0.1,
      corroborations,
      conflicts,
      explanation: attribution.statedName
        ? `source names "${attribution.statedName}", which does not match the target`
        : 'source could not be attributed to any company',
    };
  }

  if (nameMatch === 'weak') {
    return {
      status: 'unresolved',
      confidence: 0.3,
      corroborations,
      conflicts,
      explanation: 'only a partial name resemblance, with nothing corroborating it',
    };
  }

  // Name matches. On its own that is NOT enough.
  if (corroborations.length === 0) {
    return {
      status: 'unresolved',
      confidence: 0.4,
      corroborations,
      conflicts,
      explanation:
        'name matches but nothing corroborates it — a matching name alone is never sufficient',
    };
  }

  const softConflicts = conflicts.length - strongConflicts.length;
  return {
    status: 'match',
    confidence: Math.min(0.9, 0.6 + corroborations.length * 0.1 - softConflicts * 0.1),
    corroborations,
    conflicts,
    explanation: `name matches and ${corroborations.length} attribute(s) corroborate it`,
  };
}

/**
 * Records an alias discovered during research. Returns null when the evidence
 * is too weak to accept — a similar-looking domain is not evidence.
 */
export function proposeAlias(
  candidateDomain: string,
  evidence: string,
  verifiedBy: AliasVerification,
  options: { sourceUrl?: string; verifiedAt?: IsoDate } = {},
): AliasDomain | null {
  const domain = normalizeDomain(candidateDomain);
  if (!domain) return null;
  if (verifiedBy === 'unverified') return null;
  if (!evidence.trim()) return null;

  return {
    domain,
    evidence,
    verifiedBy,
    ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
    ...(options.verifiedAt ? { verifiedAt: options.verifiedAt } : {}),
  };
}
