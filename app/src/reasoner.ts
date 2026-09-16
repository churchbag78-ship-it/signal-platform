/**
 * The commercial reasoning layer.
 *
 * This is the component Signal has never had. `LlmClaimExtractor.extract()`
 * deliberately REFUSES to author an inference/hypothesis chain:
 *
 *   "a hypothesis invented here would be reasoning presented as reading,
 *    which is exactly what the architecture forbids"
 *
 * In every run before this one, the reasoning layer was a human writing
 * fixtures by hand. That is why the product could never be used by anyone
 * else. This module is that layer, made real.
 *
 * The split it enforces:
 *
 *   EXTRACT (AI #1)  reads sources → claims, with provenance and identity
 *                    attributes. Never decides what a claim means.
 *   [engine]         schema validation → source classification → IDENTITY GATE
 *                    → promotion to Fact. A claim that fails cannot proceed.
 *   REASON (AI #2)   reads ONLY promoted Facts → inference → hypothesis →
 *                    polarity → consequence → recommended angle.
 *   [engine]         chain validation → direction grounding → date attribution
 *                    → freshness → two-axis scoring → quadrant → action.
 *
 * The Reasoner sees only Facts that survived the identity gate, so a source
 * about a different company cannot reach the commercial reasoning at all.
 */

import type {
  Contradiction,
  DecisionMakerRole,
  Fact,
  Hypothesis,
  Inference,
  IsoDate,
  SignalPolarity,
} from '../../engine/src/domain.ts';
import type { ClientProfile } from '../../engine/src/pipeline.ts';
import type { CompanyIdentity } from '../../engine/src/domain.ts';
import type { IcpRelevance } from '../../engine/src/research/types.ts';
import { parseJsonObject } from '../../engine/src/research/llm-extractor.ts';

export const REASONING_SYSTEM_PROMPT = `You turn verified facts about a company into a commercial assessment for a specific client.

You are given FACTS ONLY. Each fact has already been checked: its source was
classified, and it was confirmed to describe the company named. You may not add
facts. You may not use knowledge about the company that is not in the facts.

Your job is the reasoning the facts do not perform for themselves:

- INFERENCE: what the facts, taken together, imply. Each inference must name
  which fact ids it derives from, and say why in one sentence.
- HYPOTHESIS: one commercial implication for THIS client — the reason to make
  contact. It is unproven by definition. It must derive from your inferences,
  and it must carry a test: the question a salesperson would ask to settle it.

Rules that are not negotiable:

1. Never assert something no fact states. If you want to say a company entered
   a named market, a fact must say so. Naming countries, figures, dates or
   customers that appear in no fact is the single worst failure you can make.
2. If the facts do not support a commercial case, say so. Set
   consequence.actionable to false and explain why. "Nothing here for this
   client" is a correct and valuable answer.
3. Distinguish what the evidence supports from what you are inferring. The
   hypothesis is where your reasoning goes; the facts are where the evidence is.
4. Record contradictions. If two facts pull against each other, or if the
   commercial case has a serious weakness (an incumbent supplier, the company
   solving the problem in-house, an undated claim), record it as a caveat.
   severity: "caveat" (worth knowing), "conflicting" (needs human review),
   "fatal" (the signal does not hold).
5. Do not manufacture confidence. Judgements are 0-N scales; use the low end
   when the evidence is thin.

Return a single JSON object, nothing else:

{
  "trigger": "short_signal_type, e.g. export_finance | new_premises | contraction",
  "whatChanged": "one sentence, using only what the facts state",
  "triggerClaimIds": ["ids of the facts that ESTABLISH the change, not ones that merely corroborate or give background"],
  "inferences": [
    { "id": "i1", "statement": "...", "derivedFrom": ["fact id", "..."], "reasoning": "why, one sentence" }
  ],
  "hypothesis": {
    "id": "h1",
    "statement": "the unproven commercial implication",
    "derivedFrom": ["i1"],
    "reasoning": "why this follows",
    "testableBy": "the question that would settle it"
  },
  "polarity": "demand_increasing | demand_reducing | neutral",
  "polarityRationale": "one sentence",
  "consequence": { "actionable": true, "rationale": "what the client could sell into, or why nothing" },
  "owningFunction": { "function": "the role that owns this problem", "rationale": "why" },
  "icpRelevance": { "fits": true, "rationale": "why this company is or is not the client's kind of customer" },
  "contradictions": [ { "severity": "caveat", "note": "..." } ],
  "judgements": { "icpFit": 0-25, "signalStrength": 0-20, "commercialRelevance": 0-15 },
  "whyNow": "why this is worth acting on now, in a salesperson's words",
  "salesAngle": "how to open the conversation, in a salesperson's words"
}`;

export interface ReasoningRequest {
  company: CompanyIdentity;
  client: ClientProfile;
  facts: Fact[];
  runDate: IsoDate;
}

/** Everything the engine needs that the extractor deliberately does not produce. */
export interface ReasoningOutput {
  trigger: string;
  whatChanged: string;
  triggerClaimIds?: string[];
  inferences: Inference[];
  hypothesis: Hypothesis;
  polarity: SignalPolarity;
  polarityRationale: string;
  consequence: { actionable: boolean; rationale: string };
  owningFunction: DecisionMakerRole;
  icpRelevance: IcpRelevance;
  contradictions: Contradiction[];
  judgements: { icpFit: number; signalStrength: number; commercialRelevance: number };
  whyNow: string;
  salesAngle: string;
}

export interface ReasonerConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export function buildReasoningPrompt(request: ReasoningRequest): string {
  const facts = request.facts
    .map((fact) =>
      [
        `FACT ${fact.id}`,
        `  states: ${fact.statement}`,
        `  source: ${fact.source.publisher} (tier ${fact.source.tier}) ${fact.source.url}`,
        `  date of the change: ${fact.eventDate ?? 'NOT STATED BY ANY SOURCE'}`,
        `  evidence level: ${fact.verification}`,
      ].join('\n'),
    )
    .join('\n\n');

  return [
    `CLIENT: ${request.client.name}`,
    `The client sells: ${request.client.offerings.join('; ')}`,
    `Changes that create demand for them: ${request.client.demandTriggers.join('; ')}`,
    `They cannot sell to: ${request.client.disqualifiers.join('; ')}`,
    '',
    `COMPANY UNDER ASSESSMENT: ${request.company.name} (${request.company.domain})`,
    `TODAY: ${request.runDate}`,
    '',
    `VERIFIED FACTS (${request.facts.length}) — you may use nothing else:`,
    '',
    facts,
    '',
    'Produce the JSON object described in your instructions. Nothing else.',
  ].join('\n');
}

const SEVERITIES = new Set(['caveat', 'conflicting', 'fatal']);
const POLARITIES = new Set(['demand_increasing', 'demand_reducing', 'neutral']);

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function num(value: unknown, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(Math.round(n), max));
}

/**
 * Coerce the model's JSON into the engine's types.
 *
 * Nothing is repaired silently. A chain that references a fact that does not
 * exist is rejected, not patched: an inference derived from a fact the identity
 * gate removed is exactly the failure the gate exists to prevent.
 */
export function coerceReasoning(raw: unknown, factIds: string[]): ReasoningOutput {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('reasoning response was not a JSON object');
  }
  const o = raw as Record<string, unknown>;
  const known = new Set(factIds);

  const inferencesRaw = Array.isArray(o.inferences) ? o.inferences : [];
  const inferences: Inference[] = inferencesRaw.map((entry, index) => {
    const e = (entry ?? {}) as Record<string, unknown>;
    const derivedFrom = (Array.isArray(e.derivedFrom) ? e.derivedFrom : [])
      .map((d) => String(d))
      .filter((d) => known.has(d));
    if (derivedFrom.length === 0) {
      throw new Error(
        `inference ${index + 1} derives from no known fact — it would be a conclusion without evidence`,
      );
    }
    return {
      kind: 'inference',
      id: str(e.id, `i${index + 1}`),
      statement: str(e.statement),
      derivedFrom,
      reasoning: str(e.reasoning),
    };
  });

  if (inferences.length === 0) {
    throw new Error('reasoning produced no inference: nothing links the facts to a commercial case');
  }

  const h = (o.hypothesis ?? {}) as Record<string, unknown>;
  const inferenceIds = new Set(inferences.map((i) => i.id));
  const hypothesisFrom = (Array.isArray(h.derivedFrom) ? h.derivedFrom : [])
    .map((d) => String(d))
    .filter((d) => inferenceIds.has(d));

  if (hypothesisFrom.length === 0) {
    throw new Error('hypothesis derives from no inference — it would be ungrounded');
  }

  const hypothesis: Hypothesis = {
    kind: 'hypothesis',
    id: str(h.id, 'h1'),
    statement: str(h.statement),
    derivedFrom: hypothesisFrom,
    reasoning: str(h.reasoning),
    testableBy: str(h.testableBy),
  };
  if (!hypothesis.statement) throw new Error('hypothesis has no statement');
  if (!hypothesis.testableBy) {
    throw new Error('hypothesis has no test — an unfalsifiable hypothesis is not a hypothesis');
  }

  const polarityRaw = str(o.polarity, 'neutral');
  const polarity = (POLARITIES.has(polarityRaw) ? polarityRaw : 'neutral') as SignalPolarity;

  const consequence = (o.consequence ?? {}) as Record<string, unknown>;
  const owning = (o.owningFunction ?? {}) as Record<string, unknown>;
  const icp = (o.icpRelevance ?? {}) as Record<string, unknown>;
  const judgements = (o.judgements ?? {}) as Record<string, unknown>;

  const contradictions: Contradiction[] = (Array.isArray(o.contradictions) ? o.contradictions : [])
    .map((entry) => {
      const c = (entry ?? {}) as Record<string, unknown>;
      const severity = str(c.severity, 'caveat');
      return {
        severity: (SEVERITIES.has(severity) ? severity : 'caveat') as Contradiction['severity'],
        note: str(c.note),
      };
    })
    .filter((c) => c.note.length > 0);

  const triggerClaimIds = (Array.isArray(o.triggerClaimIds) ? o.triggerClaimIds : [])
    .map((d) => String(d))
    .filter((d) => known.has(d));

  return {
    trigger: str(o.trigger, 'unclassified'),
    whatChanged: str(o.whatChanged),
    ...(triggerClaimIds.length > 0 ? { triggerClaimIds } : {}),
    inferences,
    hypothesis,
    polarity,
    polarityRationale: str(o.polarityRationale),
    consequence: {
      actionable: consequence.actionable === true,
      rationale: str(consequence.rationale),
    },
    owningFunction: {
      function: str(owning.function, 'Not identified'),
      rationale: str(owning.rationale),
    },
    icpRelevance: { fits: icp.fits !== false, rationale: str(icp.rationale) },
    contradictions,
    judgements: {
      icpFit: num(judgements.icpFit, 25),
      signalStrength: num(judgements.signalStrength, 20),
      commercialRelevance: num(judgements.commercialRelevance, 15),
    },
    whyNow: str(o.whyNow),
    salesAngle: str(o.salesAngle),
  };
}

export class Reasoner {
  readonly #config: ReasonerConfig;
  readonly #transport: Transport;
  #callsMade = 0;

  constructor(config: ReasonerConfig, transport: Transport = globalThis.fetch) {
    this.#config = config;
    this.#transport = transport;
  }

  get callsMade(): number {
    return this.#callsMade;
  }

  async reason(request: ReasoningRequest): Promise<ReasoningOutput> {
    if (request.facts.length === 0) {
      throw new Error('cannot reason with no verified facts');
    }

    this.#callsMade += 1;
    const response = await this.#transport(
      this.#config.endpoint ?? 'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.#config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.#config.model,
          max_tokens: this.#config.maxTokens ?? 4096,
          system: REASONING_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildReasoningPrompt(request) }],
        }),
        signal: AbortSignal.timeout(this.#config.timeoutMs ?? 90_000),
      },
    );

    if (!response.ok) {
      // Fail loudly. A silent empty result is indistinguishable from
      // "we reasoned and found nothing", which is a real and different answer.
      throw new Error(
        `reasoning model returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as { content?: { text?: string }[] };
    const text = payload.content?.map((part) => part.text ?? '').join('') ?? '';
    if (!text.trim()) throw new Error('reasoning model returned an empty response');

    return coerceReasoning(parseJsonObject(text), request.facts.map((f) => f.id));
  }
}
