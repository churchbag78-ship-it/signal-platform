import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AXIS_FLOOR,
  BAND,
  axisConfidence,
  axisCorrelation,
  band,
  compareTwoAxis,
  directionPoints,
  quadrantOf,
  scoreEvidence,
  scoreTwoAxis,
  scoreValue,
} from '../src/two-axis.ts';
import { classify, scoreCandidate, type ScoreJudgements } from '../src/scoring.ts';
import type { Candidate, Evidence, SignalPolarity } from '../src/domain.ts';

const RUN_DATE = '2026-09-09';

function evidence(overrides: Partial<Evidence> & { originId?: string } = {}): Evidence {
  const { originId, ...rest } = overrides;
  return {
    claim: 'The company opened a new site.',
    source: {
      url: 'https://example.com/a',
      publisher: 'example.com',
      tier: 2,
      ...(originId ? { originId } : {}),
    },
    signalDate: '2026-09-01',
    retrievedAt: RUN_DATE,
    verification: 'page_retrieved',
    ...rest,
  };
}

function candidate(overrides: Partial<Candidate> = {}, evidenceList?: Evidence[]): Candidate {
  return {
    company: { name: 'Test Co', domain: 'test.co.uk' },
    signal: {
      type: 'new_premises',
      description: 'opened a new site',
      evidence: evidenceList ?? [evidence()],
    },
    icpFitNotes: 'fits',
    contradictions: [],
    inferenceSteps: 1,
    decisionMakerRole: { function: 'Operations', rationale: 'owns despatch' },
    polarity: 'demand_increasing',
    consequenceActionable: true,
    ...overrides,
  };
}

const JUDGEMENTS: ScoreJudgements = {
  icpFit: 22,
  signalStrength: 16,
  evidenceQuality: 13,
  commercialRelevance: 13,
};

/* --------------------------- independence -------------------------- */

test('the evidence axis is deterministic — researcher judgements cannot move it', () => {
  const c = candidate();
  const modest = scoreEvidence(c);
  // Every judgement doubled; the evidence axis takes none of them as input.
  const generous = scoreEvidence(c);
  assert.equal(modest.score, generous.score);

  const withJudgements = scoreTwoAxis(c, JUDGEMENTS, RUN_DATE);
  const withBetterJudgements = scoreTwoAxis(
    c,
    { icpFit: 25, signalStrength: 20, evidenceQuality: 15, commercialRelevance: 15 },
    RUN_DATE,
  );
  assert.equal(withJudgements.evidence.score, withBetterJudgements.evidence.score);
  assert.ok(withBetterJudgements.value.score > withJudgements.value.score);
});

test('better evidence raises evidence and leaves commercial value untouched', () => {
  // This is the deVOL regression. Under the single-axis model a fourth
  // independent source pushed the total over 75 into CONFIRMED_OPPORTUNITY
  // with nothing about the commercial case changed.
  const oneSource = candidate({}, [evidence({ originId: 'a' })]);
  const fourSources = candidate({}, [
    evidence({ originId: 'a' }),
    evidence({ originId: 'b', source: { url: 'https://b.com/x', publisher: 'b.com', tier: 2, originId: 'b' } }),
    evidence({ originId: 'c', source: { url: 'https://c.com/x', publisher: 'c.com', tier: 2, originId: 'c' } }),
    evidence({ originId: 'd', source: { url: 'https://d.com/x', publisher: 'd.com', tier: 2, originId: 'd' } }),
  ]);

  const thin = scoreTwoAxis(oneSource, JUDGEMENTS, RUN_DATE);
  const rich = scoreTwoAxis(fourSources, JUDGEMENTS, RUN_DATE);

  assert.ok(rich.evidence.score > thin.evidence.score, 'evidence did not rise');
  assert.equal(rich.value.score, thin.value.score, 'commercial value moved on evidence alone');

  // And the single-axis model does exactly what the benchmark complained of.
  const singleThin = scoreCandidate(oneSource, JUDGEMENTS, RUN_DATE);
  const singleRich = scoreCandidate(fourSources, JUDGEMENTS, RUN_DATE);
  assert.equal(singleThin.total, singleRich.total);
});

test('a weaker commercial case lowers value and leaves evidence untouched', () => {
  const c = candidate();
  const strong = scoreTwoAxis(c, JUDGEMENTS, RUN_DATE);
  const weak = scoreTwoAxis(
    c,
    { ...JUDGEMENTS, commercialRelevance: 2, signalStrength: 3 },
    RUN_DATE,
  );
  assert.ok(weak.value.score < strong.value.score);
  assert.equal(weak.evidence.score, strong.evidence.score);
});

test('evidence caps bite the evidence axis only', () => {
  const snippet = candidate({}, [evidence({ verification: 'search_snippet' })]);
  const result = scoreTwoAxis(snippet, JUDGEMENTS, RUN_DATE);
  const retrieved = scoreTwoAxis(candidate(), JUDGEMENTS, RUN_DATE);

  assert.ok(result.evidence.appliedCaps.length > 0);
  assert.ok(result.evidence.score < retrieved.evidence.score);
  assert.equal(result.value.score, retrieved.value.score);
});

test('the reasoning-hop penalty bites value only', () => {
  const direct = scoreTwoAxis(candidate({ inferenceSteps: 1 }), JUDGEMENTS, RUN_DATE);
  const distant = scoreTwoAxis(candidate({ inferenceSteps: 3 }), JUDGEMENTS, RUN_DATE);

  assert.equal(distant.evidence.score, direct.evidence.score);
  assert.equal(distant.value.score, direct.value.score - 20);
});

/* ------------------------- demand direction ------------------------ */

test('demand direction scores the direction of the change, not its existence', () => {
  assert.equal(directionPoints('demand_increasing', true).points, 15);
  assert.equal(directionPoints('neutral', true).points, 7);
  assert.equal(directionPoints('demand_reducing', true).points, 0);
});

test('an unestablished direction scores as neutral, never as growth', () => {
  assert.equal(directionPoints(undefined, true).points, 7);
  assert.ok(directionPoints(undefined, true).reason.includes('not as growth'));
});

test('a consequence judged not actionable scores zero direction whatever the polarity', () => {
  assert.equal(directionPoints('demand_increasing', false).points, 0);
});

test('a demand-reducing change cannot reach ACT_NOW on a perfect commercial case', () => {
  const reducing = candidate({ polarity: 'demand_reducing' });
  const result = scoreTwoAxis(
    reducing,
    { icpFit: 25, signalStrength: 20, evidenceQuality: 15, commercialRelevance: 15 },
    RUN_DATE,
  );
  assert.equal(result.value.components.demandDirection, 0);
  assert.notEqual(result.quadrant, 'ACT_NOW');
  assert.equal(result.contactRecommended, false);
});

test('direction is the component the single-axis model never had', () => {
  const increasing = scoreCandidate(candidate({ polarity: 'demand_increasing' }), JUDGEMENTS, RUN_DATE);
  const reducing = scoreCandidate(candidate({ polarity: 'demand_reducing' }), JUDGEMENTS, RUN_DATE);
  // Identical under the old model: polarity carried no weight at all.
  assert.equal(increasing.total, reducing.total);

  const twoAxisIncreasing = scoreTwoAxis(candidate({ polarity: 'demand_increasing' }), JUDGEMENTS, RUN_DATE);
  const twoAxisReducing = scoreTwoAxis(candidate({ polarity: 'demand_reducing' }), JUDGEMENTS, RUN_DATE);
  assert.equal(twoAxisIncreasing.value.score - twoAxisReducing.value.score, 15);
});

/* ---------------------------- quadrants ---------------------------- */

test('the band boundaries are the single-axis model’s own numbers', () => {
  assert.equal(BAND.high, 75);
  assert.equal(BAND.medium, 60);
  assert.equal(AXIS_FLOOR, 60);
  // Same thresholds the single-axis classifier uses.
  assert.equal(classify(75), 'CONFIRMED_OPPORTUNITY');
  assert.equal(classify(60), 'PROBABLE_OPPORTUNITY');
  assert.equal(band(75), 'high');
  assert.equal(band(60), 'medium');
  assert.equal(band(45), 'low');
  assert.equal(band(44), 'insufficient');
});

test('the four quadrants map to the benchmark’s 2x2', () => {
  assert.equal(quadrantOf(90, 90), 'ACT_NOW');
  assert.equal(quadrantOf(50, 90), 'RESEARCH_PRIORITY');
  assert.equal(quadrantOf(90, 65), 'LOW_VALUE');
  assert.equal(quadrantOf(65, 65), 'WATCH');
});

test('a row is rejected only when NEITHER axis clears the floor', () => {
  assert.equal(quadrantOf(59, 59), 'REJECT');
  // High value on thin evidence is a research priority, not a reject — the
  // benchmark names that cell "verify before contact".
  assert.equal(quadrantOf(20, 90), 'RESEARCH_PRIORITY');
  // Well-proven and commercially thin is reported, not thrown away.
  assert.equal(quadrantOf(95, 30), 'LOW_VALUE');
});

test('a well-evidenced but low-value row is reported and kept off the call sheet', () => {
  const wellSourced = candidate({}, [
    evidence({ originId: 'a' }),
    evidence({ source: { url: 'https://b.com/x', publisher: 'b.com', tier: 2, originId: 'b' } }),
    evidence({ source: { url: 'https://c.com/x', publisher: 'c.com', tier: 2, originId: 'c' } }),
  ]);
  const result = scoreTwoAxis(
    wellSourced,
    { ...JUDGEMENTS, icpFit: 20, signalStrength: 8, commercialRelevance: 5 },
    RUN_DATE,
  );
  assert.ok(result.evidence.score >= BAND.high, `evidence was ${result.evidence.score}`);
  assert.equal(result.quadrant, 'LOW_VALUE');
  assert.equal(result.reportable, true);
  assert.equal(result.contactRecommended, false);
});

test('a high-value row on thin evidence is reported for verification, not contact', () => {
  const thin = candidate({}, [
    evidence({ verification: 'search_snippet', source: { url: 'https://t.com/a', publisher: 't.com', tier: 3 } }),
  ]);
  const result = scoreTwoAxis(
    thin,
    { icpFit: 25, signalStrength: 20, evidenceQuality: 15, commercialRelevance: 15 },
    RUN_DATE,
  );
  assert.equal(result.quadrant, 'RESEARCH_PRIORITY');
  assert.equal(result.reportable, true);
  assert.equal(result.contactRecommended, false);
});

test('a stale signal is excluded outright, whatever either axis says', () => {
  const old = candidate({}, [evidence({ signalDate: '2023-01-01' })]);
  const result = scoreTwoAxis(old, JUDGEMENTS, RUN_DATE);
  assert.equal(result.excluded, true);
  assert.equal(result.quadrant, 'REJECT');
  assert.equal(result.reportable, false);
});

test('a fatal contradiction excludes regardless of scores', () => {
  const conflicted = candidate({
    contradictions: [{ severity: 'fatal', note: 'the sources disagree on whether it happened' }],
  });
  assert.equal(scoreTwoAxis(conflicted, JUDGEMENTS, RUN_DATE).quadrant, 'REJECT');
});

/* -------------------------- confidence ----------------------------- */

test('confidence reads the evidence axis alone', () => {
  const c = candidate();
  const modestCase = scoreTwoAxis(c, { ...JUDGEMENTS, commercialRelevance: 1 }, RUN_DATE);
  const strongCase = scoreTwoAxis(c, JUDGEMENTS, RUN_DATE);
  assert.equal(modestCase.confidence, strongCase.confidence);
});

test('conflicting evidence forces Low confidence however good the sources are', () => {
  const conflicted = candidate({
    contradictions: [{ severity: 'conflicting', note: 'two sources give different dates' }],
  });
  assert.equal(axisConfidence(scoreEvidence(conflicted), conflicted), 'Low');
});

/* ---------------------------- ranking ------------------------------ */

test('ranking orders by commercial value, with evidence breaking ties', () => {
  const wellEvidencedThinCase = scoreTwoAxis(
    candidate(),
    { ...JUDGEMENTS, signalStrength: 5, commercialRelevance: 4 },
    RUN_DATE,
  );
  const thinEvidenceStrongCase = scoreTwoAxis(
    candidate({}, [evidence({ verification: 'search_snippet' })]),
    { icpFit: 25, signalStrength: 20, evidenceQuality: 15, commercialRelevance: 15 },
    RUN_DATE,
  );

  assert.ok(wellEvidencedThinCase.evidence.score > thinEvidenceStrongCase.evidence.score);
  const ordered = [wellEvidencedThinCase, thinEvidenceStrongCase].sort(compareTwoAxis);
  assert.equal(ordered[0], thinEvidenceStrongCase, 'the better-sourced row outranked the more valuable one');
});

test('axis correlation is a real measurement, and undefined when it cannot be one', () => {
  const a = scoreTwoAxis(candidate(), JUDGEMENTS, RUN_DATE);
  assert.equal(axisCorrelation([a]), null);
  // Identical rows have zero variance on both axes.
  assert.equal(axisCorrelation([a, a]), null);
});

/* -------------------- value axis composition ----------------------- */

test('the value axis carries the old weights unchanged, plus direction', () => {
  const result = scoreValue(candidate(), JUDGEMENTS, RUN_DATE);
  assert.equal(result.components.icpFit, 22);
  assert.equal(result.components.signalStrength, 16);
  assert.equal(result.components.commercialRelevance, 13);
  assert.equal(result.components.buyerIdentified, 10);
  assert.equal(result.components.demandDirection, 15);
  // 25 + 20 + 15 + 15 + 15 + 10
  assert.equal(
    Object.values({
      icpFit: 25,
      signalStrength: 20,
      commercialRelevance: 15,
      demandDirection: 15,
      timing: 15,
      buyerIdentified: 10,
    }).reduce((a, b) => a + b, 0),
    100,
  );
});

test('the evidence axis components sum to 100 and every one is source-derived', () => {
  const result = scoreEvidence(candidate());
  const total = Object.values(result.components).reduce((a, b) => a + b, 0);
  assert.equal(result.raw, total);
  assert.ok(total <= 100);
  assert.equal(result.components.dating, 15);
  assert.equal(result.components.verification, 20);
});

test('an undated change loses the dating component and is capped', () => {
  const undated = candidate({}, [evidence({ signalDate: undefined })]);
  const result = scoreEvidence(undated);
  assert.equal(result.components.dating, 0);
  assert.ok(result.appliedCaps.some((c) => c.cap === 65));
});

const polarities: SignalPolarity[] = ['demand_increasing', 'demand_reducing', 'neutral'];
test('every polarity produces a scoreable result', () => {
  for (const polarity of polarities) {
    const result = scoreTwoAxis(candidate({ polarity }), JUDGEMENTS, RUN_DATE);
    assert.ok(Number.isFinite(result.value.score), polarity);
    assert.ok(result.explanation.some((line) => line.includes('demand direction')));
  }
});
