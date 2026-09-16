import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGrounding, groundingContradictions, properNouns } from '../src/grounding.ts';
import type { Fact } from '../../engine/src/domain.ts';

function fact(id: string, statement: string): Fact {
  return {
    kind: 'fact',
    id,
    statement,
    source: { url: 'https://example.com/a', tier: 2, publisher: 'Example' },
    discoveredAt: '2026-09-16',
    verification: 'page_retrieved',
    attribution: { url: 'https://example.com/a', statedName: 'Example Ltd' },
    identity: {
      status: 'match',
      confidence: 0.9,
      corroborations: ['name'],
      conflicts: [],
      explanation: 'matched on name',
    },
  };
}

test('catches the failure it was built for: a specific in the prose that is in no source', () => {
  // The recorded deVOL defect. "Thailand, China and Denmark" appeared in the
  // brief, in the inference, in the test and in the sales angle — and in no
  // claim text and no supporting passage.
  const report = checkGrounding({
    assertions: {
      whatChanged: 'The company has expanded international sales into Thailand, China and Denmark.',
    },
    facts: [fact('c1', 'The company received a King’s Award for Enterprise in international trade.')],
    allowed: ['Example Ltd'],
  });

  assert.equal(report.grounded, false);
  const specifics = report.findings.map((f) => f.specific);
  assert.deepEqual(specifics, ['Thailand', 'China', 'Denmark']);
});

test('an ungrounded specific in the headline demands a human, not a phone call', () => {
  const report = checkGrounding({
    assertions: { whatChanged: 'They opened a site in Thailand.', salesAngle: 'Mention Bangkok.' },
    facts: [fact('c1', 'They opened a site.')],
  });

  const contradictions = groundingContradictions(report);
  const headline = contradictions.find((c) => c.note.includes('whatChanged'));
  const angle = contradictions.find((c) => c.note.includes('salesAngle'));

  // `conflicting` caps the score at 60 and routes to manual review. It is
  // deliberately not `fatal`: a fatal contradiction discards the signal, and a
  // discarded signal cannot be looked at by the person it was wrong for.
  assert.equal(headline?.severity, 'conflicting');
  assert.equal(angle?.severity, 'caveat');
});

test('prose that stays inside the evidence passes', () => {
  const report = checkGrounding({
    assertions: {
      whatChanged: 'Maeving secured a £3m facility backed by UK Export Finance, creating 13 jobs.',
      whyNow: 'The facility was announced in 2026 and the jobs follow it.',
    },
    facts: [
      fact(
        'c1',
        'Coventry-based Maeving secured a £3m trade finance facility backed by UK Export Finance in 2026, creating 13 new jobs.',
      ),
    ],
    allowed: ['Maeving'],
  });

  assert.equal(report.grounded, true, JSON.stringify(report.findings));
});

test('naming the company and the client is not an unsourced assertion', () => {
  const report = checkGrounding({
    assertions: { salesAngle: 'Orbital Direct should call Weston Beamor about storage.' },
    facts: [fact('c1', 'The company needs storage.')],
    allowed: ['Weston Beamor', 'Orbital Direct'],
  });
  assert.equal(report.grounded, true, JSON.stringify(report.findings));
});

test('a word capitalised only because it starts a sentence is not a name', () => {
  const found = properNouns('Storage demand rose. They opened Peterborough.').map((n) => n.specific);
  assert.deepEqual(found, ['Peterborough']);
});

test('half a name does not ground the whole name', () => {
  const report = checkGrounding({
    assertions: { whatChanged: 'Weston Beamor expanded.' },
    facts: [fact('c1', 'Weston expanded.')],
  });
  assert.equal(report.grounded, false);
});

test('an undated corpus does not ground a year in the prose', () => {
  const report = checkGrounding({
    assertions: { whyNow: 'This happened in 2026.' },
    facts: [fact('c1', 'The company opened a site.')],
  });
  assert.deepEqual(
    report.findings.map((f) => ({ kind: f.kind, specific: f.specific })),
    [{ kind: 'date', specific: '2026' }],
  );
});
