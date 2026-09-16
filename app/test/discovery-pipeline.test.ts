/**
 * The failure modes of the discovery half.
 *
 * These are the checks that stop Signal becoming a generic lead list. Each one
 * corresponds to a way the product could quietly start producing plausible
 * rubbish, so each is tested for refusal rather than for output.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coerceCommercialModel, groundModel, unsupportedOfferings } from '../src/commercial-model.ts';
import { coerceTriggers, matchOffering, looksCompanySpecific, planQueries } from '../src/triggers.ts';
import { coerceCandidates, mergeCandidates } from '../src/discovery.ts';
import { domainMatchesName, isCorporateHost, resolveCandidate } from '../src/resolve.ts';
import { BridgeSearchClient, BridgeModelClient, BridgePageRetriever, emptyCapture } from '../src/transport.ts';
import { readSite, internalLinks, corpusQuality } from '../src/website.ts';
import type { SiteCorpus } from '../src/website.ts';
import type { CommercialModel } from '../src/commercial-model.ts';
import type { SearchResult } from '../../engine/src/research/types.ts';

// --- commercial model ------------------------------------------------------

const corpus: SiteCorpus = {
  domain: 'example.co.uk',
  pages: [
    {
      url: 'https://example.co.uk/services',
      text: 'We provide pallet storage and export haulage for manufacturers across the East Midlands.',
      retrievedAt: '2026-09-16',
    },
  ],
  unavailable: [],
  totalChars: 90,
};

test('a model that names no offering is a failed read, not a simple business', () => {
  assert.throws(
    () => coerceCommercialModel({ name: 'Example', offerings: [] }, corpus),
    /named no offering/,
  );
});

test('a capability the website never mentions is reported as ungrounded', () => {
  const model = coerceCommercialModel(
    {
      name: 'Example',
      summary: 'We provide pallet storage and export haulage.',
      offerings: [
        { name: 'pallet storage', description: 'pallet storage', sourceUrl: 'https://example.co.uk/services' },
        // Nothing on the site mentions temperature-controlled anything.
        { name: 'temperature-controlled pharmaceutical storage', description: 'cold chain for pharma', sourceUrl: 'https://example.co.uk/services' },
      ],
      cannotServe: ['companies with their own fleet'],
    },
    corpus,
  );

  // The proper-noun grounding check does NOT catch this: a fabricated service
  // is ordinary lowercase words. The offering check is what catches it.
  const unsupported = unsupportedOfferings(model.offerings, corpus);
  assert.deepEqual(
    unsupported.map((entry) => entry.offering),
    ['temperature-controlled pharmaceutical storage'],
  );
  assert.equal(groundModel(model, corpus).findings.length, 0);
});

// --- triggers: the rule the whole product turns on -------------------------

const model: CommercialModel = {
  name: 'Example Logistics',
  domain: 'example.co.uk',
  summary: 'Pallet storage and export haulage for East Midlands manufacturers.',
  offerings: [
    { name: 'pallet storage', description: 'racked pallet storage', sourceUrl: 'https://example.co.uk/services' },
    { name: 'export haulage', description: 'road freight to Europe', sourceUrl: 'https://example.co.uk/services' },
  ],
  customerTypes: ['manufacturers'],
  industriesServed: ['manufacturing'],
  problemsSolved: ['no space', 'no export capability'],
  buyingSituations: [],
  geography: 'East Midlands',
  scale: 'SME',
  cannotServe: ['other logistics providers'],
  uncertainties: [],
  evidence: { pagesRead: [], pagesUnavailable: [], quality: { level: 'good', reason: '' } },
  grounding: { grounded: true, findings: [], fieldsChecked: [], corpusChars: 0 },
};

const goodTrigger = {
  id: 't1',
  event: 'A manufacturer wins an export contract larger than its current warehouse can hold',
  mechanism: 'Finished goods awaiting shipment exceed on-site racking, so overflow storage is needed before the first consignment',
  offering: 'pallet storage',
  strength: 'strong',
  observableTraces: ['contract award announcements'],
  queries: ['manufacturer wins export contract East Midlands 2026'],
  exclusions: ['they already lease a second warehouse'],
  falsifyingQuestion: 'Where are you holding the finished goods for this contract?',
};

test('a trigger is kept when it names a real offering', () => {
  const set = coerceTriggers({ triggers: [goodTrigger] }, model);
  assert.equal(set.triggers.length, 1);
  assert.equal(set.triggers[0]?.offering, 'pallet storage');
});

test('a trigger naming something the client does not sell is discarded', () => {
  // The central product rule. "Company raised funding → they need our CRM"
  // is exactly this failure when the client does not sell a CRM.
  const set = coerceTriggers(
    {
      triggers: [
        goodTrigger,
        { ...goodTrigger, id: 't2', offering: 'management consultancy', event: 'Company raises funding' },
      ],
    },
    model,
  );

  assert.equal(set.triggers.length, 1);
  assert.equal(set.discarded.length, 1);
  assert.match(set.discarded[0]!.reason, /not something this business sells/);
});

test('a run where no trigger connects to an offering fails rather than returning generic ones', () => {
  assert.throws(
    () =>
      coerceTriggers(
        { triggers: [{ ...goodTrigger, offering: 'search engine optimisation' }] },
        model,
      ),
    /no demand trigger survived/,
  );
});

test('a trigger with no query that could find unknown companies is discarded', () => {
  const set = coerceTriggers(
    { triggers: [goodTrigger, { ...goodTrigger, id: 't3', queries: [] }] },
    model,
  );
  assert.equal(set.triggers.length, 1);
  assert.match(set.discarded[0]!.reason, /without naming one/);
});

test('offering names are matched generously but not loosely', () => {
  const offerings = ['Pallet storage and warehousing', 'Export haulage'];
  assert.equal(matchOffering('pallet storage', offerings), 'Pallet storage and warehousing');
  assert.equal(matchOffering('haulage export', offerings), 'Export haulage');
  assert.equal(matchOffering('accountancy', offerings), null);
});

test('a query that names a company is not a discovery query', () => {
  assert.equal(looksCompanySpecific('Example Logistics new premises', 'Example Logistics'), true);
  assert.equal(looksCompanySpecific('"Acme Widgets" expansion', 'Example Logistics'), true);
  assert.equal(looksCompanySpecific('manufacturer opens second site East Midlands', 'Example Logistics'), false);
});

test('the query budget is spread across triggers, not drained into the first', () => {
  const set = coerceTriggers(
    {
      triggers: [
        { ...goodTrigger, id: 'a', queries: ['a1', 'a2', 'a3'] },
        { ...goodTrigger, id: 'b', queries: ['b1', 'b2'] },
      ],
    },
    model,
  );
  const plan = planQueries(set, 4);
  assert.deepEqual(plan.map((entry) => entry.query), ['a1', 'b1', 'a2', 'b2']);
});

// --- candidate extraction --------------------------------------------------

const candidate = {
  companyName: 'Acme Widgets Ltd',
  domain: 'acmewidgets.co.uk',
  whatHappened: 'Won a £4m export contract',
  whenText: 'August 2026',
  location: 'Leicester',
  industryHint: 'manufacturing',
  sourceUrls: ['https://www.leicestermercury.co.uk/business/acme-contract'],
  role: 'subject',
  confidence: 0.8,
};

test('a company that is not the subject of the event is not a candidate', () => {
  const result = coerceCandidates(
    { candidates: [candidate, { ...candidate, companyName: 'Consulting Partners LLP', role: 'adviser' }] },
    't1',
    10,
  );
  assert.equal(result.candidates.length, 1);
  assert.match(result.ignored[0]!.why, /not the subject/);
});

test('an unsure identification is dropped rather than guessed at', () => {
  const result = coerceCandidates({ candidates: [{ ...candidate, confidence: 0.2 }] }, 't1', 10);
  assert.equal(result.candidates.length, 0);
  assert.match(result.ignored[0]!.why, /too unsure/);
});

test('a candidate with no source is not a candidate', () => {
  const result = coerceCandidates({ candidates: [{ ...candidate, sourceUrls: [] }] }, 't1', 10);
  assert.equal(result.candidates.length, 0);
});

test('one company found under two triggers is a stronger lead, not a duplicate', () => {
  const merged = mergeCandidates([
    [{ ...candidate, triggerId: 't1' }],
    [{ ...candidate, triggerId: 't2', sourceUrls: ['https://other.example/story'] }],
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0]!.triggerIds, ['t1', 't2']);
  assert.equal(merged[0]!.sourceUrls.length, 2);
});

// --- identity resolution ---------------------------------------------------

test('a domain is accepted only when it plausibly belongs to the company', () => {
  assert.equal(domainMatchesName('acmewidgets.co.uk', 'Acme Widgets Ltd'), true);
  assert.equal(domainMatchesName('acme-widgets.com', 'Acme Widgets'), true);
  assert.equal(domainMatchesName('leicestermercury.co.uk', 'Acme Widgets Ltd'), false);
  // Real resolutions from a live run.
  assert.equal(domainMatchesName('trowers.com', 'Trowers & Hamlins'), true);
  assert.equal(domainMatchesName('midfix.co.uk', 'MIDFIX'), true);
  assert.equal(domainMatchesName('goldmansachs.com', 'Goldman Sachs'), true);
});

test('a one-word company name must match the host, not merely appear inside it', () => {
  // The real false positive this rule exists for: a live run resolved
  // "Phoenix Group" (FTSE 100, UK life assurance) to phoenixinsgrp.com, an
  // unrelated insurance agency in Texas, because "phoenix" is a substring.
  assert.equal(domainMatchesName('phoenixinsgrp.com', 'Phoenix Group'), false);
  assert.equal(domainMatchesName('thephoenixgroup.com', 'Phoenix Group'), true);
  assert.equal(domainMatchesName('softcat.com', 'Softcat'), true);
  assert.equal(domainMatchesName('softcatalogue.com', 'Softcat'), false);
});

test('an abbreviated domain is refused rather than guessed — a known recall cost', () => {
  // Shakespeare Martineau really does trade at shma.co.uk. Signal cannot
  // establish that from the name alone, and inventing the link is exactly the
  // failure above. Refusing loses a real candidate, which is the right trade.
  assert.equal(domainMatchesName('shma.co.uk', 'Shakespeare Martineau'), false);
});

test('a directory or news host is never a company website', () => {
  assert.equal(isCorporateHost('https://www.linkedin.com/company/acme'), false);
  assert.equal(isCorporateHost('https://www.bbc.co.uk/news/123'), false);
  assert.equal(isCorporateHost('https://acmewidgets.co.uk/about'), true);
});

test('a candidate with no findable website is refused, never assumed', async () => {
  const resolution = await resolveCandidate({
    candidate: { ...candidate, domain: '', triggerId: 't1' },
  });
  assert.equal(resolution.status, 'unresolvable');
  assert.equal(resolution.fingerprint, undefined);
});

test('two plausible websites for one name is ambiguous, not a coin toss', async () => {
  const search = {
    id: 'stub',
    async search(): Promise<SearchResult[]> {
      return [
        { query: 'q', title: 'Acme Widgets Ltd', url: 'https://acmewidgets.co.uk', snippet: '', retrievedAt: '2026-09-16' },
        { query: 'q', title: 'Acme Widgets', url: 'https://acme-widgets.com', snippet: '', retrievedAt: '2026-09-16' },
      ];
    },
  };
  const resolution = await resolveCandidate({
    candidate: { ...candidate, domain: '', triggerId: 't1' },
    search,
  });
  assert.equal(resolution.status, 'ambiguous');
  assert.match(resolution.explanation, /would be a guess/);
});

test('a domain stated in the source is accepted when it matches the name', async () => {
  const resolution = await resolveCandidate({ candidate: { ...candidate, triggerId: 't1' } });
  assert.equal(resolution.status, 'resolved');
  assert.equal(resolution.fingerprint?.canonicalDomain, 'acmewidgets.co.uk');
  assert.equal(resolution.basis, 'stated_in_source');
});

// --- the bridge ------------------------------------------------------------

test('an uncaptured query is an error, never "we looked and found nothing"', async () => {
  const search = new BridgeSearchClient(emptyCapture('test'));
  await assert.rejects(() => search.search('anything'), /no capture for query/);
});

test('an uncaptured page is unavailable, which is a different and honest answer', async () => {
  const retriever = new BridgePageRetriever(emptyCapture('test'));
  const outcome = await retriever.retrieve('https://example.com/x');
  assert.equal(outcome.status, 'unavailable');
});

test('a missing model response is an error rather than an empty completion', async () => {
  const client = new BridgeModelClient(emptyCapture('test'));
  await assert.rejects(
    () => client.complete({ purpose: 'commercial-model', system: 's', user: 'u' }),
    /no captured model response/,
  );
});

// --- website reading -------------------------------------------------------

test('a site nobody could read produces no confidence', async () => {
  const retriever = new BridgePageRetriever(emptyCapture('test'));
  const result = await readSite({ domain: 'nowhere.example', retriever });
  assert.equal(result.pages.length, 0);
  assert.ok(result.unavailable.length > 0);
  assert.equal(corpusQuality(result).level, 'insufficient');
});

test('a near-empty page is recorded as unreadable rather than counted as read', async () => {
  const capture = emptyCapture('test');
  capture.pages.push({ url: 'https://thin.example', text: 'Loading…', retrievedAt: '2026-09-16' });
  const result = await readSite({ domain: 'thin.example', retriever: new BridgePageRetriever(capture) });
  assert.equal(result.pages.length, 0);
  assert.match(result.unavailable[0]!.reason, /characters of text/);
});

test('internal links are found but kept shallow', () => {
  const html =
    '<a href="/services">S</a><a href="/about/team/history/detail">deep</a>' +
    '<a href="https://other.example/x">off-site</a><a href="/brochure.pdf">pdf</a>';
  const links = internalLinks(html, 'example.co.uk');
  assert.deepEqual(links, ['https://example.co.uk/services']);
});
