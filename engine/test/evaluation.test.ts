import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  actionMix,
  confusion,
  evaluate,
  evidenceAgreement,
  isGenuineOpportunity,
  joinRows,
  matrixCell,
  rankingQuality,
  rates,
  scoreBand,
  twoAxisMatrix,
  valueAgreement,
  type EngineOutcome,
} from '../src/analysis/evaluation.ts';
import { orbitalGoldSet, type GoldEntry } from '../benchmark/gold-set.ts';
import {
  assessReasoning,
  assessReasoningDepth,
  assessSpecificity,
} from '../src/analysis/reasoning.ts';
import type { Claim, Hypothesis } from '../src/domain.ts';

function gold(overrides: Partial<GoldEntry>): GoldEntry {
  return {
    company: 'Test Co',
    domain: 'test.co.uk',
    label: 'B_potential',
    evidence: 'medium',
    value: 'medium',
    whatChanged: 'something',
    engineReported: false,
    ...overrides,
  };
}

function outcome(overrides: Partial<EngineOutcome>): EngineOutcome {
  return {
    domain: 'test.co.uk',
    company: 'Test Co',
    reported: false,
    researched: true,
    ...overrides,
  };
}

test('only A and B labels count as opportunities worth reporting', () => {
  assert.equal(isGenuineOpportunity('A_strong'), true);
  assert.equal(isGenuineOpportunity('B_potential'), true);
  for (const label of ['C_weak', 'D_false_positive', 'E_no_change', 'F_insufficient_evidence'] as const) {
    assert.equal(isGenuineOpportunity(label), false);
  }
});

test('a researched miss and an unresearched miss are counted separately', () => {
  const entries = [
    gold({ company: 'Looked', domain: 'looked.com', label: 'A_strong' }),
    gold({ company: 'Never', domain: 'never.com', label: 'A_strong' }),
  ];
  const rows = joinRows(entries, [
    outcome({ domain: 'looked.com', company: 'Looked', researched: true, rejectedAt: 'no_trigger_found' }),
  ]);

  assert.equal(rows[0]!.verdict, 'false_negative');
  assert.equal(rows[1]!.verdict, 'not_researched');

  const c = confusion(rows);
  assert.equal(c.falseNegatives, 1);
  assert.equal(c.notResearched, 1);
});

test('a prescreened company is not credited as a research finding', () => {
  const rows = joinRows(
    [gold({ company: 'Prescreened', domain: 'p.com', label: 'A_strong' })],
    [outcome({ domain: 'p.com', researched: false, rejectedAt: 'icp' })],
  );
  assert.equal(rows[0]!.verdict, 'not_researched');
});

test('precision and the two false-positive rates are distinct measures', () => {
  const rows = joinRows(
    [
      gold({ domain: 'a.com', label: 'A_strong' }),
      gold({ domain: 'b.com', label: 'C_weak' }),
      gold({ domain: 'c.com', label: 'E_no_change' }),
      gold({ domain: 'd.com', label: 'E_no_change' }),
    ],
    [
      outcome({ domain: 'a.com', reported: true, rank: 1, score: 80 }),
      outcome({ domain: 'b.com', reported: true, rank: 2, score: 70 }),
      outcome({ domain: 'c.com' }),
      outcome({ domain: 'd.com' }),
    ],
  );

  const r = rates(rows);
  assert.equal(r.reported, 2);
  assert.equal(r.precision, 0.5);
  // 1 false positive out of 2 reported.
  assert.equal(r.falsePositiveRate, 0.5);
  // 1 false positive out of 3 that should not have been reported.
  assert.ok(Math.abs(r.falsePositiveRateOverNegatives - 1 / 3) < 1e-9);
});

test('ranking quality reads the gold value grade, never the engine score', () => {
  const rows = joinRows(
    [
      gold({ company: 'Low', domain: 'low.com', value: 'low' }),
      gold({ company: 'High', domain: 'high.com', value: 'high' }),
    ],
    [
      // The engine put the LOW-value company first.
      outcome({ domain: 'low.com', company: 'Low', reported: true, rank: 1, score: 90 }),
      outcome({ domain: 'high.com', company: 'High', reported: true, rank: 2, score: 60 }),
    ],
  );

  const rank = rankingQuality(rows);
  assert.equal(rank.discordant, 1);
  assert.equal(rank.tau, -1);
  assert.deepEqual(rank.inversions, [{ above: 'Low', below: 'High' }]);
});

test('pairs tied on gold value are excluded from tau rather than counted as agreement', () => {
  const rows = joinRows(
    [
      gold({ company: 'One', domain: 'one.com', value: 'medium' }),
      gold({ company: 'Two', domain: 'two.com', value: 'medium' }),
    ],
    [
      outcome({ domain: 'one.com', reported: true, rank: 1 }),
      outcome({ domain: 'two.com', reported: true, rank: 2 }),
    ],
  );

  const rank = rankingQuality(rows);
  assert.equal(rank.tied, 1);
  assert.equal(rank.undiscriminating, true);
  assert.equal(rank.tau, 0);
});

test('evidence agreement flags overstated confidence in the right direction', () => {
  const rows = joinRows(
    [gold({ company: 'Thin', domain: 't.com', evidence: 'low' })],
    [outcome({ domain: 't.com', company: 'Thin', reported: true, rank: 1, confidence: 'High', score: 80 })],
  );

  const agreement = evidenceAgreement(rows);
  assert.equal(agreement.overstated.length, 1);
  assert.equal(agreement.understated.length, 0);
});

test('score bands follow the engine classification thresholds', () => {
  assert.equal(scoreBand(78), 'high');
  assert.equal(scoreBand(75), 'high');
  assert.equal(scoreBand(74), 'medium');
  assert.equal(scoreBand(60), 'medium');
  assert.equal(scoreBand(59), 'low');
});

test('value agreement flags a well-scored low-value row as overstated', () => {
  const rows = joinRows(
    [gold({ company: 'Shiny', domain: 's.com', value: 'low' })],
    [outcome({ domain: 's.com', company: 'Shiny', reported: true, rank: 1, score: 80 })],
  );
  assert.equal(valueAgreement(rows).overstated.length, 1);
});

test('the matrix keeps medium as its own grade instead of collapsing it', () => {
  const rows = joinRows(
    [gold({ company: 'Mid', domain: 'm.com', evidence: 'high', value: 'medium' })],
    [outcome({ domain: 'm.com', reported: true, rank: 1 })],
  );
  const matrix = twoAxisMatrix(rows);
  assert.equal(matrixCell(matrix, 'high', 'medium').length, 1);
  assert.equal(matrixCell(matrix, 'high', 'low').length, 0);
});

test('action mix reports outreach recommended on rows the gold set only calls potential', () => {
  const rows = joinRows(
    [gold({ company: 'Maybe', domain: 'maybe.com', label: 'B_potential' })],
    [outcome({ domain: 'maybe.com', company: 'Maybe', reported: true, rank: 1, action: 'draft_outreach' })],
  );
  const mix = actionMix(rows);
  assert.deepEqual(mix.outreachOnNonStrong, ['Maybe']);
  assert.equal(mix.draftOutreachShare, 1);
});

test('the real gold set joins cleanly and produces a complete evaluation', () => {
  const evaluation = evaluate(orbitalGoldSet, []);
  assert.equal(evaluation.rows.length, orbitalGoldSet.length);
  // With no engine outcomes at all, nothing is reported and every genuine
  // opportunity counts as never researched.
  assert.equal(evaluation.rates.reported, 0);
  assert.equal(evaluation.confusion.notResearched, orbitalGoldSet.filter((g) => isGenuineOpportunity(g.label)).length);
});

/* ---------------------------- reasoning ---------------------------- */

test('generic logistics assertions are detected', () => {
  const cases = [
    'The company may need logistics support following this expansion.',
    'This creates logistics opportunities for a freight partner.',
    'They could benefit from freight services.',
    'The move implies increased shipping needs across the business.',
    'Growth means they will need to move more goods.',
    'The expansion creates supply chain challenges.',
    'They are likely looking for a logistics partner.',
    'This represents potential freight spend.',
  ];
  for (const text of cases) {
    assert.equal(assessSpecificity(text).verdict, 'generic', text);
  }
});

test('a specific consequence with named anchors is not flagged', () => {
  const text =
    'US sales rose fivefold in 2026 and each unit carries a lithium battery, so Class 9 documentation volume on the California lane multiplies.';
  const result = assessSpecificity(text);
  assert.deepEqual(result.generic, []);
  assert.equal(result.verdict, 'specific');
  assert.ok(result.markerCount >= 3);
});

test('a single anchor is thin, not specific', () => {
  const result = assessSpecificity('Volumes into Germany are rising.');
  assert.deepEqual(result.generic, []);
  assert.equal(result.verdict, 'thin');
});

test('generic phrasing outranks anchors — a padded assertion is still generic', () => {
  const result = assessSpecificity(
    'After the £3m raise in August 2026, the US business may need logistics support.',
  );
  assert.equal(result.verdict, 'generic');
});

function chain(testableBy: string): { claims: Claim[]; hypothesis: Hypothesis } {
  const hypothesis: Hypothesis = {
    kind: 'hypothesis',
    id: 'h1',
    statement: 'Freight arrangements are undersized.',
    derivedFrom: ['i1'],
    reasoning: 'because volume rose',
    testableBy,
  };
  const claims: Claim[] = [
    {
      kind: 'fact',
      id: 'f1',
      statement: 'Sales rose fivefold.',
      source: {
        url: 'https://example.com/a',
        publisher: 'example.com',
        tier: 2,
      },
      discoveredAt: '2026-09-09',
      verification: 'search_snippet',
    },
    { kind: 'inference', id: 'i1', statement: 'Volume is up.', derivedFrom: ['f1'], reasoning: 'stated' },
    hypothesis,
  ];
  return { claims, hypothesis };
}

test('a hypothesis whose test is a question reaches all three reasoning levels', () => {
  const { claims, hypothesis } = chain('Ask who handles the Class 9 paperwork today.');
  const depth = assessReasoningDepth(claims, hypothesis);
  assert.equal(depth.levels, 3);
  assert.equal(depth.answersItsOwnQuestion, false);
});

test('a hypothesis that states a conclusion instead of a question is flagged', () => {
  const { claims, hypothesis } = chain('Their incumbent forwarder cannot handle the volume.');
  const depth = assessReasoningDepth(claims, hypothesis);
  assert.equal(depth.thirdOrderQuestion, false);
  assert.equal(depth.answersItsOwnQuestion, true);
  assert.equal(depth.levels, 2);
});

test('a chain with no inference stops at the direct signal', () => {
  const { claims, hypothesis } = chain('Ask who ships it.');
  const withoutInference = claims.filter((c) => c.kind !== 'inference');
  const depth = assessReasoningDepth(withoutInference, hypothesis);
  assert.equal(depth.secondOrder, false);
  assert.equal(depth.levels, 2);
});

test('assessReasoning fails a signal whose sales angle is generic', () => {
  const { claims, hypothesis } = chain('Ask who handles the Class 9 paperwork today.');
  const assessment = assessReasoning({
    company: 'Test Co',
    claims,
    hypothesis,
    salesAngle: 'You may need logistics support.',
    whyNow: 'US sales rose fivefold in August 2026.',
    consequence: 'More Class 9 consignments to the USA.',
  });
  assert.equal(assessment.salesAngle.verdict, 'generic');
  assert.equal(assessment.passes, false);
});
