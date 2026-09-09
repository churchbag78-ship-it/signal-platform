/**
 * Source registry, claim extraction and polarity validation.
 *
 * The load-bearing rule: the model extracts attributes, the engine decides.
 * An extractor has no way to assert "this source is about the target" and no
 * way to produce a Fact.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IdentityFingerprint } from '../src/domain.ts';
import { classifySource } from '../src/research/sources.ts';
import { lookupRegistry, registryStats, SOURCE_REGISTRY } from '../src/research/registry.ts';
import {
  promoteToFact,
  validateExtractedClaim,
  validatePolarity,
  type ExtractedClaim,
} from '../src/research/extraction.ts';
import {
  coerceClaim,
  parseJsonObject,
  buildExtractionPrompt,
  EXTRACTION_SYSTEM_PROMPT,
  LLM_PRESETS,
  LlmClaimExtractor,
  llmExtractorFromEnv,
} from '../src/research/llm-extractor.ts';

const UK = 'United Kingdom';
const RUN_DATE = '2026-09-09';

const baltex: IdentityFingerprint = {
  canonicalName: 'Baltex',
  canonicalDomain: 'baltex.co.uk',
  geography: { country: UK, town: 'Ilkeston' },
  industry: 'Technical textiles manufacturing',
};

function claim(over: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: 'c1',
    claimText: 'Baltex secured a seven-figure funding package.',
    supportingPassage: 'Baltex, headquartered in Ilkeston, received a seven-figure HSBC package.',
    sourceUrl: 'https://www.themanufacturer.com/articles/baltex-funding/',
    topic: 'funding',
    eventDate: '2026-07-20',
    identityAttributes: {
      statedName: 'Baltex',
      statedGeography: { country: UK, town: 'Ilkeston' },
      statedIndustry: 'technical textiles',
    },
    extractionConfidence: 0.9,
    verification: 'search_summary_only',
    ...over,
  };
}

// --- source registry -------------------------------------------------------

test('the registry covers every declared source category', () => {
  const { byCategory, total } = registryStats();

  assert.ok(total > 60, `registry has ${total} entries`);
  for (const category of [
    'official_registry', 'government', 'local_authority_planning', 'news',
    'trade_press', 'industry_body', 'investment', 'property_logistics',
    'recruitment', 'aggregator', 'social',
  ] as const) {
    assert.ok((byCategory[category] ?? 0) > 0, `${category} has entries`);
  }
});

test('every registry entry carries auditable provenance', () => {
  for (const item of SOURCE_REGISTRY) {
    assert.ok(item.provenance.evidence.trim().length > 0, `${item.domain} states why`);
    assert.ok(item.provenance.addedAt, `${item.domain} records when`);
    assert.ok(item.provenance.addedBy, `${item.domain} records who`);
    assert.ok(
      item.outOfScopeTier >= item.tier,
      `${item.domain} is never stronger outside its competence`,
    );
  }
});

test('classification is contextual to the claim, not a blanket whitelist', () => {
  // A job board proves a vacancy exists and proves nothing about a contract.
  const hiring = classifySource('https://indeed.com/job/123', { topic: 'hiring' });
  const contract = classifySource('https://indeed.com/job/123', { topic: 'contract_win' });

  assert.equal(hiring.tier, 3);
  assert.equal(hiring.authoritativeForTopic, true);
  assert.equal(contract.tier, 5);
  assert.equal(contract.authoritativeForTopic, false);
  assert.match(contract.rationale, /this claim is about contract_win/);
});

test('an investor is primary about its own portfolio and weak elsewhere', () => {
  const portfolio = classifySource('https://www.ldc.co.uk/news/x', { topic: 'premises' });
  const unrelated = classifySource('https://www.ldc.co.uk/news/x', { topic: 'hiring' });

  assert.equal(portfolio.tier, 2);
  assert.equal(unrelated.tier, 4);
});

test('the registry now recognises the titles that were silently costing signals', () => {
  // v2 dropped Bramble to 50 because these two were unknown hosts.
  assert.equal(classifySource('https://www.ldc.co.uk/news/x', { topic: 'funding' }).needsReview, false);
  assert.equal(
    classifySource('https://www.foodanddrinktechnology.com/news/1', { topic: 'product' }).tier,
    3,
  );
  assert.equal(classifySource('https://kbbfocus.com/news/1', { topic: 'export_trade' }).tier, 3);
});

test('an unrecognised host stays conservative and flagged', () => {
  const result = classifySource('https://some-blog-nobody-knows.example/post', { topic: 'funding' });

  assert.equal(result.tier, 4);
  assert.equal(result.needsReview, true);
  assert.equal(result.category, 'unknown');
  assert.match(result.rationale, /not in the source registry/);
});

test('a verified owned domain outranks any registry entry', () => {
  const result = classifySource('https://www.devolkitchens.co.uk/blog/x', {
    ownedDomains: ['devolkitchens.com', 'devolkitchens.co.uk'],
    topic: 'export_trade',
  });

  assert.equal(result.tier, 1);
  assert.equal(result.category, 'first_party');
});

test('unknown government hosts resolve through the public-body rule', () => {
  // A host under a registered domain inherits that entry; one that is not
  // falls to the suffix rule rather than to "unknown".
  const inherited = lookupRegistry('some-council.gov.uk');
  assert.equal(inherited?.domain, 'gov.uk', 'inherits the registered parent');

  const bySuffix = lookupRegistry('transport.gov.scot');
  assert.equal(bySuffix?.category, 'government');
  assert.equal(bySuffix?.provenance.addedBy, 'public-suffix-rule');
});

// --- claim schema ----------------------------------------------------------

test('a claim without a source URL is invalid', () => {
  const result = validateExtractedClaim(claim({ sourceUrl: '' }));

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /no source URL/);
});

test('a claim without a supporting passage is invalid', () => {
  const result = validateExtractedClaim(claim({ supportingPassage: '  ' }));

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /no supporting passage/);
});

test('a claim supplying no identity attributes is invalid', () => {
  // This is the rule that stops an extractor asserting "trust me, it's them".
  const result = validateExtractedClaim(claim({ identityAttributes: {} }));

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /no identity attributes/);
});

test('unparseable dates and out-of-range confidence are rejected', () => {
  assert.match(
    validateExtractedClaim(claim({ eventDate: 'last Tuesday' })).errors.join(' '),
    /unparseable eventDate/,
  );
  assert.match(
    validateExtractedClaim(claim({ extractionConfidence: 4 })).errors.join(' '),
    /out-of-range extraction confidence/,
  );
});

// --- promotion to Fact -----------------------------------------------------

test('promotion builds a Fact only after the identity gate passes', () => {
  const outcome = promoteToFact(claim(), baltex, RUN_DATE);

  assert.equal(outcome.status, 'promoted');
  if (outcome.status !== 'promoted') return;

  assert.equal(outcome.fact.kind, 'fact');
  assert.equal(outcome.fact.source.url, claim().sourceUrl);
  assert.equal(outcome.fact.source.tier, 3, 'scored in the context of a funding claim');
  assert.equal(outcome.fact.identity?.status, 'match');
  assert.ok(outcome.fact.attribution, 'the attribution that justified it is retained');
});

test('a claim about a different company is rejected, never promoted', () => {
  const outcome = promoteToFact(
    claim({
      identityAttributes: {
        statedName: 'Baltex',
        statedGeography: { country: 'Germany' },
        statedIndustry: 'automotive components',
      },
    }),
    baltex,
    RUN_DATE,
  );

  assert.equal(outcome.status, 'rejected');
  if (outcome.status !== 'rejected') return;
  assert.equal(outcome.verdict.status, 'identity_collision');
});

test('an invalid claim is rejected before identity is even considered', () => {
  const outcome = promoteToFact(claim({ sourceUrl: 'not-a-url' }), baltex, RUN_DATE);

  assert.equal(outcome.status, 'invalid');
});

test('the claim topic changes the tier the resulting Fact carries', () => {
  const funding = promoteToFact(claim({ topic: 'funding' }), baltex, RUN_DATE);
  const hiring = promoteToFact(claim({ id: 'c2', topic: 'hiring' }), baltex, RUN_DATE);

  assert.equal(funding.status, 'promoted');
  assert.equal(hiring.status, 'promoted');
  if (funding.status !== 'promoted' || hiring.status !== 'promoted') return;

  assert.equal(funding.fact.source.tier, 3, 'The Manufacturer is authoritative on funding');
  assert.equal(hiring.fact.source.tier, 4, 'it is not authoritative on hiring');
});

// --- polarity --------------------------------------------------------------

test('contraction evidence labelled demand_increasing is flagged', () => {
  const check = validatePolarity(
    [claim({ claimText: 'The company is consulting on up to 40 redundancies at its plant.' })],
    'demand_increasing',
    'They are growing.',
  );

  assert.equal(check.consistent, false);
  assert.match(check.warnings.join(' '), /contraction language/);
});

test('contraction read as demand_increasing passes when the rationale addresses it', () => {
  // A cost-reduction vendor may genuinely benefit — but it must say so.
  const check = validatePolarity(
    [claim({ claimText: 'The company is consulting on up to 40 redundancies.' })],
    'demand_increasing',
    'Redundancies signal a cost reduction programme, which is exactly what this client sells into.',
  );

  assert.equal(check.consistent, true);
});

test('expansion evidence labelled demand_reducing is flagged', () => {
  const check = validatePolarity(
    [claim({ claimText: 'The company opened a new facility and is hiring.' })],
    'demand_reducing',
    'Unclear.',
  );

  assert.equal(check.consistent, false);
});

test('polarity declared with no rationale is flagged', () => {
  assert.match(
    validatePolarity([claim()], 'neutral', '  ').warnings.join(' '),
    /no rationale/,
  );
});

// --- LLM extractor ---------------------------------------------------------

test('the extraction prompt forbids the model from deciding attribution', () => {
  assert.match(EXTRACTION_SYSTEM_PROMPT, /must NOT decide whether a source is about the target/);
  assert.match(EXTRACTION_SYSTEM_PROMPT, /must NOT invent a source/);
  assert.match(EXTRACTION_SYSTEM_PROMPT, /Never substitute the publication\s+date/);
});

test('the prompt carries the results, the client and the run date', () => {
  const prompt = buildExtractionPrompt(
    [{ query: 'q', title: 'T', url: 'https://x.com', snippet: 'S', retrievedAt: RUN_DATE }],
    'Orbital Direct',
    'Baltex',
    RUN_DATE,
  );

  assert.match(prompt, /Today is 2026-09-09/);
  assert.match(prompt, /Orbital Direct/);
  assert.match(prompt, /Baltex/);
  assert.match(prompt, /https:\/\/x\.com/);
});

test('model JSON is parsed out of surrounding prose and fences', () => {
  assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonObject('Here you go: {"a":2} — done'), { a: 2 });
  assert.throws(() => parseJsonObject('no json here'), /no JSON object/);
});

test('a model claim is coerced into the schema and validated', () => {
  const good = coerceClaim(
    {
      claimText: 'Baltex secured funding.',
      supportingPassage: 'Baltex, of Ilkeston, secured funding.',
      sourceUrl: 'https://www.themanufacturer.com/x',
      topic: 'funding',
      eventDate: '2026-07-20',
      identityAttributes: { statedName: 'Baltex', statedGeography: { town: 'Ilkeston' } },
      extractionConfidence: 0.9,
      verification: 'sources_opened',
    },
    0,
  );

  assert.ok(good);
  assert.equal(good!.topic, 'funding');
  assert.equal(good!.verification, 'sources_opened');
});

test('a model claim with an unknown topic falls back rather than inventing one', () => {
  const coerced = coerceClaim(
    {
      claimText: 'x',
      supportingPassage: 'x',
      sourceUrl: 'https://x.com/a',
      topic: 'wild_speculation',
      identityAttributes: { statedName: 'Baltex' },
      extractionConfidence: 0.5,
    },
    0,
  );

  assert.equal(coerced?.topic, 'general');
});

test('a model claim with no identity attributes is discarded', () => {
  const coerced = coerceClaim(
    {
      claimText: 'x',
      supportingPassage: 'x',
      sourceUrl: 'https://x.com/a',
      topic: 'funding',
      identityAttributes: {},
      extractionConfidence: 0.9,
    },
    0,
  );

  assert.equal(coerced, null);
});

test('fields the model was not entitled to set are dropped', () => {
  const coerced = coerceClaim(
    {
      claimText: 'x',
      supportingPassage: 'x',
      sourceUrl: 'https://x.com/a',
      topic: 'funding',
      identityAttributes: { statedName: 'Baltex' },
      extractionConfidence: 0.5,
      // Not part of the schema: the model does not get to decide these.
      identityVerdict: 'match',
      sourceTier: 1,
    },
    0,
  );

  assert.ok(coerced);
  assert.equal((coerced as unknown as Record<string, unknown>).identityVerdict, undefined);
  assert.equal((coerced as unknown as Record<string, unknown>).sourceTier, undefined);
});

function stubLlm(text: string, status = 200) {
  return (async () =>
    new Response(JSON.stringify({ content: [{ text }] }), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof globalThis.fetch;
}

test('the LLM extractor returns validated claims and counts what it discarded', async () => {
  const extractor = new LlmClaimExtractor(
    { ...LLM_PRESETS.anthropic!, model: 'test-model', apiKey: 'k' },
    stubLlm(
      JSON.stringify({
        trigger: 'export_finance',
        whatChanged: 'Secured funding.',
        polarity: 'demand_increasing',
        polarityRationale: 'More export volume.',
        claims: [
          {
            claimText: 'Baltex secured funding.',
            supportingPassage: 'Baltex secured a seven-figure package.',
            sourceUrl: 'https://www.themanufacturer.com/x',
            topic: 'funding',
            identityAttributes: { statedName: 'Baltex', statedGeography: { town: 'Ilkeston' } },
            extractionConfidence: 0.9,
          },
          { claimText: 'unsourced nonsense' },
        ],
      }),
    ),
  );

  const result = await extractor.extractClaims({
    company: { name: 'Baltex', domain: 'baltex.co.uk' },
    client: {
      name: 'Orbital Direct',
      domain: 'orbital-direct.com',
      offerings: [],
      demandTriggers: [],
      buyerFunctions: [],
      disqualifiers: [],
    },
    results: [],
    runDate: RUN_DATE,
  });

  assert.equal(result.claims.length, 1);
  assert.equal(result.discarded, 1);
  assert.equal(result.polarity, 'demand_increasing');
  assert.equal(extractor.callsMade, 1);
});

test('an extraction provider error throws rather than reporting nothing found', async () => {
  const extractor = new LlmClaimExtractor(
    { ...LLM_PRESETS.anthropic!, model: 'm', apiKey: 'k' },
    stubLlm('', 500),
  );

  await assert.rejects(
    () =>
      extractor.extractClaims({
        company: { name: 'Baltex', domain: 'baltex.co.uk' },
        client: {
          name: 'c', domain: 'c.com', offerings: [], demandTriggers: [],
          buyerFunctions: [], disqualifiers: [],
        },
        results: [],
        runDate: RUN_DATE,
      }),
    /returned 500/,
  );
});

test('the extractor refuses to author the reasoning chain from claims alone', async () => {
  const extractor = new LlmClaimExtractor(
    { ...LLM_PRESETS.anthropic!, model: 'm', apiKey: 'k' },
    stubLlm(
      JSON.stringify({
        claims: [
          {
            claimText: 'x',
            supportingPassage: 'x',
            sourceUrl: 'https://x.com/a',
            topic: 'funding',
            identityAttributes: { statedName: 'Baltex' },
            extractionConfidence: 0.5,
          },
        ],
      }),
    ),
  );

  await assert.rejects(
    () =>
      extractor.extract({
        company: { name: 'Baltex', domain: 'baltex.co.uk' },
        client: {
          name: 'c', domain: 'c.com', offerings: [], demandTriggers: [],
          buyerFunctions: [], disqualifiers: [],
        },
        results: [],
        runDate: RUN_DATE,
      }),
    /cannot author the inference\/hypothesis/,
    'inventing a hypothesis here would be reasoning presented as reading',
  );
});

test('the extractor declares its own cost and availability for routing', () => {
  const unauthenticated = new LlmClaimExtractor({ ...LLM_PRESETS.anthropic!, model: 'm' });
  assert.equal(unauthenticated.describe().availability, 'unauthenticated');
  assert.equal(unauthenticated.describe().cost.credits, 1);
});

test('env configuration is optional and validated', () => {
  assert.equal(llmExtractorFromEnv({}), null);
  assert.equal(llmExtractorFromEnv({ SIGNAL_LLM_PROVIDER: 'anthropic' }), null);
  assert.throws(
    () =>
      llmExtractorFromEnv({
        SIGNAL_LLM_PROVIDER: 'nope',
        SIGNAL_LLM_API_KEY: 'k',
        SIGNAL_LLM_MODEL: 'm',
      }),
    /unknown extraction provider/,
  );
});
