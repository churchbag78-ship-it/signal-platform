import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Claim, Fact, Hypothesis, Inference } from '../src/domain.ts';
import { supportingFacts, validateChain } from '../src/claims.ts';

function fact(id: string, url = 'https://www.gov.uk/x'): Fact {
  return {
    kind: 'fact',
    id,
    statement: `fact ${id}`,
    source: { url, tier: 2, publisher: 'GOV.UK' },
    eventDate: '2026-08-01',
    discoveredAt: '2026-09-08',
    verification: 'page_retrieved',
  };
}

function inference(id: string, derivedFrom: string[]): Inference {
  return {
    kind: 'inference',
    id,
    statement: `inference ${id}`,
    derivedFrom,
    reasoning: 'because',
  };
}

function hypothesis(id: string, derivedFrom: string[], testableBy = 'ask them'): Hypothesis {
  return {
    kind: 'hypothesis',
    id,
    statement: `hypothesis ${id}`,
    derivedFrom,
    reasoning: 'because',
    testableBy,
  };
}

test('a fact-grounded chain validates and reports its depth', () => {
  const claims: Claim[] = [fact('f1'), inference('i1', ['f1']), hypothesis('h1', ['i1'])];
  const result = validateChain(claims);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.depth, 2, 'fact -> inference -> hypothesis is two hops');
  assert.equal(result.factCount, 1);
});

test('a hypothesis drawn straight from facts is one hop, and costs nothing', () => {
  const result = validateChain([fact('f1'), hypothesis('h1', ['f1'])]);

  assert.equal(result.valid, true);
  assert.equal(result.depth, 1);
});

test('depth follows the longest path, not the shortest', () => {
  const claims: Claim[] = [
    fact('f1'),
    inference('i1', ['f1']),
    inference('i2', ['i1']),
    hypothesis('h1', ['f1', 'i2']),
  ];

  assert.equal(validateChain(claims).depth, 3);
});

test('a fact without a source is rejected as an assertion', () => {
  const unsourced = { ...fact('f1'), source: { url: '', tier: 2, publisher: '' } } as Fact;
  const result = validateChain([unsourced, hypothesis('h1', ['f1'])]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /no source URL/);
});

test('a hypothesis with no fact in its ancestry is rejected as speculation', () => {
  // Inference derived only from another inference, grounded in nothing.
  const claims: Claim[] = [inference('i1', ['i2']), inference('i2', ['i1']), hypothesis('h1', ['i1'])];
  const result = validateChain(claims);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /not grounded in any fact|circular/);
});

test('a chain with no hypothesis is rejected — facts alone are not an opportunity', () => {
  const result = validateChain([fact('f1'), inference('i1', ['f1'])]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /no commercial hypothesis/);
});

test('an inference derived from nothing is rejected', () => {
  const result = validateChain([fact('f1'), inference('i1', []), hypothesis('h1', ['f1'])]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /derives from nothing/);
});

test('a reference to an unknown claim is rejected', () => {
  const result = validateChain([fact('f1'), hypothesis('h1', ['f1', 'ghost'])]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /unknown claim "ghost"/);
});

test('a circular chain is caught rather than hanging', () => {
  const claims: Claim[] = [
    fact('f1'),
    inference('i1', ['i2']),
    inference('i2', ['i1']),
    hypothesis('h1', ['f1']),
  ];
  const result = validateChain(claims);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /circular/);
});

test('a self-referencing claim is rejected', () => {
  const result = validateChain([fact('f1'), hypothesis('h1', ['h1'])]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /derives from itself/);
});

test('an untestable hypothesis is rejected — that is an opinion', () => {
  const result = validateChain([fact('f1'), hypothesis('h1', ['f1'], '   ')]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /states no way to test it/);
});

test('duplicate claim ids are rejected', () => {
  const result = validateChain([fact('f1'), fact('f1'), hypothesis('h1', ['f1'])]);

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /duplicate claim id/);
});

test('supporting facts walks the whole ancestry, de-duplicated', () => {
  const claims: Claim[] = [
    fact('f1'),
    fact('f2'),
    inference('i1', ['f1', 'f2']),
    inference('i2', ['f1']),
    hypothesis('h1', ['i1', 'i2']),
  ];

  const facts = supportingFacts('h1', claims);
  assert.deepEqual(facts.map((f) => f.id).sort(), ['f1', 'f2']);
});
