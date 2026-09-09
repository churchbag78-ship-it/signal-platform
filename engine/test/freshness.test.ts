import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Evidence, Signal } from '../src/domain.ts';
import { assessFreshness, latestSignalDate } from '../src/freshness.ts';

const RUN_DATE = '2026-09-08';

function signal(dates: (string | undefined)[], structural = false): Signal {
  const evidence: Evidence[] = dates.map((d, i) => ({
    claim: `claim ${i}`,
    source: { url: `https://example.com/${i}`, tier: 3, publisher: 'Example' },
    signalDate: d,
    retrievedAt: RUN_DATE,
    verification: 'page_retrieved',
  }));
  return { type: 'test', description: 'test', evidence, structural };
}

test('recency bands follow the published table', () => {
  assert.equal(assessFreshness(signal(['2026-09-01']), RUN_DATE).points, 15);
  assert.equal(assessFreshness(signal(['2026-08-01']), RUN_DATE).points, 13);
  assert.equal(assessFreshness(signal(['2026-05-01']), RUN_DATE).points, 10);
  assert.equal(assessFreshness(signal(['2025-12-01']), RUN_DATE).points, 6);
});

test('a signal older than twelve months is excluded', () => {
  // The Slack & Parr case from Pilot A: a 2020 relocation surfaced by search
  // as though it were current news.
  const result = assessFreshness(signal(['2020-11-01']), RUN_DATE);

  assert.equal(result.excluded, true);
  assert.match(result.reason, /over 12 months/);
});

test('a structural, ongoing situation survives the twelve-month cutoff', () => {
  const result = assessFreshness(signal(['2025-01-15'], true), RUN_DATE);

  assert.equal(result.excluded, false);
  assert.equal(result.points, 6);
  assert.match(result.reason, /structural/);
});

test('the most recent dated evidence sets the signal date', () => {
  const s = signal(['2026-01-10', '2026-08-30', '2025-06-01']);

  assert.equal(latestSignalDate(s), '2026-08-30');
  // 9 days old via the newest evidence; the January date would have scored 10.
  assert.equal(assessFreshness(s, RUN_DATE).points, 15);
  assert.equal(assessFreshness(s, RUN_DATE).ageDays, 9);
});

test('undated evidence scores zero recency but is not excluded', () => {
  const result = assessFreshness(signal([undefined]), RUN_DATE);

  assert.equal(result.ageDays, null);
  assert.equal(result.points, 0);
  assert.equal(result.excluded, false);
});

test('a future-dated signal is treated as a data error, not fresher news', () => {
  const result = assessFreshness(signal(['2027-01-01']), RUN_DATE);

  assert.equal(result.excluded, true);
  assert.match(result.reason, /future/);
});

test('unparseable dates are ignored rather than crashing the run', () => {
  const result = assessFreshness(signal(['not a date', '2026-09-01']), RUN_DATE);

  assert.equal(result.points, 15);
});
