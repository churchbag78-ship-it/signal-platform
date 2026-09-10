/**
 * Signal freshness — docs/RESEARCH_METHODOLOGY.md §4.
 *
 * Freshness is a product principle, not a tiebreaker: Signal exists to find
 * what changed recently, and old information that remains indexed on the web
 * is the main thing that makes a lead list look like intelligence when it
 * isn't.
 */

import type { IsoDate, Signal } from './domain.ts';
import { daysBetween } from './domain.ts';

export interface FreshnessResult {
  /** Age of the signal in days, or null when no date was established. */
  ageDays: number | null;
  /** Recency component of the score, 0-15. */
  points: number;
  /** True when the signal is too old to report at all. */
  excluded: boolean;
  reason: string;
}

export const RECENCY_MAX_POINTS = 15;

/**
 * The earliest signal date among the evidence — the event we are reporting is
 * the most recent thing that happened, not the oldest article about it.
 */
export function latestSignalDate(signal: Signal): IsoDate | null {
  // An attributed change date is authoritative. `null` means attribution ran
  // and found none — an undated change, not an old one — so the evidence scan
  // must not be allowed to substitute an older corroborating date for it.
  if (signal.changeDate !== undefined) return signal.changeDate;

  const dates = signal.evidence
    .map((e) => e.signalDate)
    .filter((d): d is IsoDate => typeof d === 'string' && !Number.isNaN(Date.parse(d)));
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

export function assessFreshness(signal: Signal, runDate: IsoDate): FreshnessResult {
  const date = latestSignalDate(signal);

  if (date === null) {
    // No date is not the same as old. It scores zero here and separately
    // triggers the no-firm-date cap in scoring.
    return {
      ageDays: null,
      points: 0,
      excluded: false,
      reason: 'no signal date established',
    };
  }

  const ageDays = daysBetween(date, runDate);

  if (ageDays < 0) {
    // A future-dated signal is a data error, not a fresher signal.
    return { ageDays, points: 0, excluded: true, reason: 'signal date is in the future' };
  }
  if (ageDays <= 30) return { ageDays, points: 15, excluded: false, reason: '30 days or less' };
  if (ageDays <= 90) return { ageDays, points: 13, excluded: false, reason: '31-90 days' };
  if (ageDays <= 180) return { ageDays, points: 10, excluded: false, reason: '91-180 days' };
  if (ageDays <= 365) {
    return { ageDays, points: 6, excluded: false, reason: '181-365 days — needs a reason it is still live' };
  }
  if (signal.structural) {
    return {
      ageDays,
      points: 6,
      excluded: false,
      reason: 'over 12 months but structural and ongoing',
    };
  }
  return { ageDays, points: 0, excluded: true, reason: 'over 12 months and not structural' };
}
