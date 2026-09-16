import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReasoningPrompt, coerceReasoning, Reasoner } from '../src/reasoner.ts';
import type { Fact } from '../../engine/src/domain.ts';
import type { ClientProfile } from '../../engine/src/pipeline.ts';

const client: ClientProfile = {
  name: 'Orbital Direct',
  domain: 'orbitaldirect.co.uk',
  offerings: ['pallet storage', 'export haulage'],
  demandTriggers: ['new overseas market entry'],
  buyerFunctions: ['Operations'],
  disqualifiers: ['companies with their own fleet'],
};

function fact(id: string, statement: string, eventDate?: string): Fact {
  return {
    kind: 'fact',
    id,
    statement,
    source: { url: `https://example.com/${id}`, tier: 2, publisher: 'Example' },
    ...(eventDate ? { eventDate } : {}),
    discoveredAt: '2026-09-16',
    verification: 'page_retrieved',
    attribution: { url: `https://example.com/${id}`, statedName: 'Acme Ltd' },
    identity: {
      status: 'match',
      confidence: 0.9,
      corroborations: ['name'],
      conflicts: [],
      explanation: 'matched',
    },
  };
}

const good = {
  trigger: 'export_finance',
  whatChanged: 'Acme secured export finance.',
  triggerClaimIds: ['c1'],
  inferences: [{ id: 'i1', statement: 'Volumes will rise.', derivedFrom: ['c1'], reasoning: 'finance funds shipments' }],
  hypothesis: {
    id: 'h1',
    statement: 'Acme will need outbound haulage capacity.',
    derivedFrom: ['i1'],
    reasoning: 'more shipments need more capacity',
    testableBy: 'Ask who moves their export pallets today.',
  },
  polarity: 'demand_increasing',
  polarityRationale: 'more shipments',
  consequence: { actionable: true, rationale: 'haulage is sellable here' },
  owningFunction: { function: 'Operations', rationale: 'they own despatch' },
  icpRelevance: { fits: true, rationale: 'exporter without a fleet' },
  contradictions: [],
  judgements: { icpFit: 20, signalStrength: 15, commercialRelevance: 11 },
  whyNow: 'The facility was signed this month.',
  salesAngle: 'Ask how they are moving the extra volume.',
};

test('a well-formed chain is accepted intact', () => {
  const output = coerceReasoning(good, ['c1']);
  assert.equal(output.inferences.length, 1);
  assert.equal(output.hypothesis.derivedFrom[0], 'i1');
  assert.deepEqual(output.triggerClaimIds, ['c1']);
  assert.equal(output.judgements.icpFit, 20);
});

test('an inference derived from a fact that does not exist is rejected, not repaired', () => {
  // The case that matters: the identity gate removed that source, so anything
  // resting on it must not survive.
  assert.throws(
    () => coerceReasoning({ ...good, inferences: [{ ...good.inferences[0], derivedFrom: ['ghost'] }] }, ['c1']),
    /derives from no known fact/,
  );
});

test('a hypothesis floating free of the inferences is rejected', () => {
  assert.throws(
    () => coerceReasoning({ ...good, hypothesis: { ...good.hypothesis, derivedFrom: ['i9'] } }, ['c1']),
    /derives from no inference/,
  );
});

test('a hypothesis with no test is not a hypothesis', () => {
  assert.throws(
    () => coerceReasoning({ ...good, hypothesis: { ...good.hypothesis, testableBy: '' } }, ['c1']),
    /no test/,
  );
});

test('no inferences at all is a refusal, not an empty result', () => {
  assert.throws(() => coerceReasoning({ ...good, inferences: [] }, ['c1']), /no inference/);
});

test('judgements are clamped to their scales rather than trusted', () => {
  const output = coerceReasoning({ ...good, judgements: { icpFit: 99, signalStrength: -4, commercialRelevance: 'x' } }, ['c1']);
  assert.deepEqual(output.judgements, { icpFit: 25, signalStrength: 0, commercialRelevance: 0 });
});

test('an unknown polarity falls back to neutral, never to growth', () => {
  assert.equal(coerceReasoning({ ...good, polarity: 'very_good' }, ['c1']).polarity, 'neutral');
});

test('the prompt shows an undated fact as undated rather than dating it silently', () => {
  const prompt = buildReasoningPrompt({
    company: { name: 'Acme Ltd', domain: 'acme.co.uk' },
    client,
    facts: [fact('c1', 'Acme secured export finance.'), fact('c2', 'Acme opened a site.', '2026-08-01')],
    runDate: '2026-09-16',
  });
  assert.match(prompt, /NOT STATED BY ANY SOURCE/);
  assert.match(prompt, /2026-08-01/);
  assert.match(prompt, /you may use nothing else/);
});

test('reasoning with no facts is refused before a request is made', async () => {
  let called = false;
  const reasoner = new Reasoner({ apiKey: 'k', model: 'm' }, async () => {
    called = true;
    return new Response('{}');
  });
  await assert.rejects(
    () => reasoner.reason({ company: { name: 'A', domain: 'a.com' }, client, facts: [], runDate: '2026-09-16' }),
    /no verified facts/,
  );
  assert.equal(called, false);
});

test('a recorded model response is parsed, coerced and validated end to end', async () => {
  const transport = async () =>
    new Response(JSON.stringify({ content: [{ text: `Here you go:\n${JSON.stringify(good)}` }] }), {
      status: 200,
    });
  const reasoner = new Reasoner({ apiKey: 'k', model: 'm' }, transport as never);
  const output = await reasoner.reason({
    company: { name: 'Acme Ltd', domain: 'acme.co.uk' },
    client,
    facts: [fact('c1', 'Acme secured export finance.')],
    runDate: '2026-09-16',
  });
  assert.equal(output.hypothesis.statement, 'Acme will need outbound haulage capacity.');
  assert.equal(reasoner.callsMade, 1);
});

test('an HTTP failure is loud, because a silent empty result would read as "nothing found"', async () => {
  const transport = async () => new Response('no key', { status: 401 });
  const reasoner = new Reasoner({ apiKey: '', model: 'm' }, transport as never);
  await assert.rejects(
    () =>
      reasoner.reason({
        company: { name: 'Acme Ltd', domain: 'acme.co.uk' },
        client,
        facts: [fact('c1', 'x')],
        runDate: '2026-09-16',
      }),
    /returned HTTP 401/,
  );
});
