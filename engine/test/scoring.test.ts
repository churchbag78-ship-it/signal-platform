import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Candidate, Evidence } from '../src/domain.ts';
import { scoreCandidate, classify, applicableCaps } from '../src/scoring.ts';
import { assessEvidence } from '../src/evidence.ts';

const RUN_DATE = '2026-09-08';

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    claim: 'Company announced a new facility',
    source: {
      url: 'https://www.gov.uk/example',
      tier: 2,
      publisher: 'GOV.UK',
    },
    signalDate: '2026-08-25',
    retrievedAt: RUN_DATE,
    verification: 'sources_opened',
    ...overrides,
  };
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    company: { name: 'Example Ltd', domain: 'example.com' },
    signal: { type: 'new_premises', description: 'New facility', evidence: [evidence()] },
    icpFitNotes: 'fits',
    contradictions: [],
    inferenceSteps: 1,
    decisionMakerRole: { function: 'Operations', rationale: 'owns site logistics' },
    ...overrides,
  };
}

const strongJudgements = {
  icpFit: 22,
  signalStrength: 19,
  evidenceQuality: 13,
  commercialRelevance: 14,
};

test('a strong, recent, well-sourced candidate scores as a confirmed opportunity', () => {
  const result = scoreCandidate(candidate(), strongJudgements, RUN_DATE);

  assert.equal(result.components.recency, 15);
  assert.equal(result.raw, 22 + 19 + 15 + 13 + 14 + 10);
  assert.equal(result.total, 93);
  assert.equal(result.classification, 'CONFIRMED_OPPORTUNITY');
  assert.equal(result.appliedCaps.length, 0);
});

test('score explanation shows every component, so a score can be argued with', () => {
  const result = scoreCandidate(candidate(), strongJudgements, RUN_DATE);
  const joined = result.explanation.join('\n');

  assert.match(joined, /ICP fit 22\/25/);
  assert.match(joined, /signal strength 19\/20/);
  assert.match(joined, /recency 15\/15/);
  assert.match(joined, /decision-maker role 10\/10 \(Operations\)/);
  assert.match(joined, /= 93/);
});

test('unopened sources cap the score at 70 and hold confidence to Medium', () => {
  const result = scoreCandidate(
    candidate({
      signal: {
        type: 'new_premises',
        description: 'New facility',
        evidence: [evidence({ verification: 'search_summary_only' })],
      },
    }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(result.total, 70);
  assert.ok(result.appliedCaps.some((c) => c.reason.includes('not opened')));
  assert.equal(result.confidence, 'Medium');
});

test('a missing signal date caps the score at 65', () => {
  const result = scoreCandidate(
    candidate({
      signal: {
        type: 'growth_results',
        description: 'Growth reported',
        evidence: [evidence({ signalDate: undefined })],
      },
    }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(result.total, 65);
  assert.equal(result.components.recency, 0);
});

test('syndicated copies of one press release count as a single source', () => {
  // The Baltex case from Pilot A: five outlets, one HSBC release.
  const syndicated = ['thebusinessdesk.com', 'insidermedia.com', 'themanufacturer.com'].map(
    (host) =>
      evidence({
        source: {
          url: `https://${host}/story`,
          tier: 3,
          publisher: host,
          originId: 'hsbc-baltex-release',
        },
      }),
  );

  const assessment = assessEvidence(syndicated);
  assert.equal(assessment.independentSources, 1);

  const result = scoreCandidate(
    candidate({
      signal: { type: 'export_finance', description: 'Funding', evidence: syndicated },
    }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(result.total, 75, 'single trade-press origin caps at 75');
  assert.ok(result.appliedCaps.some((c) => c.reason.includes('single trade-press')));
});

test('genuinely independent trade sources do not trigger the single-source cap', () => {
  const independent = [
    evidence({ source: { url: 'https://a.com/x', tier: 3, publisher: 'A' } }),
    evidence({ source: { url: 'https://b.com/y', tier: 3, publisher: 'B' } }),
  ];

  const caps = applicableCaps(
    candidate({ signal: { type: 't', description: 'd', evidence: independent } }),
    assessEvidence(independent),
  );

  assert.equal(caps.length, 0);
});

test('conflicting evidence caps at 60 and never reaches high confidence', () => {
  const result = scoreCandidate(
    candidate({
      contradictions: [
        { severity: 'conflicting', note: 'facility reported both opened and cancelled' },
      ],
    }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(result.total, 60);
  assert.equal(result.confidence, 'Low');
  assert.equal(result.classification, 'PROBABLE_OPPORTUNITY');
});

test('a fatal contradiction excludes the candidate outright', () => {
  const result = scoreCandidate(
    candidate({
      contradictions: [{ severity: 'fatal', note: 'company is in liquidation' }],
    }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(result.excluded, true);
  assert.equal(result.total, 0);
  assert.equal(result.classification, 'INSUFFICIENT_EVIDENCE');
});

test('each extra inference step costs 10 points', () => {
  const base = scoreCandidate(candidate(), strongJudgements, RUN_DATE);
  const stretched = scoreCandidate(
    candidate({ inferenceSteps: 3 }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(base.total - stretched.total, 20);
  assert.equal(stretched.penalties[0]?.points, 20);
});

test('aggregator-only sourcing caps at 50 and forces Low confidence', () => {
  const weak = [
    evidence({
      source: { url: 'https://directory.example/listing', tier: 4, publisher: 'Directory' },
    }),
  ];

  const result = scoreCandidate(
    candidate({ signal: { type: 't', description: 'd', evidence: weak } }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(result.total, 50);
  assert.equal(result.confidence, 'Low');
  assert.equal(result.classification, 'HYPOTHESIS');
});

test('the lowest applicable cap wins when several apply', () => {
  const weak = [
    evidence({
      source: { url: 'https://directory.example/listing', tier: 4, publisher: 'D' },
      signalDate: undefined,
      verification: 'search_summary_only',
    }),
  ];

  const result = scoreCandidate(
    candidate({ signal: { type: 't', description: 'd', evidence: weak } }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(result.total, 50);
  assert.ok(result.appliedCaps.length >= 3);
});

test('a missing decision-maker role costs 10 points but never blocks an opportunity', () => {
  const result = scoreCandidate(
    candidate({ decisionMakerRole: undefined }),
    strongJudgements,
    RUN_DATE,
  );

  assert.equal(result.components.decisionMakerRole, 0);
  assert.equal(result.excluded, false);
  assert.equal(result.total, 83);
  assert.equal(result.classification, 'CONFIRMED_OPPORTUNITY');
});

test('classification bands match the published rubric', () => {
  assert.equal(classify(75), 'CONFIRMED_OPPORTUNITY');
  assert.equal(classify(74), 'PROBABLE_OPPORTUNITY');
  assert.equal(classify(60), 'PROBABLE_OPPORTUNITY');
  assert.equal(classify(59), 'HYPOTHESIS');
  assert.equal(classify(45), 'HYPOTHESIS');
  assert.equal(classify(44), 'INSUFFICIENT_EVIDENCE');
});

test('component inputs are clamped rather than trusted', () => {
  const result = scoreCandidate(
    candidate(),
    { icpFit: 999, signalStrength: -5, evidenceQuality: 13, commercialRelevance: 14 },
    RUN_DATE,
  );

  assert.equal(result.components.icpFit, 25);
  assert.equal(result.components.signalStrength, 0);
});
