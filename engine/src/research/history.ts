/**
 * Durable research state.
 *
 * ADS Laser Cutting was researched in v1, dropped from the target list in v2,
 * and never looked at again. Nothing recorded that it had ever been seen. This
 * file is the fix: a company's research state survives the run that produced
 * it.
 *
 *   company → researched → signals checked → result → evidence → last checked
 *
 * The central rule is that outcomes must stay apart. "We have not looked",
 * "we looked and there is nothing", "we found something too thin to use",
 * "we could not tell whose company these sources describe", "the sources were
 * about someone else" and "our tooling failed" are six different statements
 * with six different follow-ups. Collapsing any of them into another is how a
 * research system starts lying to its owner — in particular, a coverage
 * failure that reads as a genuine negative makes a company look permanently
 * quiet when it was never actually checked.
 */

import type { IsoDate } from '../domain.ts';
import type { ChangeFamilyId } from './change-families.ts';
import type { FirstPartySection } from './first-party.ts';

export type ResearchState =
  /** Never put to the engine. The absence of a record means this. */
  | 'not_researched'
  /** A commercial signal was found and passed downstream. */
  | 'signal_found'
  /** Researched across the plan; no dated commercial change found. A real negative. */
  | 'no_trigger_found'
  /** A change was found but the evidence does not carry it. */
  | 'insufficient_evidence'
  /** A real, current change with no actionable consequence for this client. */
  | 'no_commercial_consequence'
  /** No source could be confidently attributed to this company. */
  | 'identity_unresolved'
  /** The sources describe a different company with a similar name. */
  | 'identity_collision'
  /** Rejected on the client's own disqualifiers before any research was spent. */
  | 'disqualified'
  /** The research could not be performed. NEVER a negative finding. */
  | 'research_failure';

/** States that mean "we looked properly and this company has nothing for us". */
export const GENUINE_NEGATIVE_STATES: ResearchState[] = [
  'no_trigger_found',
  'no_commercial_consequence',
];

/** States that mean the engine did not get a clean look. */
export const INCONCLUSIVE_STATES: ResearchState[] = [
  'not_researched',
  'insufficient_evidence',
  'identity_unresolved',
  'identity_collision',
  'research_failure',
];

export function isGenuineNegative(state: ResearchState): boolean {
  return GENUINE_NEGATIVE_STATES.includes(state);
}

export function isInconclusive(state: ResearchState): boolean {
  return INCONCLUSIVE_STATES.includes(state);
}

/** What the run actually managed to look at. Coverage, not findings. */
export interface ResearchCoverage {
  /** Change families queried this run. */
  familiesChecked: ChangeFamilyId[];
  /** First-party sections for which at least one source was obtained. */
  firstPartySectionsCovered: FirstPartySection[];
  /** First-party sections nothing could be checked for. */
  firstPartySectionsUnchecked: FirstPartySection[];
  /** First-party paths fetched directly. */
  firstPartyPathsAttempted: number;
  firstPartyPathsRetrieved: number;
  /** First-party sources obtained by either channel. */
  firstPartySourcesFound: number;
  /** Site-scoped first-party queries actually executed. */
  firstPartyQueriesRun: number;
  /** True when direct page retrieval was unavailable throughout. */
  retrievalBlocked: boolean;
  queriesRun: string[];
  sourcesSeen: number;
}

export interface EvidenceRecord {
  url: string;
  publisher: string;
  tier: number;
  verification: string;
  eventDate?: IsoDate;
}

export interface ResearchEvent {
  runDate: IsoDate;
  state: ResearchState;
  reason: string;
  queries: number;
  sourcesSeen: number;
}

export interface ResearchRecord {
  domain: string;
  company: string;
  state: ResearchState;
  /** Why the run reached that state, in the engine's own words. */
  reason: string;
  lastCheckedAt: IsoDate;
  /** Set when a signal was found. */
  trigger?: string;
  signalDate?: IsoDate;
  coverage: ResearchCoverage;
  evidence: EvidenceRecord[];
  /** Every run this company has been through, oldest first. */
  history: ResearchEvent[];
  /** How many runs have researched it. */
  timesResearched: number;
}

export interface HistoryStore {
  readonly id: string;
  load(): Promise<ResearchRecord[]>;
  save(records: ResearchRecord[]): Promise<void>;
}

/**
 * Merge a run's records into the stored history.
 *
 * Two rules that matter more than they look:
 *
 *  - A `research_failure` never overwrites a previous conclusive state. The
 *    tooling breaking must not erase what we already knew.
 *  - History is appended, never rewritten, so "checked five times, nothing
 *    found" is distinguishable from "checked once".
 */
export function mergeRecords(
  stored: ResearchRecord[],
  incoming: ResearchRecord[],
): ResearchRecord[] {
  const byDomain = new Map(stored.map((r) => [r.domain.toLowerCase(), r]));

  for (const record of incoming) {
    const key = record.domain.toLowerCase();
    const previous = byDomain.get(key);

    if (!previous) {
      byDomain.set(key, { ...record, timesResearched: Math.max(1, record.timesResearched) });
      continue;
    }

    const event = record.history.at(-1);
    const history = [...previous.history, ...(event ? [event] : [])];

    const keepPrevious =
      record.state === 'research_failure' && previous.state !== 'research_failure';

    byDomain.set(key, {
      ...record,
      // The failure is recorded in history; the known state is not lost.
      state: keepPrevious ? previous.state : record.state,
      reason: keepPrevious
        ? `${previous.reason} (last run could not re-check: ${record.reason})`
        : record.reason,
      trigger: keepPrevious ? previous.trigger : record.trigger,
      signalDate: keepPrevious ? previous.signalDate : record.signalDate,
      evidence: keepPrevious ? previous.evidence : record.evidence,
      history,
      timesResearched: previous.timesResearched + 1,
    });
  }

  return [...byDomain.values()].sort((a, b) => a.domain.localeCompare(b.domain));
}

/** The state of a company the store has never seen. */
export function stateOf(records: ResearchRecord[], domain: string): ResearchState {
  const found = records.find((r) => r.domain.toLowerCase() === domain.toLowerCase());
  return found?.state ?? 'not_researched';
}

/**
 * Companies the store knows about that are not in this run's target list.
 * This is the ADS Laser check: a company that has ever been researched stays
 * in the universe until someone deliberately removes it.
 */
export function droppedFromUniverse(
  records: ResearchRecord[],
  targetDomains: string[],
): ResearchRecord[] {
  const targets = new Set(targetDomains.map((d) => d.toLowerCase()));
  return records.filter((r) => !targets.has(r.domain.toLowerCase()));
}

export class InMemoryHistoryStore implements HistoryStore {
  readonly id = 'memory';
  #records: ResearchRecord[];

  constructor(records: ResearchRecord[] = []) {
    this.#records = records;
  }

  async load(): Promise<ResearchRecord[]> {
    return this.#records;
  }

  async save(records: ResearchRecord[]): Promise<void> {
    this.#records = records;
  }
}

export interface FileSystemLike {
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  writeFile(path: string, data: string, encoding: 'utf8'): Promise<void>;
  mkdir(path: string, options: { recursive: true }): Promise<string | undefined>;
}

/**
 * JSON-file store. The filesystem is injected for the same reason the search
 * client and page retriever are: so the durable path can be tested without
 * touching a disk.
 */
export class FileHistoryStore implements HistoryStore {
  readonly id = 'file';
  #path: string;
  #fs: FileSystemLike;

  constructor(path: string, fs: FileSystemLike) {
    this.#path = path;
    this.#fs = fs;
  }

  async load(): Promise<ResearchRecord[]> {
    try {
      const raw = await this.#fs.readFile(this.#path, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as ResearchRecord[];
    } catch {
      // A missing or unreadable store is an empty history, not a crash. It is
      // reported as `not_researched` for every company, which is true.
      return [];
    }
  }

  async save(records: ResearchRecord[]): Promise<void> {
    const dir = this.#path.replace(/\/[^/]*$/, '');
    if (dir && dir !== this.#path) await this.#fs.mkdir(dir, { recursive: true });
    await this.#fs.writeFile(this.#path, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  }
}
