import { test } from 'node:test';
import assert from 'node:assert/strict';

import { attributeSignalDate, changeIsDated } from '../src/dating.ts';
import { assessFreshness, latestSignalDate } from '../src/freshness.ts';
import { applicableCaps } from '../src/scoring.ts';
import { scoreEvidence, scoreTwoAxis } from '../src/two-axis.ts';
import { assessEvidence } from '../src/evidence.ts';
import { validateExtractedClaim, type ExtractedClaim } from '../src/research/extraction.ts';
import { measureFidelity } from '../src/research/extraction-fidelity.ts';
import type { Candidate, DateBasis, Evidence, Fact, Signal } from '../src/domain.ts';
import { datesTheChange } from '../src/domain.ts';
import type { ScoreJudgements } from '../src/scoring.ts';

const RUN_DATE = '2026-09-09';

function fact(id: string, eventDate?: string, dateBasis?: DateBasis): Fact {
  return {
    kind: 'fact',
    id,
    statement: `claim ${id}`,
    source: { url: `https://example.com/${id}`, publisher: 'example.com', tier: 2 },
    ...(eventDate ? { eventDate } : {}),
    ...(dateBasis ? { dateBasis } : {}),
    discoveredAt: RUN_DATE,
    verification: 'search_snippet',
  };
}

/* -------------------------- basis rules ---------------------------- */

test('only change_occurred and announced date the change', () => {
  assert.equal(datesTheChange('change_occurred'), true);
  assert.equal(datesTheChange('announced'), true);
  assert.equal(datesTheChange('recognition'), false);
  assert.equal(datesTheChange('reported_period'), false);
  // Absent is the permissive default, and is recorded as an assumption.
  assert.equal(datesTheChange(undefined), true);
});

test('an award date does not date the change it recognises', () => {
  // The deVOL defect: a King's Award announcement gave a six-year growth story
  // a "why now" it had not earned.
  const result = attributeSignalDate({
    facts: [fact('c1', '2026-05-06', 'recognition')],
    triggerClaimIds: ['c1'],
  });

  assert.equal(result.changeDate, null);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0]!.reason.includes('recognition of the change'));
});

test('a reporting period does not date the change either', () => {
  const result = attributeSignalDate({
    facts: [fact('c1', '2026-03-31', 'reported_period')],
    triggerClaimIds: ['c1'],
  });
  assert.equal(result.changeDate, null);
  assert.ok(result.rejected[0]!.reason.includes('reporting period'));
});

test('an announcement dates the change, and says that it might postdate it', () => {
  const result = attributeSignalDate({
    facts: [fact('c1', '2026-08-15', 'announced')],
    triggerClaimIds: ['c1'],
  });
  assert.equal(result.changeDate, '2026-08-15');
  assert.equal(result.basis, 'announced');
  assert.ok(result.notes.some((n) => n.includes('may postdate the change')));
});

test('a date with no stated basis is used, and the assumption is recorded', () => {
  const result = attributeSignalDate({ facts: [fact('c1', '2026-08-15')], triggerClaimIds: ['c1'] });
  assert.equal(result.changeDate, '2026-08-15');
  assert.equal(result.datedBy[0]!.assumed, true);
  assert.ok(result.notes.some((n) => n.includes('supplied no date basis')));
});

/* ------------------------ trigger attribution ---------------------- */

test('corroborating facts cannot age a signal', () => {
  // The NMS defect: an undated current claim took the date of an older,
  // different change that happened to corroborate it.
  const result = attributeSignalDate({
    facts: [
      fact('trigger'),
      fact('recognition', '2024-06-15', 'recognition'),
      fact('older-change', '2022-06-28', 'change_occurred'),
    ],
    triggerClaimIds: ['trigger'],
  });

  assert.equal(result.changeDate, null);
  assert.equal(result.rejected.length, 2);
  assert.ok(
    result.rejected.some((r) => r.reason.includes('not the claim that establishes the change')),
  );
});

test('without trigger attribution every fact may date the change, and that is recorded', () => {
  const result = attributeSignalDate({
    facts: [fact('a', '2022-06-28'), fact('b', '2024-06-15')],
  });
  assert.equal(result.triggerAttributed, false);
  assert.equal(result.changeDate, '2024-06-15');
  assert.ok(result.notes.some((n) => n.includes('no trigger claims were attributed')));
});

test('the most recent trigger date wins', () => {
  const result = attributeSignalDate({
    facts: [fact('a', '2026-01-01'), fact('b', '2026-08-15')],
    triggerClaimIds: ['a', 'b'],
  });
  assert.equal(result.changeDate, '2026-08-15');
  assert.equal(result.datedBy.length, 2);
});

test('a trigger claim rejected upstream is reported, not silently ignored', () => {
  const result = attributeSignalDate({
    facts: [fact('survivor', '2026-08-15')],
    triggerClaimIds: ['survivor', 'rejected-at-identity'],
  });
  assert.ok(result.notes.some((n) => n.includes('did not survive to the fact set')));
});

/* --------------------------- freshness ----------------------------- */

function signal(changeDate: string | null | undefined, evidenceDates: string[]): Signal {
  const evidence: Evidence[] = evidenceDates.map((date, i) => ({
    claim: 'something happened',
    source: { url: `https://example.com/${i}`, publisher: 'example.com', tier: 2 },
    signalDate: date,
    retrievedAt: RUN_DATE,
    verification: 'search_snippet',
  }));
  return {
    type: 'test',
    description: 'test',
    evidence,
    ...(changeDate !== undefined ? { changeDate } : {}),
  };
}

test('an undated change is undated, not old', () => {
  const undated = signal(null, ['2022-06-28', '2024-06-15']);
  assert.equal(latestSignalDate(undated), null);

  const freshness = assessFreshness(undated, RUN_DATE);
  assert.equal(freshness.excluded, false, 'an undated change was excluded as stale');
  assert.equal(freshness.points, 0);
  assert.equal(freshness.reason, 'no signal date established');
});

test('the same evidence without attribution IS excluded — this is the behaviour that changed', () => {
  const unattributed = signal(undefined, ['2022-06-28', '2024-06-15']);
  assert.equal(assessFreshness(unattributed, RUN_DATE).excluded, true);
});

test('an attributed date overrides whatever the evidence carries', () => {
  const attributed = signal('2026-08-15', ['2022-06-28']);
  assert.equal(latestSignalDate(attributed), '2026-08-15');
  assert.equal(assessFreshness(attributed, RUN_DATE).points, 15);
});

test('a genuinely old change is still stale', () => {
  const old = signal('2015-06-01', ['2015-06-01']);
  assert.equal(assessFreshness(old, RUN_DATE).excluded, true);
});

/* ---------------------------- scoring ------------------------------ */

function candidate(changeDate: string | null | undefined, evidenceDates: string[]): Candidate {
  return {
    company: { name: 'Test Co', domain: 'test.co.uk' },
    signal: signal(changeDate, evidenceDates),
    icpFitNotes: 'fits',
    contradictions: [],
    inferenceSteps: 1,
    decisionMakerRole: { function: 'Operations', rationale: 'owns despatch' },
    polarity: 'demand_increasing',
    consequenceActionable: true,
  };
}

test('the no-date cap asks whether the CHANGE is dated, not whether a source is', () => {
  const c = candidate(null, ['2026-05-06']);
  const assessment = assessEvidence(c.signal.evidence);

  // The source carries a date...
  assert.equal(assessment.hasDate, true);
  // ...but the change does not, and that is what the cap reads.
  assert.equal(changeIsDated(c, assessment.hasDate), false);
  const caps = applicableCaps(c, assessment);
  assert.ok(caps.some((cap) => cap.cap === 65 && cap.reason.includes('belong to something else')));
});

test('the evidence axis scores dating on the change, not on the sources', () => {
  const dated = scoreEvidence(candidate('2026-08-15', ['2026-08-15']));
  const undated = scoreEvidence(candidate(null, ['2026-05-06']));

  assert.equal(dated.components.dating, 15);
  assert.equal(undated.components.dating, 0);
  assert.ok(undated.appliedCaps.some((c) => c.cap === 65));
  assert.ok(undated.explanation.some((l) => l.includes('no date established for the change')));
});

const JUDGEMENTS: ScoreJudgements = {
  icpFit: 23,
  signalStrength: 15,
  evidenceQuality: 14,
  commercialRelevance: 13,
};

test('an award-dated signal loses its why-now on both axes and comes off the call sheet', () => {
  const awardDated = scoreTwoAxis(candidate('2026-05-06', ['2026-05-06']), JUDGEMENTS, RUN_DATE);
  const attributed = scoreTwoAxis(candidate(null, ['2026-05-06']), JUDGEMENTS, RUN_DATE);

  assert.ok(attributed.evidence.score < awardDated.evidence.score);
  assert.ok(attributed.value.score < awardDated.value.score);
  assert.equal(attributed.value.components.timing, 0);
  assert.equal(attributed.contactRecommended, false);
});

/* ----------------------------- schema ------------------------------ */

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

test('a date basis with no date to attribute is rejected', () => {
  const result = validateExtractedClaim(claim({ dateBasis: 'recognition' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('no event date to attribute')));
});

test('an unknown date basis is rejected', () => {
  const result = validateExtractedClaim(
    claim({ eventDate: '2026-05-06', dateBasis: 'whenever' as DateBasis }),
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('unknown date basis')));
});

test('fidelity can require a claim to say what its date dates', () => {
  const expectation = {
    allowedUrls: ['https://example.com/a'],
    expectedName: 'Example Ltd',
    expectedEventDates: ['2026-05-06'],
    expectedTopics: ['premises'],
    expectedPolarity: 'demand_increasing' as const,
    sourceFigures: [],
    claimCount: { min: 1, max: 2 },
    requireDateBasis: true,
  };

  const unattributed = measureFidelity(
    'case',
    [claim({ eventDate: '2026-05-06' })],
    'demand_increasing',
    'growth',
    expectation,
    ['The company opened a site on 2026-05-06.'],
  );
  assert.ok(unattributed.findings.some((f) => f.category === 'unattributed_date'));

  const attributed = measureFidelity(
    'case',
    [claim({ eventDate: '2026-05-06', dateBasis: 'change_occurred' })],
    'demand_increasing',
    'growth',
    expectation,
    ['The company opened a site on 2026-05-06.'],
  );
  assert.ok(!attributed.findings.some((f) => f.category === 'unattributed_date'));
});
