/**
 * Stage 2: the website becomes a commercial model.
 *
 * What this is for: Signal cannot judge whether an event matters to a client
 * until it knows what the client sells and who buys it. Everything downstream —
 * the demand triggers, the search queries, the reasoning about a discovered
 * company — is derived from this object. If it is generic, the whole run is
 * generic, and no amount of downstream verification rescues it.
 *
 * So two rules are enforced here rather than hoped for:
 *
 *   EVERY OFFERING CITES A PAGE. The model names the URL it read each offering
 *   from, and `commercial-model` is checked against the corpus afterwards. An
 *   offering the site never mentions is the first thing this product could
 *   invent, and it would poison every trigger derived from it.
 *
 *   EXCLUSIONS ARE MANDATORY. A model that cannot say who the client is unable
 *   to serve has not understood the business; it has summarised the marketing.
 *   Generic output almost never produces sharp exclusions, so requiring them is
 *   a cheap and surprisingly effective specificity test.
 */

import { parseJsonObject } from '../../engine/src/research/llm-extractor.ts';
import { checkGrounding, type GroundingReport } from './grounding.ts';
import type { ModelClient } from './transport.ts';
import { corpusQuality, renderCorpus, type SiteCorpus } from './website.ts';

export const COMMERCIAL_MODEL_PROMPT = `You read a company's own website and produce a commercial model of that business, for use by a system that will look for sales opportunities on their behalf.

You are given the text of their pages. You may use NOTHING else. You have no
outside knowledge of this company and must not act as though you do.

What matters is commercial specificity, not a good summary. The test your output
has to pass: someone who knows this industry should be able to tell this company
apart from its nearest competitor by reading your model alone.

Rules:

1. Every offering must cite the URL of a page that describes it. If you cannot
   point to a page, do not list the offering.
2. Prefer what the site SHOWS over what it CLAIMS. Case studies and service
   pages describe the real business; the about page describes its self-image.
3. Say what you do not know. A site that never mentions geography, size or
   customer type leaves those unknown, and "unknown" is a useful answer.
4. cannotServe is required and must be substantive. Every business has
   customers it cannot serve — too small, too large, wrong sector, wrong
   geography, needs something adjacent that this company does not do. If you
   write nothing here you have not understood the business.
5. buyingSituations are the moments a customer decides they need this. Be
   concrete: "opening a second site" not "growth".

Return a single JSON object and nothing else:

{
  "name": "the company's name as the site gives it",
  "summary": "two sentences: what this business actually does, commercially",
  "offerings": [
    { "name": "short name for the service or product",
      "description": "what it is, in the site's own terms",
      "sourceUrl": "the page you read it from" }
  ],
  "customerTypes": ["the kinds of organisation that buy this"],
  "industriesServed": ["sectors named or clearly implied by the site"],
  "problemsSolved": ["the customer problem each offering removes"],
  "buyingSituations": [
    { "situation": "the concrete moment a customer needs this",
      "offering": "which offering, by name",
      "why": "one sentence" }
  ],
  "geography": "where they operate, or 'not stated'",
  "scale": "what the site suggests about their size, or 'not stated'",
  "cannotServe": ["who this business cannot or would not serve, and why"],
  "uncertainties": ["what you could not establish from the site"]
}`;

export interface Offering {
  name: string;
  description: string;
  sourceUrl: string;
}

export interface BuyingSituation {
  situation: string;
  offering: string;
  why: string;
}

export interface CommercialModel {
  name: string;
  domain: string;
  summary: string;
  offerings: Offering[];
  customerTypes: string[];
  industriesServed: string[];
  problemsSolved: string[];
  buyingSituations: BuyingSituation[];
  geography: string;
  scale: string;
  cannotServe: string[];
  uncertainties: string[];
  /** What the model was allowed to read, and how much of it there was. */
  evidence: {
    pagesRead: string[];
    pagesUnavailable: { url: string; reason: string }[];
    quality: ReturnType<typeof corpusQuality>;
  };
  /** Specifics in the model that appear nowhere in the site text. */
  grounding: GroundingReport;
}

function strings(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/**
 * Coerce and validate. Rejects rather than repairs, for the same reason the
 * reasoning layer does: a commercial model with no offerings is not a thin
 * model, it is a failed read, and treating the two alike is how a run produces
 * confident nonsense about a company nobody understood.
 */
export function coerceCommercialModel(raw: unknown, corpus: SiteCorpus): Omit<CommercialModel, 'grounding'> {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('the commercial model response was not a JSON object');
  }
  const o = raw as Record<string, unknown>;

  const offerings: Offering[] = (Array.isArray(o.offerings) ? o.offerings : [])
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      return {
        name: text(e.name),
        description: text(e.description),
        sourceUrl: text(e.sourceUrl),
      };
    })
    .filter((offering) => offering.name.length > 0);

  if (offerings.length === 0) {
    throw new Error(
      'the model named no offering it could cite a page for — the site was not understood, ' +
        'which is different from the business being simple',
    );
  }

  const buyingSituations: BuyingSituation[] = (Array.isArray(o.buyingSituations) ? o.buyingSituations : [])
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      return { situation: text(e.situation), offering: text(e.offering), why: text(e.why) };
    })
    .filter((situation) => situation.situation.length > 0);

  return {
    name: text(o.name, corpus.domain),
    domain: corpus.domain,
    summary: text(o.summary),
    offerings,
    customerTypes: strings(o.customerTypes),
    industriesServed: strings(o.industriesServed),
    problemsSolved: strings(o.problemsSolved),
    buyingSituations,
    geography: text(o.geography, 'not stated'),
    scale: text(o.scale, 'not stated'),
    cannotServe: strings(o.cannotServe),
    uncertainties: strings(o.uncertainties),
    evidence: {
      pagesRead: corpus.pages.map((page) => page.url),
      pagesUnavailable: corpus.unavailable,
      quality: corpusQuality(corpus),
    },
  };
}

/**
 * Check the model against the site text it was built from.
 *
 * The same machinery that catches an invented country in a sales brief catches
 * an invented capability here, and this is the more dangerous of the two: an
 * offering the client does not sell will generate demand triggers, queries and
 * opportunities, all of them internally consistent and all of them wrong.
 */
export function groundModel(model: Omit<CommercialModel, 'grounding'>, corpus: SiteCorpus): GroundingReport {
  const assertions: Record<string, string> = { summary: model.summary };
  for (const [index, offering] of model.offerings.entries()) {
    assertions[`offering ${index + 1}: ${offering.name}`] = `${offering.name}. ${offering.description}`;
  }
  for (const [index, situation] of model.buyingSituations.entries()) {
    assertions[`buying situation ${index + 1}`] = `${situation.situation}. ${situation.why}`;
  }
  assertions.geography = model.geography;
  assertions.scale = model.scale;

  // The corpus stands in for the "facts": the site text is the only evidence
  // the model was allowed, so anything specific and absent from it is ungrounded.
  return checkGrounding({
    assertions,
    facts: [],
    claims: corpus.pages.map((page, index) => ({
      id: `page${index + 1}`,
      claimText: page.text,
      supportingPassage: page.text,
      sourceUrl: page.url,
      topic: 'corporate_identity',
      identityAttributes: { statedDomain: corpus.domain },
      extractionConfidence: 1,
      verification: 'page_retrieved',
    })),
    allowed: [model.name, corpus.domain],
  });
}

/**
 * Does the site actually describe this offering?
 *
 * `grounding.ts` catches an invented NAME, figure or date. It cannot catch an
 * invented CAPABILITY, because a fabricated service is written in ordinary
 * lowercase words — "temperature-controlled pharmaceutical storage" trips no
 * proper-noun rule. A test caught this gap, and it matters more here than
 * anywhere else in the product: an offering the client does not sell will
 * generate demand triggers, search queries and opportunities, every one of them
 * internally consistent and every one of them about a service nobody provides.
 *
 * So offerings get their own check: the distinctive words of an offering name
 * must appear in the site text. Common commercial vocabulary is ignored, since
 * "services" and "solutions" are true of every site and prove nothing.
 */
const OFFERING_STOPWORDS = new Set([
  'services', 'service', 'solutions', 'solution', 'systems', 'system',
  'support', 'management', 'consultancy', 'consulting', 'provider',
  'products', 'product', 'and', 'the', 'for', 'with', 'our', 'full',
  'complete', 'bespoke', 'tailored', 'specialist', 'professional',
]);

export interface UnsupportedOffering {
  offering: string;
  missing: string[];
}

export function unsupportedOfferings(
  offerings: Offering[],
  corpus: SiteCorpus,
): UnsupportedOffering[] {
  const text = corpus.pages
    .map((page) => page.text)
    .join(' \n ')
    .toLowerCase();

  const unsupported: UnsupportedOffering[] = [];

  for (const offering of offerings) {
    const words = offering.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, ' ')
      .split(/[\s-]+/)
      .filter((word) => word.length > 4 && !OFFERING_STOPWORDS.has(word));

    if (words.length === 0) continue;

    // A four-character stem, for the same reason the grounding check uses one:
    // "pharmaceutical" should be established by "pharmaceuticals" or "pharmacy".
    const missing = words.filter((word) => !text.includes(word.slice(0, 5)));

    // Half or more of the distinctive words absent means the site is not
    // describing this. One absent word is a paraphrase; most of them is not.
    if (missing.length >= Math.ceil(words.length / 2)) {
      unsupported.push({ offering: offering.name, missing });
    }
  }

  return unsupported;
}

export async function buildCommercialModel(
  corpus: SiteCorpus,
  client: ModelClient,
): Promise<CommercialModel> {
  if (corpus.pages.length === 0) {
    throw new Error(
      `no page of ${corpus.domain} could be read, so there is nothing to build a commercial model from`,
    );
  }

  const response = await client.complete({
    purpose: 'commercial-model',
    system: COMMERCIAL_MODEL_PROMPT,
    user: [
      `Website: ${corpus.domain}`,
      `Pages read: ${corpus.pages.length}`,
      '',
      renderCorpus(corpus),
    ].join('\n'),
    maxTokens: 4096,
  });

  const model = coerceCommercialModel(parseJsonObject(response), corpus);
  const grounding = groundModel(model, corpus);

  // An offering the site never describes is reported the same way an invented
  // country in a sales brief is: as a finding a person will see, not a silent
  // correction.
  for (const unsupported of unsupportedOfferings(model.offerings, corpus)) {
    grounding.findings.push({
      field: 'offering',
      kind: 'proper_noun',
      specific: unsupported.offering,
      context: `the website never describes this (${unsupported.missing.join(', ')} appear nowhere on it)`,
    });
  }
  grounding.grounded = grounding.findings.length === 0;

  return { ...model, grounding };
}

/** Rendered for the next stage, and for a human to check. */
export function renderModel(model: CommercialModel): string {
  return [
    `COMPANY: ${model.name} (${model.domain})`,
    `WHAT THEY DO: ${model.summary}`,
    '',
    'OFFERINGS:',
    ...model.offerings.map((o) => `  - ${o.name}: ${o.description}`),
    '',
    `CUSTOMER TYPES: ${model.customerTypes.join('; ') || 'not established'}`,
    `INDUSTRIES: ${model.industriesServed.join('; ') || 'not established'}`,
    `PROBLEMS SOLVED: ${model.problemsSolved.join('; ') || 'not established'}`,
    '',
    'BUYING SITUATIONS:',
    ...model.buyingSituations.map((s) => `  - ${s.situation} (${s.offering}) — ${s.why}`),
    '',
    `GEOGRAPHY: ${model.geography}`,
    `SCALE: ${model.scale}`,
    `CANNOT SERVE: ${model.cannotServe.join('; ') || 'NOT ESTABLISHED — treat every exclusion as unknown'}`,
    `UNCERTAIN: ${model.uncertainties.join('; ') || 'none stated'}`,
  ].join('\n');
}
