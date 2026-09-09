import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifySource } from '../src/research/sources.ts';
import {
  WebResearchAdapter,
  buildQueries,
  deriveEvidenceQuality,
} from '../src/research/adapter.ts';
import { CorpusClaimExtractor, StaticSearchClient } from '../src/research/corpus.ts';
import { runPipeline } from '../src/pipeline.ts';
import {
  orbitalDirect,
  pilotAExtractions,
  pilotASearchCorpus,
  pilotATargets,
} from '../fixtures/pilot-a.ts';
import type { Claim } from '../src/domain.ts';

const RUN_DATE = '2026-09-08';

// --- source classification -------------------------------------------------

test('government and public-body hosts are public record', () => {
  assert.equal(classifySource('https://www.gov.uk/government/news/x').tier, 2);
  assert.equal(classifySource('https://www.leicestershire.gov.uk/news/x').tier, 2);
  assert.equal(
    classifySource('https://find-and-update.company-information.service.gov.uk/company/1').category,
    'official_registry',
  );
});

test("a company's own site is first-party ONLY when the company domain is supplied", () => {
  // Found by running Pilot A: without the company domain, a company's own
  // website was classified as an unknown host and scored as an aggregator.
  const withoutContext = classifySource('https://maeving.com/en-us/pages/rm1');
  assert.equal(withoutContext.tier, 4);
  assert.equal(withoutContext.needsReview, true);

  const withContext = classifySource('https://maeving.com/en-us/pages/rm1', { ownedDomains: ['maeving.com'] });
  assert.equal(withContext.tier, 1);
  assert.equal(withContext.category, 'first_party');
});

test('first-party detection handles subdomains and www', () => {
  const result = classifySource('https://news.example.co.uk/post', { ownedDomains: ['example.co.uk'] });
  assert.equal(result.tier, 1);
});

test('known trade press and news are tier 3', () => {
  assert.equal(classifySource('https://www.thebusinessdesk.com/eastmidlands/news/1').tier, 3);
  assert.equal(classifySource('https://www.motorcyclenews.com/news/x').tier, 3);
});

test('directories are tier 4 and social is tier 5', () => {
  assert.equal(classifySource('https://www.crunchbase.com/organization/x').tier, 4);
  assert.equal(classifySource('https://pitchbook.com/profiles/company/1').tier, 4);
  assert.equal(classifySource('https://www.linkedin.com/company/x').tier, 5);
});

test('an unrecognised host defaults to tier 4 and is flagged for review', () => {
  const result = classifySource('https://some-blog-nobody-knows.example/post');

  assert.equal(result.tier, 4);
  assert.equal(result.needsReview, true);
});

// --- query generation ------------------------------------------------------

test('queries are built from the client trigger model, not a generic template', () => {
  const queries = buildQueries(
    { canonicalName: 'Acme Ltd', canonicalDomain: 'acme.com', geography: { town: 'Leicester' } },
    orbitalDirect,
    5,
  );

  assert.ok(queries[0]?.includes('Acme Ltd'));
  assert.ok(
    queries.some((q) => q.includes('export growth')),
    'client demand triggers drive the queries',
  );
});

test('a contradiction query is always issued', () => {
  const queries = buildQueries({ canonicalName: 'Acme Ltd', canonicalDomain: 'acme.com' }, orbitalDirect, 99);

  assert.ok(queries.some((q) => /administration|cancelled/.test(q)));
});

test('two clients produce different queries for the same company', () => {
  const itClient = {
    ...orbitalDirect,
    name: 'An IT firm',
    demandTriggers: ['security incident', 'digital transformation programme'],
  };

  const freight = buildQueries({ canonicalName: 'Acme', canonicalDomain: 'acme.com' }, orbitalDirect, 3);
  const it = buildQueries({ canonicalName: 'Acme', canonicalDomain: 'acme.com' }, itClient, 3);

  assert.notDeepEqual(freight, it);
});

// --- evidence quality ------------------------------------------------------

test('evidence quality rewards better tiers and genuine independence', () => {
  const base = (id: string, tier: number, originId?: string): Claim => ({
    kind: 'fact',
    id,
    statement: id,
    source: { url: `https://x.com/${id}`, tier: tier as 1, publisher: 'x', ...(originId ? { originId } : {}) },
    eventDate: '2026-08-01',
    discoveredAt: RUN_DATE,
    verification: 'search_summary_only',
  });

  const hypothesis: Claim = {
    kind: 'hypothesis',
    id: 'h1',
    statement: 'h',
    derivedFrom: ['a', 'b'],
    reasoning: 'r',
    testableBy: 't',
  };

  const strong = deriveEvidenceQuality([base('a', 1), base('b', 2), hypothesis], 'h1');
  const weak = deriveEvidenceQuality([base('a', 4), base('b', 4), hypothesis], 'h1');
  const syndicated = deriveEvidenceQuality(
    [base('a', 3, 'same-release'), base('b', 3, 'same-release'), hypothesis],
    'h1',
  );
  const independent = deriveEvidenceQuality([base('a', 3), base('b', 3), hypothesis], 'h1');

  assert.ok(strong > weak);
  assert.ok(independent > syndicated, 'syndication must not buy evidence quality');
});

// --- the research loop, on the real Pilot A corpus -------------------------

function pilotAdapter() {
  return new WebResearchAdapter({
    search: new StaticSearchClient(pilotASearchCorpus),
    extractor: new CorpusClaimExtractor(pilotAExtractions),
    targets: pilotATargets,
    runDate: RUN_DATE,
  });
}

test('Pilot A produces signals and rejections, and researches every target', async () => {
  const adapter = pilotAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  assert.equal(
    adapter.signals().length + adapter.rejections().length,
    pilotATargets.length,
    'every company researched ends up either a signal or an explained rejection',
  );
});

test('a competitor is rejected on ICP, not scored', async () => {
  const adapter = pilotAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const bleckmann = adapter.rejections().find((r) => r.company.domain === 'bleckmann.com');
  assert.equal(bleckmann?.stage, 'icp');
  assert.match(bleckmann!.reason, /competitor/i);
});

test('a stale signal is rejected at the research stage with its reason', async () => {
  const adapter = pilotAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const slackParr = adapter.rejections().find((r) => r.company.domain === 'slackandparr.com');
  assert.equal(slackParr?.stage, 'stale');
  assert.match(slackParr!.reason, /over 12 months/);
});

test('"researched, nothing found" is recorded distinctly from "not researched"', async () => {
  const adapter = pilotAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  const winbro = adapter.rejections().find((r) => r.company.domain === 'winbrogroup.com');
  assert.equal(winbro?.stage, 'no_trigger_found');
  assert.ok(winbro!.queriesRun.length > 0, 'the queries that found nothing are recorded');
});

test('a company absent from the corpus raises rather than reporting a clean negative', async () => {
  const adapter = new WebResearchAdapter({
    search: new StaticSearchClient(pilotASearchCorpus),
    extractor: new CorpusClaimExtractor(pilotAExtractions),
    targets: [{ canonicalName: 'Never Researched Ltd', canonicalDomain: 'never-researched.com' }],
    runDate: RUN_DATE,
  });

  await assert.rejects(
    () => adapter.discoverTriggers(orbitalDirect),
    /no extraction captured/,
  );
});

test('inference depth is measured from the chain, not asserted', async () => {
  const adapter = pilotAdapter();
  const outcome = await adapter.researchCompany(pilotATargets[0]!, orbitalDirect);

  assert.equal(outcome.outcome, 'signal');
  if (outcome.outcome !== 'signal') return;

  // Maeving: facts -> two inferences -> hypothesis.
  assert.equal(outcome.signal.inferenceDepth, 2);
  assert.equal(outcome.candidate.inferenceSteps, 2);
});

test('every reported signal carries the full required field set', async () => {
  const adapter = pilotAdapter();
  await adapter.discoverTriggers(orbitalDirect);

  for (const signal of adapter.signals()) {
    assert.ok(signal.company.domain, 'company identity');
    assert.ok(signal.trigger, 'trigger');
    assert.ok(signal.whatChanged, 'what changed');
    assert.ok(signal.discoveredAt, 'discovery date');
    assert.ok(signal.facts.length > 0, 'at least one sourced fact');
    assert.ok(signal.facts.every((f) => f.source.url), 'every fact has a source URL');
    assert.ok(signal.facts.every((f) => f.source.tier >= 1), 'every fact has a source type');
    assert.ok(signal.freshness, 'freshness');
    assert.ok(signal.icpRelevance.rationale, 'ICP relevance');
    assert.ok(signal.hypothesis.statement, 'commercial implication');
    assert.ok(signal.owningFunction.function, 'owning function');
  }
});

test('the end-to-end run returns only what qualifies, and explains the rest', async () => {
  const adapter = pilotAdapter();

  const result = await runPipeline(adapter, {
    client: orbitalDirect,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
    reportableFloor: 60,
  });

  // Three, not four: this v1-era corpus cites leicestershire.gov.uk and
  // kbbreview for deVOL's EXPORT claim, and neither is authoritative on export
  // trade, so the row scores 59. The later live corpus cites deVOL's own
  // domains for the same claim and scores 70. Contextual classification, not a
  // change of standard.
  assert.equal(result.opportunities.length, 3);
  assert.equal(result.opportunities[0]?.company.name, 'Maeving Ltd');

  const devol = result.dropped.find((d) => d.company.domain === 'devolkitchens.com');
  assert.equal(devol?.stage, 'scoring');

  // NMS scored 56 — real, but below the floor, and dropped with a reason.
  const nms = result.dropped.find((d) => d.company.domain === 'nmsinfrastructure.com');
  assert.equal(nms?.stage, 'scoring');
  assert.match(nms!.reason, /below reportable floor/);

  // Nothing is padded to reach the requested 50.
  assert.ok(result.opportunities.length < 50);
});

test('unopened sources cap the whole Pilot A run, compressing the ranking', async () => {
  const adapter = pilotAdapter();
  const result = await runPipeline(adapter, {
    client: orbitalDirect,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
    reportableFloor: 60,
  });

  for (const opportunity of result.opportunities) {
    assert.ok(opportunity.score.total <= 70, `${opportunity.company.name} respects the cap`);
    assert.notEqual(opportunity.score.confidence, 'High');
  }

  // The top two are only tied because the cap bites; their raw scores differ.
  const [first, second] = result.opportunities;
  assert.equal(first!.score.total, second!.score.total);
  assert.notEqual(first!.score.raw, second!.score.raw);
});

test('recommended action tells the salesperson to verify before contacting', async () => {
  const adapter = pilotAdapter();
  const result = await runPipeline(adapter, {
    client: orbitalDirect,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
    reportableFloor: 60,
  });

  for (const opportunity of result.opportunities) {
    assert.equal(opportunity.recommendedAction.action, 'research_further');
  }
});
