import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assessDirection, matchOffering, normaliseOffering } from '../src/direction.ts';
import { validateExtractedClaim, type ExtractedClaim } from '../src/research/extraction.ts';
import { measureFidelity } from '../src/research/extraction-fidelity.ts';
import { scoreTwoAxis } from '../src/two-axis.ts';
import { orbitalDirect, pilotATargets } from '../fixtures/pilot-a.ts';
import { liveCaptureV5, liveExtractionsV5 } from '../fixtures/pilot-a-live-v5.ts';
import { reconstructedPagesV5 } from '../fixtures/reconstructed-pages.ts';
import { AgentBridgeSearchClient } from '../src/research/agent-bridge.ts';
import { CorpusClaimExtractor } from '../src/research/corpus.ts';
import { WebResearchAdapter } from '../src/research/adapter.ts';
import { FixturePageRetriever } from '../src/research/retrieval.ts';
import { runPipeline } from '../src/pipeline.ts';
import type { Candidate, Evidence } from '../src/domain.ts';
import type { ScoreJudgements } from '../src/scoring.ts';

const RUN_DATE = '2026-09-09';
const FREIGHT = 'freight forwarding (air, road, sea)';
const WAREHOUSING = 'warehousing, e-commerce fulfilment and FBA prep';
const HAULAGE = 'same-day courier and UK haulage';

const impact = (offering: string, effect: 'increases' | 'reduces' | 'neutral') => ({
  offering,
  effect,
  rationale: 'because the source says so',
});

/* --------------------------- matching ------------------------------ */

test('an offering matches the client profile through wording and punctuation', () => {
  assert.equal(normaliseOffering('Freight Forwarding (air, road, sea)'), 'freight forwarding air road sea');
  assert.equal(matchOffering('freight forwarding', orbitalDirect.offerings), FREIGHT);
  assert.equal(matchOffering('Warehousing', orbitalDirect.offerings), WAREHOUSING);
  assert.equal(matchOffering('UK haulage', orbitalDirect.offerings), HAULAGE);
});

test('an offering the client does not sell does not match', () => {
  assert.equal(matchOffering('management consultancy', orbitalDirect.offerings), null);
  assert.equal(matchOffering('software licensing', orbitalDirect.offerings), null);
});

test('a too-short offering name cannot match anything', () => {
  assert.equal(matchOffering('UK', orbitalDirect.offerings), null);
  assert.equal(matchOffering('', orbitalDirect.offerings), null);
});

/* -------------------------- aggregation ---------------------------- */

test('impacts naming something the client does not sell are ignored and warned about', () => {
  const result = assessDirection(
    [{ id: 'c1', demandImpacts: [impact('management consultancy', 'increases')] }],
    orbitalDirect,
    'demand_increasing',
  );

  assert.equal(result.grounds.length, 0);
  assert.deepEqual(result.ignored, [{ offering: 'management consultancy', claimId: 'c1' }]);
  assert.ok(result.warnings.some((w) => w.includes('does not list as an offering')));
  // And it cannot rescue the direction.
  assert.equal(result.grounded, 'neutral');
});

test('a signal with no declared impact is neutral, never growth', () => {
  const result = assessDirection(
    [{ id: 'c1' }, { id: 'c2', demandImpacts: [] }],
    orbitalDirect,
    'demand_increasing',
  );

  assert.equal(result.grounded, 'neutral');
  assert.equal(result.supported, false);
  assert.ok(result.warnings.some((w) => w.includes('not grounded in any claim')));
});

test('impacts that all point one way ground that direction', () => {
  const up = assessDirection(
    [{ id: 'c1', demandImpacts: [impact('freight forwarding', 'increases')] }],
    orbitalDirect,
    'demand_increasing',
  );
  assert.equal(up.grounded, 'demand_increasing');
  assert.equal(up.supported, true);
  assert.deepEqual(up.increases, [FREIGHT]);

  const down = assessDirection(
    [{ id: 'c1', demandImpacts: [impact('freight forwarding', 'reduces')] }],
    orbitalDirect,
    'demand_reducing',
  );
  assert.equal(down.grounded, 'demand_reducing');
  assert.deepEqual(down.reduces, [FREIGHT]);
});

test('a change that helps one offering and hurts another is neutral, not growth', () => {
  // The Bramble case as a rule: a company opening its own distribution hub buys
  // itself out of third-party storage while creating inter-site movement.
  const result = assessDirection(
    [
      { id: 'c1', demandImpacts: [impact('warehousing', 'reduces')] },
      { id: 'c2', demandImpacts: [impact('UK haulage', 'increases')] },
    ],
    orbitalDirect,
    'demand_increasing',
  );

  assert.equal(result.grounded, 'neutral');
  assert.equal(result.supported, false);
  assert.ok(result.rationale.includes('cuts both ways'));
  assert.deepEqual(result.increases, [HAULAGE]);
  assert.deepEqual(result.reduces, [WAREHOUSING]);
});

test('a declared direction the evidence does not support is reported, not silently kept', () => {
  const result = assessDirection(
    [{ id: 'c1', demandImpacts: [impact('warehousing', 'reduces')] }],
    orbitalDirect,
    'demand_increasing',
  );
  assert.equal(result.grounded, 'demand_reducing');
  assert.equal(result.supported, false);
  assert.ok(
    result.warnings.some((w) => w.includes('declared polarity is demand_increasing')),
    JSON.stringify(result.warnings),
  );
});

test('impacts declared neutral throughout ground neutral without a missing-direction warning', () => {
  const result = assessDirection(
    [{ id: 'c1', demandImpacts: [impact('freight forwarding', 'neutral')] }],
    orbitalDirect,
    'neutral',
  );
  assert.equal(result.grounded, 'neutral');
  assert.equal(result.supported, true);
  assert.ok(!result.warnings.some((w) => w.includes('not grounded')));
});

/* ---------------------------- schema ------------------------------- */

function claim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: 'c1',
    claimText: 'The company opened a site.',
    supportingPassage: 'The company opened a site.',
    sourceUrl: 'https://example.com/a',
    topic: 'premises',
    identityAttributes: { statedName: 'Example Ltd' },
    extractionConfidence: 0.9,
    verification: 'search_snippet',
    ...overrides,
  };
}

test('a demand impact without a rationale is rejected — an effect is not a label', () => {
  const result = validateExtractedClaim(
    claim({ demandImpacts: [{ offering: 'freight forwarding', effect: 'increases', rationale: '' }] }),
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('no rationale')));
});

test('a demand impact with an unknown effect is rejected', () => {
  const result = validateExtractedClaim(
    claim({
      demandImpacts: [
        { offering: 'freight forwarding', effect: 'explodes' as 'increases', rationale: 'why' },
      ],
    }),
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('unknown effect')));
});

test('a claim with no impacts at all is still schema-valid — the engine handles the absence', () => {
  assert.equal(validateExtractedClaim(claim()).valid, true);
});

/* --------------------------- fidelity ------------------------------ */

const EXPECTATION = {
  allowedUrls: ['https://example.com/a'],
  expectedName: 'Example Ltd',
  expectedEventDates: [],
  expectedTopics: ['premises'],
  expectedPolarity: 'demand_increasing' as const,
  sourceFigures: [],
  claimCount: { min: 1, max: 2 },
  clientOfferings: orbitalDirect.offerings,
};

test('fidelity catches an impact on something the client does not sell', () => {
  const report = measureFidelity(
    'case',
    [claim({ demandImpacts: [impact('management consultancy', 'increases')] })],
    'demand_increasing',
    'growth',
    EXPECTATION,
    ['The company opened a site.'],
  );
  assert.ok(report.findings.some((f) => f.category === 'demand_impact_offering_not_sold'));
});

test('fidelity catches a direction grounded in nothing', () => {
  const report = measureFidelity(
    'case',
    [claim()],
    'demand_increasing',
    'growth',
    EXPECTATION,
    ['The company opened a site.'],
  );
  assert.ok(report.findings.some((f) => f.category === 'ungrounded_demand_direction'));
});

/* ---------------------------- scoring ------------------------------ */

function candidate(polarity: Candidate['polarity']): Candidate {
  const evidence: Evidence = {
    claim: 'opened a site',
    source: { url: 'https://example.com/a', publisher: 'example.com', tier: 2 },
    signalDate: '2026-09-01',
    retrievedAt: RUN_DATE,
    verification: 'page_retrieved',
  };
  return {
    company: { name: 'Test Co', domain: 'test.co.uk' },
    signal: { type: 'new_premises', description: 'opened a site', evidence: [evidence] },
    icpFitNotes: 'fits',
    contradictions: [],
    inferenceSteps: 1,
    decisionMakerRole: { function: 'Operations', rationale: 'owns despatch' },
    polarity,
    consequenceActionable: true,
  };
}

const JUDGEMENTS: ScoreJudgements = {
  icpFit: 22,
  signalStrength: 16,
  evidenceQuality: 13,
  commercialRelevance: 13,
};

test('scoring reads the grounded direction, so a mixed change cannot take growth points', () => {
  const growth = scoreTwoAxis(candidate('demand_increasing'), JUDGEMENTS, RUN_DATE);
  const mixed = scoreTwoAxis(candidate('neutral'), JUDGEMENTS, RUN_DATE);
  assert.equal(growth.value.components.demandDirection, 15);
  assert.equal(mixed.value.components.demandDirection, 7);
  assert.equal(growth.value.score - mixed.value.score, 8);
});

/* -------------------------- integration ---------------------------- */

async function pilot() {
  const adapter = new WebResearchAdapter({
    search: new AgentBridgeSearchClient(liveCaptureV5),
    extractor: new CorpusClaimExtractor(liveExtractionsV5),
    targets: pilotATargets,
    runDate: RUN_DATE,
    retriever: new FixturePageRetriever(reconstructedPagesV5),
    queryStrategy: 'change_family',
    familyBudget: 6,
    firstPartySections: ['newsroom', 'press_releases', 'projects'],
    maxFirstPartyPaths: 6,
    prescreen: (company) =>
      ['bleckmann.com', 'aldi.co.uk'].includes(company.domain) ? 'disqualified' : null,
  });

  const result = await runPipeline(adapter, {
    client: orbitalDirect,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
    reportableFloor: 60,
    twoAxis: true,
  });

  return { adapter, result };
}

test('a declared direction the evidence contradicts is caught on live data', async () => {
  const { adapter } = await pilot();
  const bramble = adapter.signals().find((s) => s.company.domain === 'bramblefoods.co.uk')!;

  assert.equal(bramble.declaredPolarity, 'demand_increasing');
  assert.equal(bramble.polarity, 'neutral');
  assert.equal(bramble.direction.supported, false);
  // The disagreement is recorded where a reader will see it, not only in a
  // warnings array.
  assert.ok(
    bramble.contradictions.some((c) => c.note.includes('Declared as demand_increasing')),
    JSON.stringify(bramble.contradictions),
  );
});

test('a genuinely one-way change keeps its growth direction', async () => {
  const { adapter } = await pilot();
  for (const domain of ['maeving.com', 'baltex.co.uk', 'devolkitchens.com']) {
    const signal = adapter.signals().find((s) => s.company.domain === domain)!;
    assert.equal(signal.polarity, 'demand_increasing', domain);
    assert.equal(signal.direction.supported, true, domain);
    assert.deepEqual(signal.direction.reduces, [], domain);
  }
});

test('no impact in the live corpus names an offering Orbital does not sell', async () => {
  const { adapter } = await pilot();
  for (const signal of adapter.signals()) {
    assert.deepEqual(signal.direction.ignored, [], signal.company.name);
  }
});

test('the ungrounded direction stays off the call sheet', async () => {
  const { result } = await pilot();
  const bramble = result.opportunities.find((o) => o.company.domain === 'bramblefoods.co.uk')!;
  assert.equal(bramble.axes!.quadrant, 'LOW_VALUE');
  assert.equal(bramble.axes!.contactRecommended, false);
  assert.equal(bramble.recommendedAction.action, 'monitor');
});
