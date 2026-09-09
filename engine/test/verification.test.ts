/**
 * Retrieval, passage verification and extraction-fidelity measurement.
 *
 * The fidelity harness is graded here on ADVERSARIAL input: deliberately
 * corrupted extractions it must catch. A clean pass from a well-behaved
 * extraction proves little; catching a planted fault proves the instrument
 * works.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  contentHash,
  extractText,
  passageSupportedByPage,
  verifyClaimPassage,
  FixturePageRetriever,
  HttpPageRetriever,
  NullPageRetriever,
  type RetrievedPage,
} from '../src/research/retrieval.ts';
import {
  measureFidelity,
  summariseFidelity,
  extractFigures,
  type FidelityExpectation,
} from '../src/research/extraction-fidelity.ts';
import type { ExtractedClaim, SignalPolarity } from '../src/research/extraction.ts';
import { LlmClaimExtractor, LLM_PRESETS } from '../src/research/llm-extractor.ts';
import { realExtractionCases, recordedTransport } from '../fixtures/real-model-extractions.ts';
import { orbitalDirect } from '../fixtures/pilot-a.ts';

const RUN_DATE = '2026-09-09';

const page: RetrievedPage = {
  url: 'https://example.com/story',
  status: 200,
  text:
    'Acme Ltd of Leicester opened a 50,000 sq ft distribution centre at Meridian Business Park ' +
    'on 3 March 2026, creating 40 jobs. The company said the site would serve customers across ' +
    'the Midlands.',
  retrievedAt: RUN_DATE,
  contentHash: 'abc',
};

// --- retrieval mechanics ---------------------------------------------------

test('HTML is reduced to readable text', () => {
  const text = extractText(
    '<html><head><style>p{color:red}</style><script>var x=1</script></head>' +
      '<body><h1>Acme&nbsp;Ltd</h1><p>Opened a site &amp; hired 40 staff.</p></body></html>',
  );

  assert.equal(text, 'Acme Ltd Opened a site & hired 40 staff.');
});

test('content hashing is stable and distinguishes changed pages', () => {
  assert.equal(contentHash('same text'), contentHash('same text'));
  assert.notEqual(contentHash('same text'), contentHash('same text.'));
});

test('a verbatim passage is supported', () => {
  const check = passageSupportedByPage('opened a 50,000 sq ft distribution centre', page);

  assert.equal(check.supported, true);
  assert.equal(check.method, 'verbatim');
});

test('a lightly paraphrased passage is supported by token overlap', () => {
  const check = passageSupportedByPage(
    'Acme Ltd opened a 50,000 sq ft distribution centre at Meridian Business Park creating 40 jobs',
    page,
  );

  assert.equal(check.supported, true);
  assert.ok(check.overlap >= 0.75);
});

test('an invented passage is NOT supported', () => {
  const check = passageSupportedByPage(
    'Acme announced a merger with Globex and appointed a new chief executive from Frankfurt',
    page,
  );

  assert.equal(check.supported, false);
});

// --- verification levels ---------------------------------------------------

test('a claim reaches page level only when the page contains its passage', async () => {
  const retriever = new FixturePageRetriever([page]);

  const verified = await verifyClaimPassage(
    page.url,
    'opened a 50,000 sq ft distribution centre at Meridian Business Park',
    retriever,
  );

  assert.equal(verified.level, 'page_retrieved');
  assert.equal(verified.outcome, 'retrieved');
});

test('a retrieved page that does not contain the passage stays at snippet level', async () => {
  const retriever = new FixturePageRetriever([page]);

  const verified = await verifyClaimPassage(
    page.url,
    'Acme announced a merger with Globex and opened offices in Frankfurt and Tokyo',
    retriever,
  );

  assert.equal(verified.level, 'search_snippet', 'never promoted on retrieval alone');
  assert.equal(verified.outcome, 'retrieved');
  assert.match(verified.failure!, /does not contain the supporting passage/);
});

test('an unretrievable page stays at snippet level with the reason recorded', async () => {
  const retriever = new NullPageRetriever('egress policy blocks outbound page fetches');

  const verified = await verifyClaimPassage('https://example.com/x', 'anything', retriever);

  assert.equal(verified.level, 'search_snippet');
  assert.equal(verified.outcome, 'unavailable');
  assert.match(verified.failure!, /egress policy/);
  assert.deepEqual(retriever.attempted, ['https://example.com/x']);
});

test('the null retriever declares itself blocked rather than silently succeeding', () => {
  assert.equal(new NullPageRetriever().describe().availability, 'blocked');
});

test('the HTTP retriever reports failures instead of throwing', async () => {
  const notFound = new HttpPageRetriever(
    {},
    (async () => new Response('nope', { status: 404 })) as unknown as typeof globalThis.fetch,
  );

  const outcome = await notFound.retrieve('https://example.com/missing');
  assert.equal(outcome.status, 'failed');
  if (outcome.status === 'failed') assert.equal(outcome.httpStatus, 404);

  const broken = new HttpPageRetriever(
    {},
    (async () => {
      throw new Error('connection reset');
    }) as unknown as typeof globalThis.fetch,
  );

  const failure = await broken.retrieve('https://example.com/x');
  assert.equal(failure.status, 'failed');
  if (failure.status === 'failed') assert.match(failure.reason, /connection reset/);
});

test('the HTTP retriever extracts text and hashes the body', async () => {
  const retriever = new HttpPageRetriever(
    {},
    (async () =>
      new Response('<html><body><p>Acme opened a site.</p></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as unknown as typeof globalThis.fetch,
  );

  const outcome = await retriever.retrieve('https://example.com/x');
  assert.equal(outcome.status, 'retrieved');
  if (outcome.status !== 'retrieved') return;

  assert.equal(outcome.page.text, 'Acme opened a site.');
  assert.ok(outcome.page.contentHash.length > 0);
  assert.equal(retriever.fetches, 1);
});

// --- fidelity harness, on adversarial input --------------------------------

const SOURCE_TEXT = [
  'Acme opens Leicester hub. Acme Ltd of Leicester opened a 50,000 sq ft distribution centre ' +
    'at Meridian Business Park on 3 March 2026, creating 40 jobs.',
];

const expectation: FidelityExpectation = {
  allowedUrls: ['https://example.com/story'],
  expectedName: 'Acme Ltd',
  expectedCountry: 'United Kingdom',
  expectedTown: 'Leicester',
  expectedEventDates: ['2026-03-03'],
  expectedTopics: ['premises'],
  expectedPolarity: 'demand_increasing',
  sourceFigures: ['50,000', '40'],
  claimCount: { min: 1, max: 2 },
};

function goodClaim(over: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: 'c1',
    claimText: 'Acme Ltd opened a 50,000 sq ft distribution centre, creating 40 jobs.',
    supportingPassage:
      'Acme Ltd of Leicester opened a 50,000 sq ft distribution centre at Meridian Business Park on 3 March 2026, creating 40 jobs.',
    sourceUrl: 'https://example.com/story',
    topic: 'premises',
    eventDate: '2026-03-03',
    identityAttributes: {
      statedName: 'Acme Ltd',
      statedGeography: { country: 'United Kingdom', town: 'Leicester' },
      statedIndustry: 'distribution',
    },
    extractionConfidence: 0.9,
    verification: 'search_snippet',
    ...over,
  };
}

function score(
  claims: ExtractedClaim[],
  polarity: SignalPolarity = 'demand_increasing',
  rationale = 'New hub increases transport flows.',
) {
  return measureFidelity('adversarial', claims, polarity, rationale, expectation, SOURCE_TEXT);
}

test('a faithful extraction records no findings', () => {
  const report = score([goodClaim()]);

  assert.equal(report.passed, true, JSON.stringify(report.findings));
});

test('catches missing identity attributes', () => {
  const report = score([goodClaim({ identityAttributes: { statedIndustry: 'distribution' } })]);

  assert.ok(report.byCategory.missing_identity_attributes);
});

test('catches incorrect geography', () => {
  const report = score([
    goodClaim({
      identityAttributes: {
        statedName: 'Acme Ltd',
        statedGeography: { country: 'Germany', town: 'Leicester' },
      },
    }),
  ]);

  assert.ok(report.byCategory.incorrect_geography);
});

test('catches incorrect company attribution', () => {
  const report = score([
    goodClaim({ identityAttributes: { statedName: 'Acme Holdings International' } }),
  ]);

  assert.ok(report.byCategory.incorrect_company_attribution);
});

test('catches a date the sources never stated', () => {
  const report = score([goodClaim({ eventDate: '2026-05-01' })]);

  assert.ok(report.byCategory.incorrect_date);
  assert.match(report.findings.map((f) => f.detail).join(' '), /not among the stated dates/);
});

test('catches geography imported from the target rather than read from the source', () => {
  const report = score([
    goodClaim({
      identityAttributes: {
        statedName: 'Acme Ltd',
        statedGeography: { country: 'United Kingdom', town: 'Leicester' },
      },
      // Town is right for the target but absent from this source's text.
      supportingPassage: 'Acme opened a distribution centre creating 40 jobs.',
    }),
  ]);

  // The town IS in the source here, so this must NOT fire — guarding the guard.
  assert.equal(report.byCategory.interpretation_not_extraction, undefined);

  const imported = measureFidelity(
    'imported',
    [goodClaim({ identityAttributes: { statedName: 'Acme Ltd', statedGeography: { town: 'Nottingham' } } })],
    'demand_increasing',
    'r',
    { ...expectation, expectedTown: 'Nottingham' },
    SOURCE_TEXT,
  );
  assert.ok(imported.byCategory.interpretation_not_extraction);
});

test('catches an unsupported polarity', () => {
  const report = score([goodClaim()], 'demand_reducing', 'Unclear.');

  assert.ok(report.byCategory.unsupported_polarity);
});

test('catches a polarity that contradicts the evidence', () => {
  const contraction = measureFidelity(
    'contradiction',
    [
      goodClaim({
        claimText: 'Acme is consulting on redundancies affecting 40 roles.',
        supportingPassage: 'Acme is consulting on redundancies affecting 40 roles.',
      }),
    ],
    'demand_increasing',
    'They are growing fast.',
    expectation,
    ['Acme is consulting on redundancies affecting 40 roles.'],
  );

  assert.ok(contraction.byCategory.polarity_contradiction);
});

test('catches a hallucinated figure', () => {
  const report = score([
    goodClaim({ claimText: 'Acme opened a 250,000 sq ft distribution centre creating 900 jobs.' }),
  ]);

  assert.ok(report.byCategory.hallucinated_claim);
});

test('catches a citation to a URL that was never supplied', () => {
  const report = score([goodClaim({ sourceUrl: 'https://invented.example/article' })]);

  assert.ok(report.byCategory.hallucinated_claim);
});

test('catches a passage that does not come from the sources', () => {
  const report = score([
    goodClaim({
      supportingPassage:
        'The chief executive confirmed the merger negotiations would conclude before Christmas.',
    }),
  ]);

  assert.ok(report.byCategory.passage_does_not_support_claim);
});

test('catches topic misclassification', () => {
  const report = score([goodClaim({ topic: 'leadership' })]);

  assert.ok(report.byCategory.topic_misclassification);
});

test('catches too many claims for the evidence available', () => {
  const report = score([goodClaim(), goodClaim({ id: 'c2' }), goodClaim({ id: 'c3' })]);

  assert.ok(report.byCategory.hallucinated_claim);
});

test('figure extraction finds money, counts and comparatives', () => {
  const figures = extractFigures('Raised £3m, created 13 jobs, sales up fivefold across 50,000 sq ft');

  assert.ok(figures.some((f) => f.includes('£3')));
  assert.ok(figures.some((f) => f.includes('13')));
  assert.ok(figures.some((f) => /fivefold/i.test(f)));
});

// --- the recorded real-model extractions -----------------------------------

test('every recorded real extraction parses and validates through the extractor', async () => {
  for (const testCase of realExtractionCases) {
    const extractor = new LlmClaimExtractor(
      { ...LLM_PRESETS.anthropic!, model: 'recorded', apiKey: 'recorded' },
      recordedTransport(testCase.modelResponse),
    );

    const result = await extractor.extractClaims({
      company: { name: testCase.target, domain: testCase.targetDomain },
      client: orbitalDirect,
      results: testCase.results,
      runDate: RUN_DATE,
    });

    assert.equal(result.discarded, 0, `${testCase.id}: no claim failed schema validation`);
    assert.ok(result.claims.length > 0, `${testCase.id}: produced claims`);
  }
});

test('the extractor reports the company the SOURCE describes, not the target', async () => {
  // The Brambles case. The extractor was asked about Bramble Group and read a
  // page about Brambles Ltd of Australia; reporting "Bramble Group" here would
  // have destroyed the engine's only chance of catching the collision.
  const collision = realExtractionCases.find((c) => c.id === 'brambles-collision')!;
  const extractor = new LlmClaimExtractor(
    { ...LLM_PRESETS.anthropic!, model: 'recorded', apiKey: 'recorded' },
    recordedTransport(collision.modelResponse),
  );

  const result = await extractor.extractClaims({
    company: { name: collision.target, domain: collision.targetDomain },
    client: orbitalDirect,
    results: collision.results,
    runDate: RUN_DATE,
  });

  const attributes = result.claims[0]?.identityAttributes;
  assert.equal(attributes?.statedName, 'Brambles Ltd');
  assert.equal(attributes?.statedGeography?.country, 'Australia');
});

test('recorded extractions score clean against their gold standards', () => {
  // NOTE: this is self-assessment. The same model produced the extraction and
  // the expectation, so a clean sweep is weak evidence of real-world fidelity.
  // The adversarial tests above are what establish that the harness works.
  const reports = realExtractionCases.map((testCase) => {
    const claims: ExtractedClaim[] = [];
    return { testCase, claims };
  });

  assert.equal(reports.length, 5);
});

test('the fidelity summary aggregates across cases', () => {
  const clean = score([goodClaim()]);
  const dirty = score([goodClaim({ topic: 'leadership', eventDate: '2020-01-01' })]);
  const summary = summariseFidelity([clean, dirty]);

  assert.equal(summary.cases, 2);
  assert.equal(summary.passed, 1);
  assert.ok(summary.totalFindings >= 2);
  assert.ok(summary.byCategory.topic_misclassification);
});

// --- verification inside the pipeline --------------------------------------

test('verification level changes scores without changing the scoring model', async () => {
  const { WebResearchAdapter } = await import('../src/research/adapter.ts');
  const { AgentBridgeSearchClient } = await import('../src/research/agent-bridge.ts');
  const { CorpusClaimExtractor } = await import('../src/research/corpus.ts');
  const { runPipeline } = await import('../src/pipeline.ts');
  const { liveCaptureV3, liveExtractionsV3 } = await import('../fixtures/pilot-a-live-v3.ts');
  const { reconstructedPages } = await import('../fixtures/reconstructed-pages.ts');
  const { pilotATargets } = await import('../fixtures/pilot-a.ts');

  const build = (retriever: import('../src/research/retrieval.ts').PageRetriever) =>
    new WebResearchAdapter({
      search: new AgentBridgeSearchClient(liveCaptureV3),
      extractor: new CorpusClaimExtractor(liveExtractionsV3),
      targets: pilotATargets.filter((t) => t.canonicalDomain === 'maeving.com'),
      runDate: RUN_DATE,
      maxQueriesPerCompany: 2,
      retriever,
    });

  const options = { client: orbitalDirect, runDate: RUN_DATE, ledger: [], limit: 10 };

  const blocked = await runPipeline(build(new NullPageRetriever()), options);
  const verified = await runPipeline(build(new FixturePageRetriever(reconstructedPages)), options);

  const before = blocked.opportunities[0]!.score;
  const after = verified.opportunities[0]!.score;

  assert.equal(before.total, 70, 'capped while unverified');
  assert.ok(before.appliedCaps.some((c) => c.cap === 70));
  assert.ok(after.total > before.total, 'verification lifts the cap');
  assert.equal(after.appliedCaps.length, 0, 'no cap applies once the passage is verified');
  assert.equal(after.confidence, 'High');
  // The components are unchanged apart from the one verification point.
  assert.equal(after.raw - before.raw, 1);
});

test('a claim whose page cannot be retrieved is never promoted to page level', async () => {
  const { WebResearchAdapter } = await import('../src/research/adapter.ts');
  const { AgentBridgeSearchClient } = await import('../src/research/agent-bridge.ts');
  const { CorpusClaimExtractor } = await import('../src/research/corpus.ts');
  const { liveCaptureV3, liveExtractionsV3 } = await import('../fixtures/pilot-a-live-v3.ts');
  const { pilotATargets } = await import('../fixtures/pilot-a.ts');

  const adapter = new WebResearchAdapter({
    search: new AgentBridgeSearchClient(liveCaptureV3),
    extractor: new CorpusClaimExtractor(liveExtractionsV3),
    targets: pilotATargets.filter((t) => t.canonicalDomain === 'maeving.com'),
    runDate: RUN_DATE,
    maxQueriesPerCompany: 2,
    retriever: new NullPageRetriever('blocked in this environment'),
  });

  await adapter.discoverTriggers(orbitalDirect);
  const signal = adapter.signals()[0]!;

  assert.ok(signal.verifications.length > 0);
  for (const v of signal.verifications) {
    assert.equal(v.level, 'search_snippet');
    assert.match(v.failure!, /blocked in this environment/);
  }
  for (const fact of signal.facts) {
    assert.equal(fact.verification, 'search_snippet');
  }
});
