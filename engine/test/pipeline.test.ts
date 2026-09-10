import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Candidate } from '../src/domain.ts';
import {
  runPipeline,
  recommendAction,
  type ClientProfile,
  type ResearchAdapter,
} from '../src/pipeline.ts';
import { scoreCandidate, type ScoreJudgements } from '../src/scoring.ts';
import type { LedgerEntry } from '../src/dedupe.ts';

const RUN_DATE = '2026-09-08';

const client: ClientProfile = {
  name: 'Example Freight',
  domain: 'examplefreight.co.uk',
  offerings: ['freight forwarding', 'customs clearance', 'warehousing'],
  demandTriggers: ['export growth', 'new premises', 'new contract'],
  buyerFunctions: ['Operations', 'Supply Chain'],
  disqualifiers: ['third-party logistics providers'],
};

function candidate(
  name: string,
  domain: string,
  signalType: string,
  signalDate: string | undefined,
  overrides: Partial<Candidate> = {},
): Candidate {
  return {
    company: { name, domain },
    signal: {
      type: signalType,
      description: `${name} signal`,
      evidence: [
        {
          claim: 'claim',
          source: { url: `https://gov.uk/${domain}`, tier: 2, publisher: 'GOV.UK' },
          signalDate,
          retrievedAt: RUN_DATE,
          verification: 'page_retrieved',
        },
      ],
    },
    icpFitNotes: 'fits',
    contradictions: [],
    inferenceSteps: 1,
    decisionMakerRole: { function: 'Operations', rationale: 'owns freight' },
    ...overrides,
  };
}

const judgements: ScoreJudgements = {
  icpFit: 22,
  signalStrength: 18,
  evidenceQuality: 13,
  commercialRelevance: 14,
};

function adapterFor(candidates: Candidate[]): ResearchAdapter {
  return {
    async discoverTriggers() {
      return candidates;
    },
    async assess(candidate) {
      return {
        candidate,
        judgements,
        whyNow: `${candidate.company.name} changed something`,
        salesAngle: 'signal -> problem -> solution',
      };
    },
  };
}

test('the pipeline reports opportunities ranked by score', async () => {
  const strong = candidate('Strong', 'strong.com', 'export_finance', '2026-09-01');
  const weaker = candidate('Weaker', 'weaker.com', 'new_premises', '2026-04-01');

  const result = await runPipeline(adapterFor([weaker, strong]), {
    client,
    runDate: RUN_DATE,
    ledger: [],
    limit: 10,
  });

  assert.equal(result.opportunities.length, 2);
  assert.equal(result.opportunities[0]?.company.name, 'Strong');
  assert.ok(
    result.opportunities[0]!.score.total > result.opportunities[1]!.score.total,
  );
});

test('the pipeline returns fewer than requested rather than padding', async () => {
  const only = [candidate('Only', 'only.com', 'funding', '2026-09-01')];

  const result = await runPipeline(adapterFor(only), {
    client,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
  });

  assert.equal(result.opportunities.length, 1);
  assert.equal(result.funnel.reported, 1);
});

test('stale candidates are dropped at the freshness stage, before assessment', async () => {
  let assessments = 0;
  const stale = candidate('Stale', 'stale.com', 'new_premises', '2020-11-01');
  const adapter: ResearchAdapter = {
    async discoverTriggers() {
      return [stale];
    },
    async assess(c) {
      assessments += 1;
      return { candidate: c, judgements, whyNow: '', salesAngle: '' };
    },
  };

  const result = await runPipeline(adapter, {
    client,
    runDate: RUN_DATE,
    ledger: [],
    limit: 10,
  });

  assert.equal(result.opportunities.length, 0);
  assert.equal(assessments, 0, 'no assessment effort spent on stale news');
  assert.equal(result.dropped[0]?.stage, 'freshness');
});

test('candidates without a resolvable domain cannot enter the pipeline', async () => {
  const anonymous = candidate('No Domain', '', 'funding', '2026-09-01');

  const result = await runPipeline(adapterFor([anonymous]), {
    client,
    runDate: RUN_DATE,
    ledger: [],
    limit: 10,
  });

  assert.equal(result.opportunities.length, 0);
  assert.equal(result.dropped[0]?.stage, 'identity');
});

test('duplicates within a single run are collapsed on domain', async () => {
  const a = candidate('Example', 'https://www.example.com', 'funding', '2026-09-01');
  const b = candidate('Example Ltd', 'example.com', 'funding', '2026-09-01');

  const result = await runPipeline(adapterFor([a, b]), {
    client,
    runDate: RUN_DATE,
    ledger: [],
    limit: 10,
  });

  assert.equal(result.opportunities.length, 1);
  assert.equal(result.dropped[0]?.stage, 'identity');
});

test('previously reported signals are excluded against the run ledger', async () => {
  const ledger: LedgerEntry[] = [
    {
      runDate: '2026-08-01',
      company: 'Repeat',
      domain: 'repeat.com',
      signalType: 'funding',
      signalDate: '2026-07-20',
      score: 80,
      confidence: 'High',
    },
  ];

  const result = await runPipeline(
    adapterFor([candidate('Repeat', 'repeat.com', 'funding', '2026-07-20')]),
    { client, runDate: RUN_DATE, ledger, limit: 10 },
  );

  assert.equal(result.opportunities.length, 0);
  assert.equal(result.dropped[0]?.stage, 'dedupe');
});

test('a new signal at a previously reported company is included with a note', async () => {
  const ledger: LedgerEntry[] = [
    {
      runDate: '2026-08-01',
      company: 'Repeat',
      domain: 'repeat.com',
      signalType: 'funding',
      signalDate: '2026-07-20',
      score: 80,
      confidence: 'High',
    },
  ];

  const result = await runPipeline(
    adapterFor([candidate('Repeat', 'repeat.com', 'new_premises', '2026-09-01')]),
    { client, runDate: RUN_DATE, ledger, limit: 10 },
  );

  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0]?.dedupe.action, 'include_with_note');
});

test('the run produces ledger additions for the next run', async () => {
  const result = await runPipeline(
    adapterFor([candidate('Fresh', 'fresh.com', 'funding', '2026-09-01')]),
    { client, runDate: RUN_DATE, ledger: [], limit: 10 },
  );

  assert.deepEqual(result.ledgerAdditions[0], {
    runDate: RUN_DATE,
    company: 'Fresh',
    domain: 'fresh.com',
    signalType: 'funding',
    signalDate: '2026-09-01',
    score: result.opportunities[0]!.score.total,
    confidence: result.opportunities[0]!.score.confidence,
  });
});

test('an opportunity is still produced when no decision maker is known', async () => {
  const result = await runPipeline(
    adapterFor([
      candidate('Anon', 'anon.com', 'funding', '2026-09-01', {
        decisionMakerRole: undefined,
      }),
    ]),
    { client, runDate: RUN_DATE, ledger: [], limit: 10 },
  );

  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0]?.recommendedAction.action, 'identify_decision_maker');
});

test('recommended actions follow the state of the evidence', () => {
  const base = candidate('X', 'x.com', 'funding', '2026-09-01');

  const conflicted = scoreCandidate(
    { ...base, contradictions: [{ severity: 'conflicting', note: 'n' }] },
    judgements,
    RUN_DATE,
  );
  assert.equal(
    recommendAction(conflicted, base.decisionMakerRole).action,
    'manual_review',
  );

  const unopened = scoreCandidate(
    {
      ...base,
      signal: {
        ...base.signal,
        evidence: base.signal.evidence.map((e) => ({
          ...e,
          verification: 'search_snippet' as const,
        })),
      },
    },
    judgements,
    RUN_DATE,
  );
  assert.equal(
    recommendAction(unopened, base.decisionMakerRole).action,
    'research_further',
  );

  const solid = scoreCandidate(base, judgements, RUN_DATE);
  assert.equal(recommendAction(solid, base.decisionMakerRole).action, 'draft_outreach');
});

test('the funnel records what happened at each stage', async () => {
  const result = await runPipeline(
    adapterFor([
      candidate('Good', 'good.com', 'funding', '2026-09-01'),
      candidate('Stale', 'stale.com', 'funding', '2019-01-01'),
      candidate('Nameless', '', 'funding', '2026-09-01'),
    ]),
    { client, runDate: RUN_DATE, ledger: [], limit: 10 },
  );

  assert.deepEqual(result.funnel, {
    discovered: 3,
    identified: 2,
    fresh: 1,
    scored: 1,
    reported: 1,
  });
});
