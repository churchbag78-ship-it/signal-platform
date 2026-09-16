import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse, summariseEvidence } from '../src/analyse.ts';
import {
  acme,
  claim,
  evidence,
  orbitalDirect,
  reasoningOutput,
  RUN_DATE,
  stubExtractor,
  stubReasoner,
} from './helpers.ts';

function request(overrides: Record<string, unknown> = {}) {
  return {
    client: orbitalDirect,
    target: acme,
    evidence: [evidence()],
    runDate: RUN_DATE,
    extractor: stubExtractor(),
    reasoner: stubReasoner(),
    ...overrides,
  } as Parameters<typeof analyse>[0];
}

test('evidence in, assessed opportunity out — the whole path, no fixtures downstream', async () => {
  const result = await analyse(request());

  assert.equal(result.status, 'opportunity');
  if (result.status !== 'opportunity') return;

  // The chain survived: fact -> inference -> hypothesis.
  assert.equal(result.signal.facts.length, 1);
  assert.equal(result.signal.hypothesis.statement, 'Acme will need additional export haulage capacity.');
  assert.equal(result.signal.inferenceDepth >= 1, true);

  // Verification was EARNED against the pasted page, not asserted.
  assert.equal(result.signal.facts[0]?.verification, 'page_retrieved');

  // Direction was derived from the per-claim demand impacts, not the label.
  assert.equal(result.signal.polarity, 'demand_increasing');
  assert.equal(result.signal.direction.supported, true);

  // The change is dated by the claim that establishes it.
  assert.equal(result.signal.eventDate, '2026-08-14');

  // Two axes, a quadrant and an action a person can follow.
  assert.ok(result.opportunity.axes);
  assert.ok(result.opportunity.axes.evidence.score > 0);
  assert.ok(result.opportunity.recommendedAction.rationale.length > 0);
});

test('a source about a similarly-named company is rejected as an identity failure, not scored', async () => {
  const result = await analyse(
    request({
      extractor: stubExtractor({
        claims: [
          claim({
            identityAttributes: {
              statedName: 'Acme Components Inc',
              statedGeography: { country: 'United States', town: 'Denver' },
              statedIndustry: 'software',
            },
          }),
        ],
      }),
    }),
  );

  assert.equal(result.status, 'rejected');
  if (result.status !== 'rejected') return;
  // NOT `no_trigger_found`. Nobody established that there was nothing to find;
  // they established that the sources were about someone else. Collapsing
  // those two negatives is the failure this assertion exists to catch.
  assert.equal(['identity_unresolved', 'identity_collision'].includes(result.stage), true);
  assert.ok((result.identityRejections ?? []).length > 0);
});

test('a model that cannot be reached is a failed run, never a verdict about the company', async () => {
  const result = await analyse(
    request({
      extractor: {
        id: 'broken',
        async extractClaims() {
          throw new Error('extraction provider anthropic returned 401');
        },
      },
    }),
  );

  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') return;
  assert.equal(result.step, 'extract');
  assert.match(result.reason, /401/);
});

test('reasoning that will not hold together stops the run rather than shipping a brief', async () => {
  const result = await analyse(
    request({
      reasoner: {
        async reason() {
          throw new Error('hypothesis derives from no inference — it would be ungrounded');
        },
      },
    }),
  );
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') return;
  assert.equal(result.step, 'reason');
});

test('no evidence is a refusal to assess, and says so in those words', async () => {
  const result = await analyse(request({ evidence: [] }));
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') return;
  assert.match(result.reason, /no evidence was supplied/);
});

test('a signal the reasoner says is not actionable is reported as exactly that', async () => {
  const result = await analyse(
    request({
      reasoner: stubReasoner(
        reasoningOutput({
          consequence: { actionable: false, rationale: 'they run their own fleet, so haulage is not sellable' },
        }),
      ),
    }),
  );
  assert.equal(result.status, 'rejected');
  if (result.status !== 'rejected') return;
  assert.equal(result.stage, 'no_commercial_consequence');
  assert.match(result.reason, /own fleet/);
});

test('ungrounded specifics cap the score and route to a person instead of a phone call', async () => {
  const result = await analyse(
    request({
      reasoner: stubReasoner(
        reasoningOutput({
          whatChanged: 'Acme opened distribution centres in Thailand, China and Denmark.',
        }),
      ),
    }),
  );

  assert.equal(result.status, 'opportunity');
  if (result.status !== 'opportunity') return;
  assert.equal(result.opportunity.recommendedAction.action, 'manual_review');
  assert.equal(
    result.opportunity.score.appliedCaps.some((cap) => cap.reason.includes('conflicting')),
    true,
  );
  assert.equal(result.trace?.grounding?.grounded, false);
});

test('coverage is reported separately from findings, and does not claim a sweep that never happened', async () => {
  const result = await analyse(request());
  assert.equal(result.status, 'opportunity');
  if (result.status !== 'opportunity') return;
  assert.ok(result.coverage);
  assert.deepEqual(result.coverage.firstPartySectionsCovered, []);
  assert.ok(result.coverage.firstPartySectionsUnchecked.length > 0);
  assert.equal(result.coverage.sourcesSeen, 1);
});

test('the evidence summary distinguishes a pasted page from a pasted snippet', () => {
  const summary = summariseEvidence(
    [
      evidence(),
      evidence({ url: 'https://acmecomponents.co.uk/news/finance', text: '' }),
      evidence({ url: 'https://acmecomponents.co.uk/news/other' }),
    ],
    acme,
  );
  assert.deepEqual(
    { items: summary.items, withBody: summary.withBody, firstParty: summary.firstParty },
    { items: 3, withBody: 2, firstParty: 2 },
  );
});
