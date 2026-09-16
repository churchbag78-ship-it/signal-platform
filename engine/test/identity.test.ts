/**
 * Identity resolution regressions.
 *
 * The governing rule under test: a matching company name is NEVER sufficient
 * on its own. Name + corroboration = match. Name alone = unresolved. Name +
 * a conflicting strong attribute = collision.
 *
 * Cases 1-3 are drawn from real collisions in the live Pilot A run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IdentityFingerprint, SourceAttribution } from '../src/domain.ts';
import {
  attributeSource,
  compareNames,
  ownedDomains,
  proposeAlias,
  verifiedAliases,
} from '../src/identity.ts';

const UK = 'United Kingdom';

const bramble: IdentityFingerprint = {
  canonicalName: 'Bramble Group',
  canonicalDomain: 'bramblefoods.co.uk',
  tradingNames: ['Bramble Foods'],
  subsidiaries: ['Whitakers Chocolates', 'The Bay Tree Food Co', 'Lings'],
  geography: { country: UK, town: 'Market Harborough' },
  industry: 'Fine food manufacturing and distribution',
  descriptors: ['fine food gifting', 'confectionery'],
};

const nms: IdentityFingerprint = {
  canonicalName: 'NMS International Group',
  canonicalDomain: 'nmsinfrastructure.com',
  tradingNames: ['NMS Infrastructure', 'NMSI'],
  companyNumber: '06360525',
  geography: { country: UK, town: 'Market Harborough' },
  industry: 'Infrastructure EPCF development',
};

const devol: IdentityFingerprint = {
  canonicalName: 'deVOL Kitchens',
  canonicalDomain: 'devolkitchens.com',
  aliasDomains: [
    {
      domain: 'devolkitchens.co.uk',
      evidence: "deVOL's own journal is published on this domain under the same brand and address",
      sourceUrl: 'https://www.devolkitchens.co.uk/blog/we-won-a-kings-award',
      verifiedBy: 'first_party_link',
    },
  ],
  tradingNames: ['deVOL'],
  companyNumber: '06707961',
  geography: { country: UK, town: 'Loughborough' },
  industry: 'Kitchen manufacturing and retail',
};

function attribution(over: Partial<SourceAttribution> & { url: string }): SourceAttribution {
  return over;
}

// --- 1. Brambles-style same-name / different-company ------------------------

test('1. a same-named company in another country and industry is a collision', () => {
  // Real: "Bramble Group export growth" returned Brambles Ltd, the Australian
  // CHEP pallet business.
  const verdict = attributeSource(
    bramble,
    attribution({
      url: 'https://umbrex.com/resources/company-profiles/brambles-ltd/',
      statedName: 'Brambles Ltd',
      statedGeography: { country: 'Australia' },
      statedIndustry: 'pallet pooling and supply chain logistics',
    }),
  );

  assert.equal(verdict.status, 'identity_collision');
  assert.ok(verdict.conflicts.some((c) => c.startsWith('country')));
  assert.ok(verdict.conflicts.some((c) => c.startsWith('industry')));
});

test('1b. "Brambles" and "Bramble" are recognised as the same name token', () => {
  // If the plural defeated name matching we would return "unresolved" and lose
  // the far more informative collision verdict.
  assert.notEqual(compareNames('Bramble Group', 'Brambles Ltd'), 'none');
});

// --- 2. NMS-style ambiguous acronym ----------------------------------------

test('2. an ambiguous acronym matching a different company is a collision', () => {
  // Real: "NMS International Group export growth" returned NMS Industries,
  // a Chinese mining-equipment maker.
  const verdict = attributeSource(
    nms,
    attribution({
      url: 'https://www.nmsindustries.com/news/20250224/',
      statedName: 'NMS Industries',
      statedGeography: { country: 'China' },
      statedIndustry: 'mining equipment manufacturing',
    }),
  );

  assert.equal(verdict.status, 'identity_collision');
});

test('2b. an unrelated document with no company attribution is unresolved, not a match', () => {
  // Real: "Slack & Parr export growth" returned academic papers on
  // organisational slack. Unresolved is the honest verdict — there is no
  // company here to disagree with.
  const verdict = attributeSource(
    {
      canonicalName: 'Slack & Parr',
      canonicalDomain: 'slackandparr.com',
      geography: { country: UK, town: 'Kegworth' },
      industry: 'Precision gear pump manufacturing',
    },
    attribution({ url: 'https://www.sciencedirect.com/science/article/abs/pii/S1090951617305059' }),
  );

  assert.equal(verdict.status, 'unresolved');
  assert.match(verdict.explanation, /could not be attributed/);
});

// --- 3. Same name, different country ---------------------------------------

test('3. the same company name in a different country is a collision', () => {
  const verdict = attributeSource(
    { canonicalName: 'Apex Engineering', canonicalDomain: 'apex.co.uk', geography: { country: UK } },
    attribution({
      url: 'https://example.com/apex',
      statedName: 'Apex Engineering',
      statedGeography: { country: 'United States' },
    }),
  );

  assert.equal(verdict.status, 'identity_collision');
});

test('3b. country synonyms do not create a false collision', () => {
  const verdict = attributeSource(
    { canonicalName: 'Apex Engineering', canonicalDomain: 'apex.co.uk', geography: { country: UK } },
    attribution({
      url: 'https://example.com/apex',
      statedName: 'Apex Engineering',
      statedGeography: { country: 'England' },
    }),
  );

  assert.equal(verdict.status, 'match');
});

// --- 4. Same name, different industry --------------------------------------

test('4. the same company name in a different industry is a collision', () => {
  const verdict = attributeSource(
    {
      canonicalName: 'Orion Systems',
      canonicalDomain: 'orion-systems.co.uk',
      geography: { country: UK },
      industry: 'industrial pump manufacturing',
    },
    attribution({
      url: 'https://example.com/orion',
      statedName: 'Orion Systems',
      statedGeography: { country: UK },
      statedIndustry: 'recruitment consultancy',
    }),
  );

  assert.equal(verdict.status, 'identity_collision');
  assert.ok(verdict.conflicts.some((c) => c.startsWith('industry')));
});

// --- 5. deVOL .com versus .co.uk -------------------------------------------

test('5. a verified alias domain attributes to the same identity', () => {
  const verdict = attributeSource(
    devol,
    attribution({ url: 'https://www.devolkitchens.co.uk/blog/we-won-a-kings-award' }),
  );

  assert.equal(verdict.status, 'match');
  assert.match(verdict.explanation, /owned domain/);
  assert.deepEqual(ownedDomains(devol), ['devolkitchens.com', 'devolkitchens.co.uk']);
});

test('5b. an UNVERIFIED alias confers nothing — a similar domain is not evidence', () => {
  const unverified: IdentityFingerprint = {
    ...devol,
    aliasDomains: [
      { domain: 'devolkitchens.co.uk', evidence: 'looks similar', verifiedBy: 'unverified' },
    ],
  };

  assert.deepEqual(verifiedAliases(unverified), []);

  const verdict = attributeSource(
    unverified,
    attribution({ url: 'https://www.devolkitchens.co.uk/blog/x' }),
  );
  assert.notEqual(verdict.status, 'match');
});

test('5c. proposing an alias requires evidence and a verification method', () => {
  assert.equal(proposeAlias('devolkitchens.co.uk', 'looks similar', 'unverified'), null);
  assert.equal(proposeAlias('devolkitchens.co.uk', '', 'human'), null);

  const alias = proposeAlias(
    'https://www.devolkitchens.co.uk/',
    'same brand, address and product range as the canonical domain',
    'first_party_link',
    { sourceUrl: 'https://www.devolkitchens.co.uk/about', verifiedAt: '2026-09-08' },
  );

  assert.equal(alias?.domain, 'devolkitchens.co.uk');
  assert.equal(alias?.verifiedBy, 'first_party_link');
  assert.equal(alias?.sourceUrl, 'https://www.devolkitchens.co.uk/about', 'provenance retained');
});

// --- 6. Trading name versus legal name -------------------------------------

test('6. a trading name attributes to the legal entity', () => {
  const verdict = attributeSource(
    bramble,
    attribution({
      url: 'https://www.grocerygazette.co.uk/2026/07/31/bramble-foods-opens-new-distribution-hub/',
      statedName: 'Bramble Foods',
      statedGeography: { country: UK, town: 'Market Harborough' },
    }),
  );

  assert.equal(verdict.status, 'match');
});

test('6b. a legal suffix does not defeat a name match', () => {
  assert.equal(compareNames('DEVOL KITCHENS LIMITED', 'deVOL Kitchens'), 'exact');
  assert.equal(compareNames('Baltex', 'W. Ball & Son Ltd'), 'none', 'genuinely different names');
});

// --- 7. Subsidiary versus parent -------------------------------------------

test('7. a declared subsidiary attributes to the parent identity', () => {
  const verdict = attributeSource(
    bramble,
    attribution({
      url: 'https://example.com/whitakers',
      statedName: 'Whitakers Chocolates',
      statedGeography: { country: UK },
      statedIndustry: 'confectionery',
    }),
  );

  assert.equal(verdict.status, 'match');
  assert.ok(verdict.corroborations.some((c) => c.includes('subsidiary')));
});

test('7b. a source about the PARENT does not attribute to the subsidiary', () => {
  const winbro: IdentityFingerprint = {
    canonicalName: 'Winbro Group Technologies',
    canonicalDomain: 'winbrogroup.com',
    parent: 'Quaser Machine Tools',
    geography: { country: UK, town: 'Shepshed' },
  };

  const verdict = attributeSource(
    winbro,
    attribution({ url: 'https://www.quaser.com/news', statedName: 'Quaser Machine Tools' }),
  );

  assert.equal(verdict.status, 'unresolved');
  assert.match(verdict.explanation, /parent/);
});

// --- 8. Company that has changed domain ------------------------------------

test('8. a former domain, verified, still attributes to the company', () => {
  const renamed: IdentityFingerprint = {
    canonicalName: 'Northgate Components',
    canonicalDomain: 'northgate-components.com',
    aliasDomains: [
      {
        domain: 'oldnorthgate.co.uk',
        evidence: 'previous corporate domain, redirects to the current site and shares the registry number',
        verifiedBy: 'public_record',
        verifiedAt: '2026-09-08',
      },
    ],
    geography: { country: UK },
  };

  const verdict = attributeSource(
    renamed,
    attribution({ url: 'https://oldnorthgate.co.uk/press/2026/expansion' }),
  );

  assert.equal(verdict.status, 'match');
  assert.match(verdict.explanation, /owned domain/);
});

// --- 9. Correct name, conflicting geography --------------------------------

test('9. the correct name with clearly conflicting geography is rejected', () => {
  const verdict = attributeSource(
    nms,
    attribution({
      url: 'https://example.com/nms',
      statedName: 'NMS International Group',
      statedGeography: { country: 'Uzbekistan' },
    }),
  );

  assert.equal(verdict.status, 'identity_collision');
  assert.equal(verdict.corroborations.length, 0);
});

test('9b. a differing town in the same country is a soft signal, not a collision', () => {
  // Companies have multiple sites; only a country or industry clash is strong.
  const verdict = attributeSource(
    bramble,
    attribution({
      url: 'https://example.com/bramble',
      statedName: 'Bramble Foods',
      statedGeography: { country: UK, town: 'Leicester' },
      statedIndustry: 'fine food manufacturing',
    }),
  );

  assert.equal(verdict.status, 'match');
  assert.ok(verdict.conflicts.some((c) => c.startsWith('town')), 'the discrepancy is still recorded');
});

// --- 10. Cannot be confidently attributed ----------------------------------

test('10. a name match with nothing corroborating it is unresolved, never a match', () => {
  const verdict = attributeSource(
    bramble,
    attribution({ url: 'https://example.com/story', statedName: 'Bramble Group' }),
  );

  assert.equal(verdict.status, 'unresolved');
  assert.match(verdict.explanation, /matching name alone is never sufficient/);
});

test('10b. a registry identifier settles attribution outright, either way', () => {
  const match = attributeSource(
    nms,
    attribution({ url: 'https://example.com/x', statedCompanyNumber: '06360525' }),
  );
  assert.equal(match.status, 'match');
  assert.equal(match.confidence, 0.99);

  const mismatch = attributeSource(
    nms,
    attribution({
      url: 'https://example.com/y',
      statedName: 'NMS International Group',
      statedCompanyNumber: '99999999',
    }),
  );
  assert.equal(mismatch.status, 'identity_collision');
});

test('10c. a source naming a different company website is a collision', () => {
  const verdict = attributeSource(
    devol,
    attribution({
      url: 'https://example.com/story',
      statedName: 'deVOL Kitchens',
      statedDomain: 'devol-imposter.com',
    }),
  );

  assert.equal(verdict.status, 'identity_collision');
});
