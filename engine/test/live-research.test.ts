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
import { liveCaptureV2, liveExtractionsV2 } from '../fixtures/pilot-a-live-v2.ts';
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
    { canonicalName: 'Bramble Group', canonicalDomain: 'bramblefoods.co.uk', geography: { town: 'Market Harborough' } },
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
    { canonicalName: 'Acme', canonicalDomain: 'acme.com', industry: 'technical textiles' },
    orbitalDirect,
    3,
  );

  assert.ok(queries.slice(1).every((q) => q.includes('technical textiles')));
});

test('disambiguation can be turned off to replay an older capture', () => {
  const company = { canonicalName: 'Bramble Group', canonicalDomain: 'b.com', geography: { town: 'Market Harborough' } };

  const off = buildQueries(company, orbitalDirect, 2, { disambiguate: false });
  assert.equal(off[1], 'Bramble Group export growth or new overseas market entry');

  const on = buildQueries(company, orbitalDirect, 2);
  assert.notEqual(on[1], off[1]);
});

// --- source classification gaps found live ---------------------------------

test("a company's own site on another TLD needs an alias to count as first-party", () => {
  // Live run: deVOL's own devolkitchens.co.uk scored tier 4 against a target
  // declaring devolkitchens.com, which dropped the row to the aggregator cap.
  const withoutAlias = classifySource('https://www.devolkitchens.co.uk/blog/x', ['devolkitchens.com']);
  assert.equal(withoutAlias.tier, 4);

  const withAlias = classifySource('https://www.devolkitchens.co.uk/blog/x', [
    'devolkitchens.com',
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
    search: new AgentBridgeSearchClient(liveCaptureV2),
    extractor: new CorpusClaimExtractor(liveExtractionsV2),
    targets: pilotATargets,
    runDate: RUN_DATE,
    maxQueriesPerCompany: 2,
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

test('a contraction signal is a real signal with no commercial consequence', async () => {
  // Live run found Slack & Parr consulting on up to 40 redundancies driven by
  // falling overseas demand. Current, well-sourced, ICP-fitting — and the
  // opposite of a buying signal FOR THIS CLIENT. Signal is not restricted to
  // growth, so this is recorded with negative polarity rather than discarded.
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const slackParr = adapter.rejections().find((r) => r.company.domain === 'slackandparr.com');
  assert.equal(slackParr?.stage, 'no_commercial_consequence');
  assert.match(slackParr!.reason, /freight demand is falling/);
  assert.match(slackParr!.reason, /cost-reduction or restructuring vendor would read the same change/);
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
    ['Maeving Ltd', 'Baltex', 'deVOL Kitchens'],
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
  for (const domain of ['maeving.com', 'baltex.co.uk', 'devolkitchens.com']) {
    assert.ok(found.has(domain), `${domain} rediscovered`);
  }
});

test('the identity gate rejects a colliding source end to end on real data', async () => {
  // The Brambles/CHEP result from the v1 capture is carried in the v2 corpus
  // precisely so the gate is exercised on real colliding data, not only in
  // unit tests. The rest of the Bramble chain survives it.
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const bramble = adapter.signals().find((s) => s.company.domain === 'bramblefoods.co.uk');
  assert.ok(bramble, 'Bramble still produces a signal from its surviving sources');
  assert.equal(bramble!.identityRejections.length, 1);
  assert.equal(bramble!.identityRejections[0]?.status, 'identity_collision');
  assert.match(bramble!.identityRejections[0]!.url, /brambles-ltd/);

  const urls = bramble!.facts.map((f) => f.source.url);
  assert.ok(
    urls.every((u) => !u.includes('brambles-ltd')),
    'the colliding source never reaches the evidence corpus',
  );
});

test('live research kept the correction to the fixture inference', async () => {
  // The original fixture inferred Maeving was a domestic-first shipper. Live
  // research found it has exported since 2023 and ships roughly half its
  // output; the correction is surfaced, not silently applied.
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const maeving = adapter.signals().find((s) => s.company.domain === 'maeving.com');
  assert.ok(maeving);
  assert.ok(maeving!.contradictions.some((c) => /exported since 2023/.test(c.note)));
});

test('every signal carries polarity and a commercial-consequence judgement', async () => {
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  for (const signal of adapter.signals()) {
    assert.ok(signal.polarity, 'polarity recorded');
    assert.equal(signal.consequence.actionable, true, 'reported signals are actionable');
    assert.ok(signal.consequence.rationale.length > 0);
  }
});

test('the four negative outcomes stay distinct', async () => {
  const adapter = liveAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const stages = new Map(adapter.rejections().map((r) => [r.company.domain, r.stage]));

  assert.equal(stages.get('winbrogroup.com'), 'no_trigger_found', 'researched, found nothing');
  assert.equal(stages.get('nmsinfrastructure.com'), 'no_trigger_found');
  assert.equal(stages.get('slackandparr.com'), 'no_commercial_consequence', 'real signal, no consequence');
  assert.equal(stages.get('bleckmann.com'), 'icp', 'disqualified before any research');
});
