/**
 * Regressions for failure modes found by the LIVE Pilot A run, plus coverage
 * of the live transport layer. Every test here exists because something
 * actually went wrong on real data.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifySource } from '../src/research/sources.ts';
import { WebResearchAdapter, buildQueries } from '../src/research/adapter.ts';
import { AgentBridgeSearchClient, type CaptureFile } from '../src/research/agent-bridge.ts';
import { CorpusClaimExtractor } from '../src/research/corpus.ts';
import { HttpSearchClient, SEARCH_PRESETS, searchClientFromEnv } from '../src/research/http-search.ts';
import { runPipeline } from '../src/pipeline.ts';
import { orbitalDirect, pilotATargets } from '../fixtures/pilot-a.ts';
import { liveCapture, liveExtractions } from '../fixtures/pilot-a-live.ts';
import type { ClientProfile } from '../src/pipeline.ts';
import type { CompanyIdentity } from '../src/domain.ts';

const RUN_DATE = '2026-09-08';

// --- identity collisions in search queries ---------------------------------

test('every query carries a disambiguator by default', () => {
  // Live run: "Bramble Group export growth..." returned Brambles Ltd (CHEP
  // pallets, Australia). "NMS International Group export growth..." returned a
  // Chinese mining equipment maker. "Slack & Parr export growth..." returned
  // academic papers about slack resources. Three of seven companies.
  const queries = buildQueries(
    { name: 'Bramble Group', domain: 'bramblefoods.co.uk', location: 'Market Harborough' },
    orbitalDirect,
    6,
  );

  assert.ok(
    queries.every((q) => q.includes('Market Harborough')),
    'a bare company name collides with same-named businesses worldwide',
  );
});

test('industry is used as the qualifier when no location is known', () => {
  const queries = buildQueries(
    { name: 'Acme', domain: 'acme.com', industry: 'technical textiles' },
    orbitalDirect,
    3,
  );

  assert.ok(queries.slice(1).every((q) => q.includes('technical textiles')));
});

test('disambiguation can be turned off to replay an older capture', () => {
  const company = { name: 'Bramble Group', domain: 'b.com', location: 'Market Harborough' };

  const off = buildQueries(company, orbitalDirect, 2, { disambiguate: false });
  assert.equal(off[1], 'Bramble Group export growth or new overseas market entry');

  const on = buildQueries(company, orbitalDirect, 2);
  assert.notEqual(on[1], off[1]);
});

// --- source classification gaps found live ---------------------------------

test("a company's own site on another TLD needs an alias to count as first-party", () => {
  // Live run: deVOL's own devolkitchens.co.uk scored tier 4 against a target
  // declaring devolkitchens.com, which dropped the row to the aggregator cap.
  const withoutAlias = classifySource('https://www.devolkitchens.co.uk/blog/x', 'devolkitchens.com');
  assert.equal(withoutAlias.tier, 4);

  const withAlias = classifySource('https://www.devolkitchens.co.uk/blog/x', 'devolkitchens.com', [
    'devolkitchens.co.uk',
  ]);
  assert.equal(withAlias.tier, 1);
  assert.equal(withAlias.type, 'first_party');
});

test('an unrecognised trade title is flagged for review, not silently trusted', () => {
  // kbbfocus.com is a real kitchen-industry title the registry does not know.
  const result = classifySource('https://kbbfocus.com/news/3895-devol-kitchens');

  assert.equal(result.tier, 4);
  assert.equal(result.needsReview, true);
});

// --- agent bridge transport ------------------------------------------------

const smallCapture: CaptureFile = {
  capturedAt: RUN_DATE,
  transport: 'test',
  captures: [
    {
      query: 'known query',
      results: [{ title: 't', url: 'https://www.gov.uk/x', snippet: 's', retrievedAt: RUN_DATE }],
    },
    { query: 'never asked', results: [] },
  ],
};

test('an uncaptured query is an error, never a silent empty result', async () => {
  const client = new AgentBridgeSearchClient(smallCapture);

  await assert.rejects(
    () => client.search('unknown query'),
    /no capture for query/,
    'a silent empty result would manufacture a false "researched and found nothing"',
  );
});

test('a captured query returns its results and is recorded', async () => {
  const client = new AgentBridgeSearchClient(smallCapture);
  const results = await client.search('known query');

  assert.equal(results.length, 1);
  assert.equal(results[0]?.query, 'known query');
  assert.deepEqual(client.queriesRequested, ['known query']);
});

test('captures never requested are reported — the query generator has drifted', async () => {
  const client = new AgentBridgeSearchClient(smallCapture);
  await client.search('known query');

  assert.deepEqual(client.unusedCaptures(), ['never asked']);
});

// --- HTTP search client ----------------------------------------------------

function stubFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof globalThis.fetch;
}

test('the HTTP search client maps a provider response into SearchResults', async () => {
  const client = new HttpSearchClient(
    { ...SEARCH_PRESETS.brave!, apiKey: 'test-key' },
    stubFetch({ web: { results: [{ title: 'T', url: 'https://x.com', description: 'D' }] } }),
  );

  const results = await client.search('acme expansion');

  assert.equal(results.length, 1);
  assert.deepEqual(
    { title: results[0]!.title, url: results[0]!.url, snippet: results[0]!.snippet },
    { title: 'T', url: 'https://x.com', snippet: 'D' },
  );
  assert.equal(results[0]!.query, 'acme expansion');
  assert.equal(client.queriesRun, 1);
});

test('a provider error throws rather than returning nothing', async () => {
  const client = new HttpSearchClient(
    { ...SEARCH_PRESETS.serper!, apiKey: 'k' },
    stubFetch({}, 429),
  );

  await assert.rejects(() => client.search('q'), /returned 429/);
  assert.equal(client.queriesRun, 0);
});

test('a missing results path yields an empty list, not a crash', async () => {
  const client = new HttpSearchClient(
    { ...SEARCH_PRESETS.brave!, apiKey: 'k' },
    stubFetch({ unexpected: true }),
  );

  assert.deepEqual(await client.search('q'), []);
});

test('the client declares its own cost and availability for routing', () => {
  const unauthenticated = new HttpSearchClient({ ...SEARCH_PRESETS.brave! }, stubFetch({}));
  assert.equal(unauthenticated.describe().availability, 'unauthenticated');

  const configured = new HttpSearchClient({ ...SEARCH_PRESETS.brave!, apiKey: 'k' }, stubFetch({}));
  assert.equal(configured.describe().availability, 'available');
  assert.equal(configured.describe().cost.credits, 1);
});

test('env configuration is optional and validated', () => {
  assert.equal(searchClientFromEnv({}), null);
  assert.equal(searchClientFromEnv({ SIGNAL_SEARCH_PROVIDER: 'brave' }), null);
  assert.throws(
    () => searchClientFromEnv({ SIGNAL_SEARCH_PROVIDER: 'nope', SIGNAL_SEARCH_API_KEY: 'k' }),
    /unknown search provider/,
  );
});

// --- the live run itself ---------------------------------------------------

function prescreen(company: CompanyIdentity): string | null {
  const disqualified: Record<string, string> = {
    'bleckmann.com': 'third-party logistics provider — a competitor',
    'aldi.co.uk': 'enterprise retailer running its own distribution network',
  };
  return disqualified[company.domain] ?? null;
}

function liveAdapter(withPrescreen = true) {
  return new WebResearchAdapter({
    search: new AgentBridgeSearchClient(liveCapture),
    extractor: new CorpusClaimExtractor(liveExtractions),
    targets: pilotATargets,
    runDate: RUN_DATE,
    maxQueriesPerCompany: 2,
    disambiguateQueries: false,
    ...(withPrescreen ? { prescreen: (c: CompanyIdentity, _client: ClientProfile) => prescreen(c) } : {}),
  });
}

test('the pre-screen rejects disqualified companies without spending a query', async () => {
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const bleckmann = adapter.rejections().find((r) => r.company.domain === 'bleckmann.com');
  assert.equal(bleckmann?.stage, 'icp');
  assert.equal(bleckmann?.queriesRun.length, 0, 'no research spent on a known competitor');
  assert.match(bleckmann!.reason, /no research spent/);
});

test('a contraction signal is rejected, not scored as a low opportunity', async () => {
  // Live run found Slack & Parr consulting on up to 40 redundancies driven by
  // falling overseas demand. Current, well-sourced, ICP-fitting — and the
  // opposite of a buying signal.
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const slackParr = adapter.rejections().find((r) => r.company.domain === 'slackandparr.com');
  assert.equal(slackParr?.stage, 'contradiction');
  assert.match(slackParr!.reason, /contraction/);
});

test('the live run reports only what clears the floor, and explains the rest', async () => {
  const adapter = liveAdapter();
  const result = await runPipeline(adapter, {
    client: orbitalDirect,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
    reportableFloor: 60,
  });

  assert.equal(result.opportunities.length, 3);
  assert.deepEqual(
    result.opportunities.map((o) => o.company.name),
    ['Maeving Ltd', 'Baltex', 'Bramble Group'],
  );

  // Every company in scope is accounted for: reported, rejected or dropped.
  const accounted =
    result.opportunities.length + adapter.rejections().length + result.dropped.length;
  assert.equal(accounted, pilotATargets.length);
});

test('the live run rediscovered the fixture signals independently', async () => {
  // A reference check, not a target. Maeving, Baltex and Bramble were found
  // again from fresh queries; deVOL and NMS diverged, which is reported rather
  // than corrected.
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const found = new Set(adapter.signals().map((s) => s.company.domain));
  for (const domain of ['maeving.com', 'baltex.co.uk', 'bramblefoods.co.uk']) {
    assert.ok(found.has(domain), `${domain} rediscovered`);
  }
});

test('live research corrected a wrong inference in the fixture', async () => {
  // The fixture inferred Maeving was a domestic-first shipper. Live research
  // found it has exported since 2023 and ships roughly half its output.
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const maeving = adapter.signals().find((s) => s.company.domain === 'maeving.com');
  assert.ok(maeving);
  assert.ok(
    maeving!.contradictions.some((c) => /CORRECTS THE FIXTURE/.test(c.note)),
    'the correction is surfaced, not silently applied',
  );
});
