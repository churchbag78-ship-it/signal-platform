import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Candidate } from '../src/domain.ts';
import { normalizeDomain } from '../src/domain.ts';
import {
  checkAgainstHistory,
  parseLedgerCsv,
  toLedgerCsv,
  type LedgerEntry,
} from '../src/dedupe.ts';

function candidate(domain: string, signalType: string, signalDate?: string): Candidate {
  return {
    company: { name: 'Example Ltd', domain },
    signal: {
      type: signalType,
      description: 'test',
      evidence: [
        {
          claim: 'test',
          source: { url: 'https://example.com/a', tier: 3, publisher: 'Example' },
          signalDate,
          retrievedAt: '2026-09-08',
          verification: 'sources_opened',
        },
      ],
    },
    icpFitNotes: '',
    contradictions: [],
    inferenceSteps: 1,
  };
}

const ledger: LedgerEntry[] = [
  {
    runDate: '2026-06-01',
    company: 'Example Ltd',
    domain: 'example.com',
    signalType: 'new_premises',
    signalDate: '2026-05-20',
    score: 80,
    confidence: 'High',
  },
];

test('domains are normalised before identity is compared', () => {
  assert.equal(normalizeDomain('https://WWW.Example.com/about'), 'example.com');
  assert.equal(normalizeDomain('  example.com:443  '), 'example.com');
});

test('an unseen company is included', () => {
  const verdict = checkAgainstHistory(candidate('newco.co.uk', 'funding'), ledger);

  assert.equal(verdict.action, 'include');
});

test('the same company with the same signal is excluded', () => {
  const verdict = checkAgainstHistory(
    candidate('https://www.example.com', 'new_premises', '2026-05-20'),
    ledger,
  );

  assert.equal(verdict.action, 'exclude');
  assert.match(verdict.reason, /already reported/);
});

test('the same company with a different signal is included, with a note', () => {
  const verdict = checkAgainstHistory(candidate('example.com', 'funding', '2026-09-01'), ledger);

  assert.equal(verdict.action, 'include_with_note');
  assert.match(verdict.reason, /different signal/);
  assert.equal(verdict.priorEntry?.signalType, 'new_premises');
});

test('the same signal type is re-reportable only when materially newer', () => {
  const soon = checkAgainstHistory(
    candidate('example.com', 'new_premises', '2026-07-01'),
    ledger,
  );
  assert.equal(soon.action, 'exclude', '42 days on is the same story');

  const later = checkAgainstHistory(
    candidate('example.com', 'new_premises', '2026-09-01'),
    ledger,
  );
  assert.equal(later.action, 'include_with_note', '104 days on is a new story');
  assert.match(later.reason, /days newer/);
});

test('a repeat signal with no date is excluded rather than assumed new', () => {
  const verdict = checkAgainstHistory(candidate('example.com', 'new_premises'), ledger);

  assert.equal(verdict.action, 'exclude');
  assert.match(verdict.reason, /no new date/);
});

test('ledger CSV round-trips, including names containing commas', () => {
  const entries: LedgerEntry[] = [
    {
      runDate: '2026-09-08',
      company: 'Smith, Jones & Co',
      domain: 'https://www.smithjones.co.uk',
      signalType: 'export_finance',
      signalDate: '2026-08-15',
      score: 88,
      confidence: 'Medium',
    },
  ];

  const parsed = parseLedgerCsv(toLedgerCsv(entries));

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.company, 'Smith, Jones & Co');
  assert.equal(parsed[0]?.domain, 'smithjones.co.uk', 'domain normalised on write');
  assert.equal(parsed[0]?.score, 88);
});

test('an empty ledger parses to no entries', () => {
  assert.deepEqual(parseLedgerCsv(toLedgerCsv([])), []);
});
