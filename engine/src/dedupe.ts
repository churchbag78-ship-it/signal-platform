/**
 * Duplicate, freshness and history handling —
 * docs/RESEARCH_METHODOLOGY.md §7.
 *
 * The objective is fresh commercial intelligence. The failure mode this
 * prevents is a daily run quietly degrading into a reworded version of
 * yesterday's list, which is the point at which a client stops opening it.
 */

import type { Candidate, IsoDate } from './domain.ts';
import { daysBetween, normalizeDomain } from './domain.ts';
import { latestSignalDate } from './freshness.ts';

export interface LedgerEntry {
  runDate: IsoDate;
  company: string;
  domain: string;
  signalType: string;
  signalDate: IsoDate | '';
  score: number;
  confidence: string;
  outcome?: string;
}

export type DedupeAction = 'include' | 'include_with_note' | 'exclude';

export interface DedupeVerdict {
  action: DedupeAction;
  reason: string;
  /** The prior entry this decision was made against, when there was one. */
  priorEntry?: LedgerEntry;
}

/**
 * A repeat signal of the same type must be materially newer to be worth
 * re-reporting. 90 days is the point at which "they're still hiring" stops
 * being the same story and becomes a new one.
 */
export const MATERIALLY_NEWER_DAYS = 90;

export function checkAgainstHistory(
  candidate: Candidate,
  ledger: LedgerEntry[],
): DedupeVerdict {
  const domain = normalizeDomain(candidate.company.domain);
  // Identity is the domain. Name matching merges distinct companies and splits
  // single ones, which is worse than no matching at all.
  const priors = ledger.filter((e) => normalizeDomain(e.domain) === domain);

  if (priors.length === 0) {
    return { action: 'include', reason: 'company not seen in previous runs' };
  }

  const candidateDate = latestSignalDate(candidate.signal);
  const sameType = priors.filter((p) => p.signalType === candidate.signal.type);

  if (sameType.length > 0) {
    const mostRecent = sameType.reduce((a, b) =>
      Date.parse(a.signalDate || a.runDate) >= Date.parse(b.signalDate || b.runDate) ? a : b,
    );
    const priorDate = mostRecent.signalDate || mostRecent.runDate;

    if (!candidateDate) {
      return {
        action: 'exclude',
        reason: `same signal type "${candidate.signal.type}" already reported and no new date established`,
        priorEntry: mostRecent,
      };
    }

    const gap = daysBetween(priorDate, candidateDate);
    if (gap >= MATERIALLY_NEWER_DAYS) {
      return {
        action: 'include_with_note',
        reason: `same signal type but ${gap} days newer than the reported instance (${priorDate})`,
        priorEntry: mostRecent,
      };
    }

    return {
      action: 'exclude',
      reason: `same company and same signal type already reported on ${mostRecent.runDate}`,
      priorEntry: mostRecent,
    };
  }

  const mostRecent = priors.reduce((a, b) =>
    Date.parse(a.runDate) >= Date.parse(b.runDate) ? a : b,
  );

  return {
    action: 'include_with_note',
    reason:
      `company previously reported on ${mostRecent.runDate} with signal type ` +
      `"${mostRecent.signalType}"; this is a different signal ("${candidate.signal.type}")`,
    priorEntry: mostRecent,
  };
}

const LEDGER_HEADER =
  'run_date,company,domain,signal_type,signal_date,score,confidence,outcome';

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toLedgerCsv(entries: LedgerEntry[]): string {
  const rows = entries.map((e) =>
    [
      e.runDate,
      escapeCsv(e.company),
      normalizeDomain(e.domain),
      escapeCsv(e.signalType),
      e.signalDate,
      String(e.score),
      e.confidence,
      escapeCsv(e.outcome ?? ''),
    ].join(','),
  );
  return [LEDGER_HEADER, ...rows].join('\n');
}

/** Tolerant of the quoting produced by `toLedgerCsv`; not a general CSV parser. */
export function parseLedgerCsv(csv: string): LedgerEntry[] {
  const lines = csv.trim().split('\n');
  if (lines.length <= 1) return [];

  return lines.slice(1).map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);

    return {
      runDate: cells[0] ?? '',
      company: cells[1] ?? '',
      domain: cells[2] ?? '',
      signalType: cells[3] ?? '',
      signalDate: (cells[4] ?? '') as IsoDate | '',
      score: Number(cells[5] ?? 0),
      confidence: cells[6] ?? '',
      outcome: cells[7] || undefined,
    };
  });
}
