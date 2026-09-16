/**
 * Does the generated prose say anything the evidence does not?
 *
 * This exists because of a specific, recorded failure. In the deVOL brief the
 * phrase "Thailand, China and Denmark" appeared in `whatChanged`, in the
 * inference, in `testableBy`, in `whyNow` and in the sales angle — and in no
 * claim's text and no supporting passage. Three named countries, presented to
 * a salesperson as established fact, sourced from nothing.
 *
 * The chain validator did not catch it and could not: it checks that the chain
 * is STRUCTURALLY sound — that inferences derive from facts that exist, that
 * there are no cycles, that the hypothesis is testable. It never reads the
 * sentences. A perfectly-formed chain can carry an invented country.
 *
 * So this module reads the sentences. It pulls the checkable specifics out of
 * the generated prose — proper nouns, figures, money, dates — and asks whether
 * each one appears anywhere in the evidence corpus. Anything that does not is
 * reported.
 *
 * What it is not: a truth checker. It cannot tell whether the evidence is
 * right, only whether the prose went beyond it. That is the failure mode it
 * was built for, and it is the one that matters most: a salesperson can
 * discount weak evidence they can see, but cannot discount a detail that was
 * never there.
 */

import type { Contradiction, Fact } from '../../engine/src/domain.ts';
import type { ExtractedClaim } from '../../engine/src/research/extraction.ts';

export type SpecificKind = 'proper_noun' | 'figure' | 'money' | 'date';

export interface GroundingFinding {
  /** Which piece of generated prose it appeared in. */
  field: string;
  kind: SpecificKind;
  /** The specific as written. */
  specific: string;
  /** The sentence it came from, so a reader can judge it. */
  context: string;
}

export interface GroundingReport {
  grounded: boolean;
  findings: GroundingFinding[];
  /** Fields that were read. Shown so nobody assumes more was checked. */
  fieldsChecked: string[];
  /** How much evidence the prose was checked against. */
  corpusChars: number;
}

/**
 * Words that are capitalised for reasons other than being a name, plus the
 * vocabulary of commerce. A proper-noun test that flags "Growth" or "Monday"
 * produces noise, and noise is how a real finding gets ignored.
 */
const COMMON_CAPITALISED = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'their', 'they', 'it',
  'its', 'his', 'her', 'he', 'she', 'we', 'our', 'you', 'your', 'i',
  'and', 'or', 'but', 'if', 'as', 'at', 'by', 'for', 'from', 'in', 'into',
  'of', 'on', 'to', 'with', 'without', 'after', 'before', 'during', 'since',
  'while', 'when', 'where', 'why', 'how', 'what', 'which', 'who',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'q1', 'q2', 'q3', 'q4',
  'growth', 'expansion', 'demand', 'supply', 'operations', 'procurement',
  'logistics', 'warehousing', 'distribution', 'manufacturing', 'production',
  'export', 'exports', 'import', 'imports', 'revenue', 'turnover', 'capacity',
  'director', 'managing', 'operations', 'head', 'chief', 'officer',
  'company', 'group', 'limited', 'ltd', 'plc', 'llp', 'holdings',
  'there', 'here', 'both', 'each', 'no', 'not', 'nothing', 'none',
]);

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ');
}

/**
 * Proper nouns, as sequences of capitalised words.
 *
 * A word at the start of a sentence is capitalised by grammar, so it only
 * counts when it also appears capitalised somewhere it is not sentence-initial
 * — otherwise every sentence's first word is a false positive.
 */
export function properNouns(text: string): { specific: string; context: string }[] {
  const found: { specific: string; context: string }[] = [];

  for (const sentence of text.split(SENTENCE_SPLIT)) {
    const words = sentence.trim().split(/\s+/);
    let run: string[] = [];
    let runStartsSentence = false;

    const flush = () => {
      if (run.length === 0) return;
      // A single sentence-initial word is grammar, not a name.
      if (!(runStartsSentence && run.length === 1)) {
        found.push({ specific: run.join(' '), context: sentence.trim() });
      }
      run = [];
    };

    for (const [index, word] of words.entries()) {
      let bare = word
        .replace(/^[^A-Za-z0-9]+/, '')
        .replace(/[^A-Za-z0-9&.'\u2019-]+$/, '')
        // A trailing full stop is punctuation, not part of the name.
        .replace(/\.$/, '')
        // A possessive is grammar: "Maeving's" is the name "Maeving".
        .replace(/['\u2019]s$/i, '');

      // In a hyphenated compound only the capitalised parts are names.
      // "US-bound" is the name "US" plus an ordinary English word, and
      // demanding the evidence contain "bound" would flag correct writing.
      if (bare.includes('-')) {
        bare = bare
          .split('-')
          .filter((part) => /^[A-Z]/.test(part))
          .join(' ');
      }
      const capitalised = /^[A-Z]/.test(bare);
      const wordy =
        bare.replace(/\s/g, '').length > 2 && !COMMON_CAPITALISED.has(bare.toLowerCase());

      if (capitalised && wordy) {
        if (run.length === 0) runStartsSentence = index === 0;
        run.push(bare);
        // A trailing comma or full stop ends the name.
        if (/[,.;:]$/.test(word)) flush();
      } else {
        flush();
        runStartsSentence = false;
      }
    }
    flush();
  }

  return found;
}

const MONEY = /(?:[£$€])\s?\d[\d,.]*\s?(?:k|m|bn|billion|million|thousand)?/gi;
const FIGURE = /\b\d[\d,]*(?:\.\d+)?\s?(?:%|per cent|percent|million|billion|m\b|bn\b|tonnes?|sq ?ft|jobs|staff|employees|sites?|units?)/gi;
const DATE = /\b(?:19|20)\d{2}\b|\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/gi;

function matches(text: string, pattern: RegExp, kind: SpecificKind): { specific: string; kind: SpecificKind; context: string }[] {
  const out: { specific: string; kind: SpecificKind; context: string }[] = [];
  for (const sentence of text.split(SENTENCE_SPLIT)) {
    for (const match of sentence.matchAll(pattern)) {
      out.push({ specific: match[0].trim(), kind, context: sentence.trim() });
    }
  }
  return out;
}

/**
 * Is this specific present in the evidence?
 *
 * Substring containment on the normalised corpus, which is deliberately
 * generous: the question is whether the evidence mentions it at all, not
 * whether the prose quotes it. A generous test keeps the findings few and
 * real. For multi-word names, each word must appear — "Weston Beamor" is not
 * grounded by a corpus that only says "Weston".
 */
const STEM_LENGTH = 4;

function present(specific: string, corpus: string): boolean {
  const needle = normalise(specific);
  if (corpus.includes(needle)) return true;

  // Morphological variants are not inventions: a source that says "Chinese
  // markets" does establish China, and demanding an exact match would flag
  // correct writing. Matching on a four-character stem accepts those and
  // still rejects the case this was built for — "Thailand" finds no "thai" in
  // a corpus about a King's Award. The cost is sensitivity to a fabricated
  // name that happens to share four letters with a real one; that is the
  // right way round, because a check that cries wolf is a check nobody reads.
  if (needle.length > STEM_LENGTH && !needle.includes(' ')) {
    if (corpus.includes(needle.slice(0, STEM_LENGTH))) return true;
  }

  // Every part must appear. "13 jobs" is grounded by "13 new jobs"; "Weston
  // Beamor" is not grounded by a corpus that only says "Weston".
  const words = needle.split(' ').filter((w) => w.length > 1);
  if (words.length < 2) return false;
  return words.every((word) => corpus.includes(word));
}

export interface GroundingInput {
  /** The generated prose, by field name. */
  assertions: Record<string, string | undefined>;
  /** The evidence the prose is allowed to rest on. */
  facts: Fact[];
  /** Claims, for their supporting passages — the raw source text. */
  claims?: ExtractedClaim[];
  /**
   * Names the prose may use without a source: the client, the company, the
   * client's own offerings. Naming the company you are writing about is not an
   * unsourced assertion about it.
   */
  allowed?: string[];
}

export function checkGrounding(input: GroundingInput): GroundingReport {
  // Dates live in structured fields as well as in prose. A fact carrying
  // eventDate 2026-08-14 does establish the year 2026, so the corpus includes
  // the dates the evidence actually holds — otherwise every correctly-dated
  // write-up would be reported as ungrounded, and a check that cries wolf is a
  // check nobody reads.
  const corpusParts = [
    ...input.facts.map(
      (fact) =>
        `${fact.statement} ${fact.source.publisher} ${fact.source.url} ${fact.eventDate ?? ''}`,
    ),
    ...(input.claims ?? []).map(
      (claim) =>
        `${claim.claimText} ${claim.supportingPassage} ${claim.sourceUrl} ` +
        `${claim.eventDate ?? ''} ${claim.publicationDate ?? ''}`,
    ),
    ...(input.allowed ?? []),
  ];
  const corpus = normalise(corpusParts.join(' \n '));

  const findings: GroundingFinding[] = [];
  const fieldsChecked: string[] = [];
  const seen = new Set<string>();

  for (const [field, value] of Object.entries(input.assertions)) {
    if (!value?.trim()) continue;
    fieldsChecked.push(field);

    const specifics = [
      ...properNouns(value).map((n) => ({ ...n, kind: 'proper_noun' as SpecificKind })),
      ...matches(value, MONEY, 'money'),
      ...matches(value, FIGURE, 'figure'),
      ...matches(value, DATE, 'date'),
    ];

    for (const specific of specifics) {
      if (present(specific.specific, corpus)) continue;
      const key = `${field}::${normalise(specific.specific)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        field,
        kind: specific.kind,
        specific: specific.specific,
        context: specific.context,
      });
    }
  }

  return {
    grounded: findings.length === 0,
    findings,
    fieldsChecked,
    corpusChars: corpus.length,
  };
}

/**
 * Turns findings into contradictions the engine already knows how to carry.
 *
 * Severity, and why it is not `fatal`: a fatal contradiction makes the adapter
 * discard the signal outright, and a discarded signal is invisible. The whole
 * point of this check is that the ungrounded detail should be SEEN — by the
 * person deciding whether to make the call. An invented country in the
 * headline is `conflicting`, which means a human must look; elsewhere it is a
 * caveat that travels with the brief.
 */
const LOUD_FIELDS = new Set(['whatChanged', 'hypothesis', 'whyNow']);

export function groundingContradictions(report: GroundingReport): Contradiction[] {
  return report.findings.map((finding) => ({
    severity: LOUD_FIELDS.has(finding.field) ? 'conflicting' : 'caveat',
    note:
      `"${finding.specific}" appears in ${finding.field} but in no source: ` +
      `"${finding.context}". The evidence does not establish it.`,
  }));
}
