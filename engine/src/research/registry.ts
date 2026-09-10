/**
 * Source registry.
 *
 * The v1/v2 runs showed the cost of a bare allow-list: an unrecognised host
 * defaults to tier 4, which is safe but was suppressing legitimate evidence —
 * Bramble Group fell from 63 to 50 purely because two real publishers were not
 * listed.
 *
 * Two rules shape this registry:
 *
 * 1. **No domain is universally authoritative.** Authority is scoped to the
 *    kind of claim being established. A recruitment site is excellent evidence
 *    that a company is hiring warehouse staff and poor evidence that it won a
 *    contract. A private equity house is authoritative about its own portfolio
 *    and not about the wider market. So each entry declares what it is
 *    authoritative FOR, and carries a lower tier outside that scope.
 *
 * 2. **Unknown stays conservative.** An unrecognised host is still tier 4 and
 *    still flagged for review. Growing the registry is how coverage improves —
 *    never by promoting the unknown default.
 *
 * Every entry carries provenance so a classification can be audited: who added
 * it, when, and on what evidence.
 */

import type { IsoDate, SourceTier } from '../domain.ts';
import { normalizeDomain } from '../domain.ts';

export type SourceCategory =
  | 'first_party'
  | 'official_registry'
  | 'government'
  | 'local_authority_planning'
  | 'news'
  | 'trade_press'
  | 'industry_body'
  | 'investment'
  | 'property_logistics'
  | 'recruitment'
  | 'aggregator'
  | 'social'
  | 'unknown';

/**
 * What a claim is about. Authority is judged per topic, because credibility
 * does not transfer across subject matter.
 */
export type ClaimTopic =
  | 'corporate_identity'
  | 'financials'
  | 'funding'
  | 'contract_win'
  | 'premises'
  | 'hiring'
  | 'leadership'
  | 'export_trade'
  | 'product'
  | 'restructuring'
  | 'regulatory'
  | 'general';

export interface RegistryProvenance {
  addedAt: IsoDate;
  addedBy: string;
  /** Why this classification is justified. Never omitted. */
  evidence: string;
}

export interface RegistryEntry {
  domain: string;
  category: SourceCategory;
  /** Tier for claims inside this source's competence. */
  tier: SourceTier;
  /** Topics this source is authoritative for. Empty means general reporting. */
  authoritativeFor: ClaimTopic[];
  /** Tier for claims outside that competence — always weaker. */
  outOfScopeTier: SourceTier;
  provenance: RegistryProvenance;
}

const ADDED: RegistryProvenance = {
  addedAt: '2026-09-09',
  addedBy: 'pilot-a-registry-expansion',
  evidence: 'observed publishing this material during Pilot A live research',
};

function entry(
  domain: string,
  category: SourceCategory,
  tier: SourceTier,
  authoritativeFor: ClaimTopic[],
  outOfScopeTier: SourceTier,
  evidence: string,
): RegistryEntry {
  return {
    domain,
    category,
    tier,
    authoritativeFor,
    outOfScopeTier,
    provenance: { ...ADDED, evidence },
  };
}

/** Public bodies and registries — authoritative for what they administer. */
const OFFICIAL: RegistryEntry[] = [
  entry(
    'find-and-update.company-information.service.gov.uk',
    'official_registry',
    2,
    ['corporate_identity', 'financials', 'leadership'],
    3,
    'Companies House — the statutory register of UK company identity, officers and filings',
  ),
  entry(
    'contractsfinder.service.gov.uk',
    'official_registry',
    2,
    ['contract_win', 'regulatory'],
    3,
    'UK public procurement notices — the primary record of public contract awards',
  ),
  entry(
    'find-tender.service.gov.uk',
    'official_registry',
    2,
    ['contract_win', 'regulatory'],
    3,
    'UK Find a Tender service — high-value public procurement notices',
  ),
  entry(
    'ted.europa.eu',
    'official_registry',
    2,
    ['contract_win', 'regulatory'],
    3,
    'EU tenders database',
  ),
  entry(
    'gov.uk',
    'government',
    2,
    ['funding', 'export_trade', 'regulatory', 'contract_win'],
    3,
    'UK government announcements including UK Export Finance facilities',
  ),
];

/** Local authorities: primary for planning and their own developments. */
const LOCAL_AUTHORITY: RegistryEntry[] = [
  entry(
    'leicestershire.gov.uk',
    'local_authority_planning',
    2,
    ['premises', 'regulatory'],
    3,
    'county council; developer and landlord of Airfield Business Park, so primary for that site',
  ),
];

const TRADE_PRESS: RegistryEntry[] = [
  entry('themanufacturer.com', 'trade_press', 3, ['funding', 'premises', 'product', 'export_trade'], 4, 'UK manufacturing trade title'),
  entry('thebusinessdesk.com', 'trade_press', 3, ['funding', 'premises', 'leadership', 'restructuring'], 4, 'regional UK business news desk'),
  entry('insidermedia.com', 'trade_press', 3, ['funding', 'premises', 'leadership', 'restructuring'], 4, 'regional UK business title'),
  entry('eastmidlandsbusinesslink.co.uk', 'trade_press', 3, ['funding', 'premises', 'restructuring'], 4, 'East Midlands business title'),
  entry('lovebusinesseastmidlands.com', 'trade_press', 3, ['premises', 'funding'], 4, 'East Midlands business title'),
  entry('grocerygazette.co.uk', 'trade_press', 3, ['premises', 'product'], 4, 'grocery retail trade title'),
  entry('confectioneryproduction.com', 'trade_press', 3, ['product', 'premises'], 4, 'confectionery manufacturing trade title'),
  entry('foodanddrinktechnology.com', 'trade_press', 3, ['product', 'premises', 'funding'], 4, 'food and drink manufacturing trade title; carried the Bramble acquisition reporting'),
  entry('insidefoodanddrink.com', 'trade_press', 3, ['product', 'premises'], 4, 'food and drink trade title'),
  entry('foodmanufacture.co.uk', 'trade_press', 3, ['product', 'premises', 'funding'], 4, 'UK food manufacturing trade title'),
  entry('knittingindustry.com', 'trade_press', 3, ['product', 'export_trade', 'funding'], 4, 'technical textiles trade title; carried the Baltex Boeing/US reporting'),
  entry('innovationintextiles.com', 'trade_press', 3, ['product', 'export_trade'], 4, 'technical textiles trade title'),
  entry('kbbreview.com', 'trade_press', 3, ['product', 'premises'], 4, 'kitchen, bedroom and bathroom trade title'),
  entry('kbbfocus.com', 'trade_press', 3, ['product', 'export_trade'], 4, 'kitchen industry trade title; carried the deVOL King\'s Award reporting'),
  entry('machinery.co.uk', 'trade_press', 3, ['product'], 4, 'engineering machinery trade title'),
  entry('machinery-market.co.uk', 'trade_press', 3, ['product'], 4, 'machinery trade title'),
  entry('sheetmetalindustries.com', 'trade_press', 3, ['product'], 4, 'sheet metal trade title'),
  entry('welding-world.com', 'trade_press', 3, ['product', 'leadership'], 4, 'welding and fabrication trade title'),
  entry('pesmedia.com', 'trade_press', 3, ['product'], 4, 'production engineering trade title'),
  entry('mpemagazine.co.uk', 'trade_press', 3, ['product'], 4, 'manufacturing and production engineering title'),
  entry('mtdcnc.com', 'trade_press', 3, ['product'], 4, 'machine tool trade title'),
  entry('industrialnews.co.uk', 'trade_press', 3, ['funding', 'product'], 4, 'industrial sector news'),
  entry('mfg-outlook.com', 'trade_press', 3, ['product', 'corporate_identity'], 4, 'manufacturing company profiles'),
  entry('emeoutlookmag.com', 'trade_press', 3, ['corporate_identity'], 4, 'EME business profiles'),
  entry('thepack.news', 'trade_press', 3, ['funding', 'product'], 4, 'electric two-wheeler trade title'),
  entry('logisticsmatters.co.uk', 'trade_press', 3, ['premises'], 4, 'logistics trade title'),
  entry('retail-systems.com', 'trade_press', 3, ['premises', 'product'], 4, 'retail technology trade title'),
  entry('manufacturing-today.com', 'trade_press', 3, ['corporate_identity', 'product'], 4, 'manufacturing profiles'),
];

const NEWS: RegistryEntry[] = [
  entry('bbc.co.uk', 'news', 3, ['general', 'restructuring', 'premises'], 3, 'national broadcaster'),
  entry('ft.com', 'news', 3, ['financials', 'funding', 'restructuring'], 3, 'national financial daily'),
  entry('theguardian.com', 'news', 3, ['general', 'restructuring'], 3, 'national newspaper'),
  entry('telegraph.co.uk', 'news', 3, ['general', 'financials'], 3, 'national newspaper'),
  entry('motorcyclenews.com', 'news', 3, ['product', 'export_trade'], 4, 'specialist motorcycle title; carried the Maeving UKEF reporting'),
  entry('bmmagazine.co.uk', 'news', 3, ['funding'], 4, 'UK small business news'),
  entry('dofonline.co.uk', 'news', 3, ['funding', 'financials'], 4, 'finance director trade news'),
  entry('leicestermercury.co.uk', 'news', 3, ['general', 'premises'], 4, 'Leicestershire regional daily'),
  entry('harboroughmail.co.uk', 'news', 3, ['general', 'premises'], 4, 'Market Harborough local newspaper'),
  entry('harboroughfm.co.uk', 'news', 3, ['general', 'premises'], 4, 'Market Harborough local radio'),
  entry('scottishfinancialnews.com', 'news', 3, ['funding', 'restructuring'], 4, 'Scottish financial news'),
];

/**
 * Investors and advisers: primary about their own portfolio and transactions,
 * promotional elsewhere.
 */
const INVESTMENT: RegistryEntry[] = [
  entry(
    'ldc.co.uk',
    'investment',
    2,
    ['funding', 'premises', 'corporate_identity'],
    4,
    'private equity house; primary source about its own portfolio company Bramble Group',
  ),
  entry('avingtrans.plc.uk', 'investment', 2, ['funding', 'corporate_identity', 'restructuring'], 4, 'listed acquirer; primary about its own acquisitions'),
  entry('interpath.com', 'investment', 2, ['restructuring'], 4, 'insolvency practitioner; primary about administrations it handles'),
  entry('investegate.co.uk', 'official_registry', 2, ['funding', 'financials', 'restructuring'], 3, 'UK regulatory news service announcements'),
];

/** Property and logistics: primary for premises, weak for anything else. */
const PROPERTY: RegistryEntry[] = [
  entry(
    'matherjamie.co.uk',
    'property_logistics',
    3,
    ['premises'],
    4,
    'Leicestershire commercial property agent; primary for transactions it brokered',
  ),
  entry('eddisons.com', 'property_logistics', 3, ['premises'], 4, 'commercial property agent'),
];

const INDUSTRY_BODIES: RegistryEntry[] = [
  entry('midlandsaerospace.org.uk', 'industry_body', 3, ['premises', 'product'], 4, 'Midlands Aerospace Alliance'),
  entry('emc-dnl.co.uk', 'industry_body', 3, ['export_trade', 'general'], 4, 'East Midlands Chamber of Commerce'),
  entry('makeuk.org', 'industry_body', 3, ['general', 'regulatory'], 4, 'UK manufacturers organisation'),
];

/** Job boards: strong evidence of hiring, no authority on anything else. */
const RECRUITMENT: RegistryEntry[] = [
  entry('findajob.dwp.gov.uk', 'recruitment', 2, ['hiring'], 4, 'government job service; primary evidence of advertised vacancies'),
  entry('indeed.com', 'recruitment', 3, ['hiring'], 5, 'job board; evidence of advertised vacancies only'),
  entry('totaljobs.com', 'recruitment', 3, ['hiring'], 5, 'job board'),
  entry('cv-library.co.uk', 'recruitment', 3, ['hiring'], 5, 'job board'),
  entry('reed.co.uk', 'recruitment', 3, ['hiring'], 5, 'job board'),
];

const AGGREGATORS: RegistryEntry[] = [
  entry('crunchbase.com', 'aggregator', 4, ['corporate_identity'], 5, 'company directory; identity only, frequently stale'),
  entry('zoominfo.com', 'aggregator', 4, ['corporate_identity'], 5, 'contact and company directory'),
  entry('pitchbook.com', 'aggregator', 4, ['corporate_identity', 'funding'], 5, 'private markets database'),
  entry('dnb.com', 'aggregator', 4, ['corporate_identity'], 5, 'business directory'),
  entry('cbinsights.com', 'aggregator', 4, ['corporate_identity'], 5, 'market intelligence database'),
  entry('bloomberg.com', 'aggregator', 4, ['corporate_identity'], 5, 'company profile pages (distinct from Bloomberg News reporting)'),
  entry('uk.globaldatabase.com', 'aggregator', 4, ['corporate_identity', 'financials'], 5, 'company database'),
  entry('companycheck.co.uk', 'aggregator', 4, ['corporate_identity', 'financials'], 5, 'filings reseller'),
  entry('insolvencyintel.co.uk', 'aggregator', 4, ['restructuring'], 5, 'insolvency notices reseller'),
  entry('leadiq.com', 'aggregator', 4, ['corporate_identity'], 5, 'sales contact database'),
  entry('tracxn.com', 'aggregator', 4, ['corporate_identity'], 5, 'company database'),
  entry('dealroom.co', 'aggregator', 4, ['funding'], 5, 'funding database'),
  entry('app.dealroom.co', 'aggregator', 4, ['funding'], 5, 'funding database'),
  entry('konaequity.com', 'aggregator', 4, ['corporate_identity'], 5, 'company database'),
  entry('growjo.com', 'aggregator', 4, ['corporate_identity'], 5, 'growth estimates database'),
  entry('incfact.com', 'aggregator', 4, ['corporate_identity'], 5, 'company database'),
  entry('importyeti.com', 'aggregator', 4, ['export_trade'], 5, 'shipping manifest aggregator'),
  entry('importgenius.com', 'aggregator', 4, ['export_trade'], 5, 'shipping manifest aggregator'),
  entry('yell.com', 'aggregator', 4, ['corporate_identity'], 5, 'business directory'),
  entry('cylex-uk.co.uk', 'aggregator', 4, ['corporate_identity'], 5, 'business directory'),
  entry('1stdirectory.co.uk', 'aggregator', 4, ['corporate_identity'], 5, 'business directory'),
  entry('theorg.com', 'aggregator', 4, ['leadership'], 5, 'org chart aggregator, user-contributed'),
  entry('umbrex.com', 'aggregator', 4, ['corporate_identity'], 5, 'consulting company profiles'),
  entry('approvedbusiness.co.uk', 'aggregator', 4, ['corporate_identity'], 5, 'business directory'),
];

const SOCIAL: RegistryEntry[] = [
  entry('linkedin.com', 'social', 5, ['hiring', 'leadership'], 5, 'self-published professional profiles'),
  entry('facebook.com', 'social', 5, [], 5, 'self-published social profiles'),
  entry('twitter.com', 'social', 5, [], 5, 'self-published social posts'),
  entry('x.com', 'social', 5, [], 5, 'self-published social posts'),
  entry('instagram.com', 'social', 5, [], 5, 'self-published social posts'),
  entry('youtube.com', 'social', 5, [], 5, 'self-published video'),
];

export const SOURCE_REGISTRY: RegistryEntry[] = [
  ...OFFICIAL,
  ...LOCAL_AUTHORITY,
  ...TRADE_PRESS,
  ...NEWS,
  ...INVESTMENT,
  ...PROPERTY,
  ...INDUSTRY_BODIES,
  ...RECRUITMENT,
  ...AGGREGATORS,
  ...SOCIAL,
];

const BY_DOMAIN = new Map(SOURCE_REGISTRY.map((e) => [e.domain, e]));

/** Government and public-body hosts not enumerated individually. */
const PUBLIC_SUFFIXES = ['.gov.uk', '.gov', '.gov.scot', '.gov.wales', '.europa.eu'];
const PUBLIC_BODY_PATTERN = /(^|\.)(gov|council|nhs|police)\./;

export function lookupRegistry(host: string): RegistryEntry | null {
  const normalised = normalizeDomain(host);
  const exact = BY_DOMAIN.get(normalised);
  if (exact) return exact;

  for (const candidate of SOURCE_REGISTRY) {
    if (normalised.endsWith(`.${candidate.domain}`)) return candidate;
  }

  if (
    PUBLIC_SUFFIXES.some((suffix) => normalised.endsWith(suffix)) ||
    PUBLIC_BODY_PATTERN.test(normalised)
  ) {
    return {
      domain: normalised,
      category: 'government',
      tier: 2,
      authoritativeFor: ['regulatory', 'premises', 'general'],
      outOfScopeTier: 3,
      provenance: {
        addedAt: ADDED.addedAt,
        addedBy: 'public-suffix-rule',
        evidence: 'matched a government or public-body host pattern',
      },
    };
  }

  return null;
}

export function registryStats() {
  const byCategory: Partial<Record<SourceCategory, number>> = {};
  for (const item of SOURCE_REGISTRY) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }
  return { total: SOURCE_REGISTRY.length, byCategory };
}
