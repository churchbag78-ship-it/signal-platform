/**
 * Date attribution — which date, if any, dates the change.
 *
 * Two defects the commercial benchmark found, both of them dating errors:
 *
 *  - **deVOL** was dated 2026-05-06, the day its King's Award was announced.
 *    The award is not the change; it recognises six years of growth the source
 *    does not date at all. The engine scored a "why now" against the wrong
 *    event, and its own caveat said so — recorded, then not acted on.
 *
 *  - **NMS** stated on its own site that twelve hospital sites are under
 *    construction, with no date. Its oldest corroborating facts carried dates,
 *    so the signal took the most recent of THOSE — 27 months old — and was
 *    excluded as stale. Adding a corroborating source made a current claim look
 *    older.
 *
 * The rule this file implements: **the change is dated by the claims that
 * establish it, and by dates that actually date it.** Corroboration cannot age
 * a signal, and a recognition or a reporting period cannot date one.
 *
 * An undated change is UNDATED, which is a different state from old. It scores
 * no recency, is capped on evidence, and stays reportable — because "we do not
 * know when" is a research question, and "it happened three years ago" is a
 * rejection.
 */

import type { Candidate, DateBasis, Fact, IsoDate } from './domain.ts';
import { datesTheChange } from './domain.ts';

/**
 * Whether the CHANGE is dated, as opposed to whether any source carries a date.
 *
 * These came apart the moment dates were attributed: deVOL's evidence is dated
 * 2026-05-06 and its change is not dated at all, because that date belongs to
 * an award. Anything that penalises an undated signal has to ask this question,
 * not the source-level one, or it will wave through a change whose timing
 * nobody has established.
 */
export function changeIsDated(candidate: Candidate, sourcesCarryDates: boolean): boolean {
  if (candidate.signal.changeDate !== undefined) return candidate.signal.changeDate !== null;
  return sourcesCarryDates;
}

export interface DateContribution {
  claimId: string;
  date: IsoDate;
  basis: DateBasis;
  /** True when no basis was supplied and `change_occurred` was assumed. */
  assumed: boolean;
}

export interface RejectedDate extends DateContribution {
  reason: string;
}

export interface SignalDating {
  /** The date of the change, or null when nothing dates it. */
  changeDate: IsoDate | null;
  /** The basis of the winning date. */
  basis?: DateBasis;
  /** Claims that dated the change, most recent first. */
  datedBy: DateContribution[];
  /** Dates present in the evidence that were NOT allowed to date the change. */
  rejected: RejectedDate[];
  /** True when the trigger attribution was supplied rather than inferred. */
  triggerAttributed: boolean;
  notes: string[];
}

export interface DatingInput {
  /** Facts that survived the identity gate. */
  facts: Fact[];
  /**
   * Claim ids that establish the change named in `whatChanged`. When absent,
   * every fact is treated as trigger-bearing, which is the pre-attribution
   * behaviour and errs towards dating the signal rather than not.
   */
  triggerClaimIds?: string[];
}

/**
 * Attribute a date to the change.
 *
 * Nothing here repairs a bad date. A date that cannot date the change is
 * recorded as rejected, with the reason, so the absence is auditable.
 */
export function attributeSignalDate(input: DatingInput): SignalDating {
  const { facts } = input;
  const triggerIds = input.triggerClaimIds;
  const triggerAttributed = Array.isArray(triggerIds) && triggerIds.length > 0;

  const known = new Set(facts.map((f) => f.id));
  const notes: string[] = [];

  if (triggerAttributed) {
    const missing = triggerIds.filter((id) => !known.has(id));
    if (missing.length > 0) {
      notes.push(
        `trigger claim(s) ${missing.join(', ')} did not survive to the fact set — ` +
          'the change may now rest on corroboration alone',
      );
    }
  } else {
    notes.push(
      'no trigger claims were attributed, so every supporting fact was allowed to date the change',
    );
  }

  const isTrigger = (fact: Fact) => !triggerAttributed || triggerIds!.includes(fact.id);

  const datedBy: DateContribution[] = [];
  const rejected: RejectedDate[] = [];

  for (const fact of facts) {
    if (!fact.eventDate) continue;

    const assumed = fact.dateBasis === undefined;
    const basis: DateBasis = fact.dateBasis ?? 'change_occurred';
    const contribution: DateContribution = { claimId: fact.id, date: fact.eventDate, basis, assumed };

    if (!datesTheChange(basis)) {
      rejected.push({
        ...contribution,
        reason:
          basis === 'recognition'
            ? 'the date belongs to a recognition of the change, not to the change'
            : 'the date covers a reporting period rather than a point event',
      });
      continue;
    }

    if (!isTrigger(fact)) {
      rejected.push({
        ...contribution,
        reason: 'corroborating evidence, not the claim that establishes the change',
      });
      continue;
    }

    datedBy.push(contribution);
  }

  datedBy.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const winner = datedBy[0];
  if (winner?.basis === 'announced') {
    notes.push(
      `dated by the announcement of ${winner.date}, which may postdate the change itself`,
    );
  }
  if (winner?.assumed) {
    notes.push(
      `claim "${winner.claimId}" supplied no date basis, so its date was read as the date of the change`,
    );
  }
  if (!winner) {
    notes.push(
      rejected.length > 0
        ? 'no claim dates the change — every date found belongs to something else'
        : 'no claim carries a date for the change',
    );
  }

  return {
    changeDate: winner?.date ?? null,
    ...(winner ? { basis: winner.basis } : {}),
    datedBy,
    rejected,
    triggerAttributed,
    notes,
  };
}
