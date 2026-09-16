/**
 * Stage 3: the commercial model becomes demand triggers, and triggers become
 * searches.
 *
 * This is the stage the whole product turns on, and the stage most likely to
 * produce confident nonsense, so it carries the most validation.
 *
 * The rule the directive states and this module enforces mechanically:
 *
 *     REAL-WORLD CHANGE → POTENTIAL BUSINESS NEED → THIS CLIENT'S OFFERING
 *
 * A trigger that cannot name which of the client's actual offerings it leads to
 * is rejected here, before it ever becomes a search. That single check is what
 * separates this from a generic buying-signal taxonomy: "company raised
 * funding" names no offering and dies; "company won a contract requiring
 * bonded storage they do not have" names one and lives.
 *
 * The existing 16 change families in `engine/src/research/change-families.ts`
 * are NOT used as truth here. They were derived from one logistics client, and
 * treating them as universal is exactly the drift this replaces. They remain
 * available as a control arm for evaluation.
 */

import { parseJsonObject } from '../../engine/src/research/llm-extractor.ts';
import type { CommercialModel } from './commercial-model.ts';
import { renderModel } from './commercial-model.ts';
import type { ModelClient } from './transport.ts';

export const TRIGGER_PROMPT = `You are given a commercial model of a business. Your job is to work out what has to HAPPEN in the outside world for a company to need what this business sells — and how you would find those events in public information.

This is causal work, not categorisation. You are not picking from a list of
buying signals. You are reasoning from how this particular business makes money.

For each trigger, the chain must hold:

    a real-world change at another company
    → a business need that change creates
    → a specific thing THIS business sells

If you cannot name the offering at the end of that chain, the trigger is worthless. Discard it.

What makes a trigger good:

- It is an EVENT, with a before and an after, at a point in time. "The company
  is growing" is not an event. "The company signed a lease on a second site" is.
- The mechanism is specific enough to be wrong. A salesperson should be able to
  ask one question that proves or disproves it.
- It would NOT apply to a different kind of supplier. If your mechanism reads
  the same for an accountancy firm and a haulier, it is generic — delete it.
- It leaves a public trace somewhere a search could find.

What makes a trigger worthless, and you should not return it:

- "raised funding", "is hiring", "is growing", "appointed a new CEO", "adopted
  new technology" — UNLESS you can state a mechanism specific to this business's
  offering that makes that event matter. Funding is not a need. Budget is not a
  need. A need is a job the company now has to do.

QUERIES. For each trigger write searches that would find companies this has
happened to. They must NOT name a company — you are looking for companies you do
not yet know. Write them the way the event would actually be reported: use the
words a trade publication, a local paper or a press release would use. Vary the
phrasing across queries rather than repeating one shape.

Return a single JSON object and nothing else:

{
  "triggers": [
    {
      "id": "t1",
      "event": "the real-world change, as it would occur",
      "mechanism": "why that change creates a need — the causal step, one or two sentences",
      "offering": "which of this business's offerings it leads to, by its exact name from the model",
      "strength": "strong | moderate | speculative",
      "observableTraces": ["where this event shows up publicly"],
      "queries": ["search 1", "search 2"],
      "exclusions": ["what would mean this is NOT an opportunity despite the event"],
      "falsifyingQuestion": "the single question to a prospect that settles whether the need is real"
    }
  ],
  "rejected": [
    { "event": "a trigger you considered and discarded", "why": "why it does not hold for this business" }
  ]
}

Return the triggers that genuinely hold. Six strong ones are worth more than
twenty padded out. Populate "rejected" honestly — a generic event you correctly
discarded is evidence that you did the causal work.`;

export type TriggerStrength = 'strong' | 'moderate' | 'speculative';

export interface DemandTrigger {
  id: string;
  event: string;
  mechanism: string;
  /** Must match an offering named in the commercial model. Checked, not trusted. */
  offering: string;
  strength: TriggerStrength;
  observableTraces: string[];
  queries: string[];
  exclusions: string[];
  falsifyingQuestion: string;
}

export interface TriggerSet {
  triggers: DemandTrigger[];
  /** Triggers the model considered and discarded, with its reason. */
  rejected: { event: string; why: string }[];
  /** Triggers this module threw out, and why. Never silent. */
  discarded: { event: string; reason: string }[];
}

const STRENGTHS = new Set<TriggerStrength>(['strong', 'moderate', 'speculative']);

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function strings(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((e) => (typeof e === 'string' ? e.trim() : '')).filter(Boolean).slice(0, limit);
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Does this trigger's offering correspond to something the client actually
 * sells? Exact name first, then a generous word-overlap match, because a model
 * will legitimately write "pallet storage" for an offering listed as
 * "Pallet storage and warehousing".
 */
export function matchOffering(named: string, offerings: string[]): string | null {
  const needle = normalise(named);
  if (!needle) return null;

  for (const offering of offerings) {
    if (normalise(offering) === needle) return offering;
  }
  for (const offering of offerings) {
    const hay = normalise(offering);
    if (hay.includes(needle) || needle.includes(hay)) return offering;
  }

  const needleWords = new Set(needle.split(' ').filter((w) => w.length > 3));
  if (needleWords.size === 0) return null;
  for (const offering of offerings) {
    const words = new Set(normalise(offering).split(' ').filter((w) => w.length > 3));
    const shared = [...needleWords].filter((w) => words.has(w)).length;
    if (shared >= Math.min(2, needleWords.size)) return offering;
  }
  return null;
}

/**
 * A query that names the client, or any company, is not a discovery query.
 *
 * The quoted-phrase rule is narrower than it first looks, and deliberately so.
 * An early version flagged every quoted phrase as a company name, which killed
 * the single best trigger in the first real run: `"signs lease" OR "takes
 * space"` is exact-phrase searching, which is how you write a precise query,
 * not how you name a company. Only a quoted phrase in Title Case reads as a
 * company name, so only that is refused.
 */
export function looksCompanySpecific(query: string, clientName: string): boolean {
  const q = normalise(query);
  const client = normalise(clientName);
  if (client && q.includes(client)) return true;

  for (const match of query.matchAll(/"([^"]{3,})"/g)) {
    const phrase = match[1]!.trim();
    const words = phrase.split(/\s+/);
    // Title Case across the phrase: "Acme Widgets" yes, "signs lease" no.
    if (words.every((word) => /^[A-Z]/.test(word))) return true;
  }
  return false;
}

export function coerceTriggers(raw: unknown, model: CommercialModel): TriggerSet {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('the trigger response was not a JSON object');
  }
  const o = raw as Record<string, unknown>;
  const offeringNames = model.offerings.map((offering) => offering.name);

  const triggers: DemandTrigger[] = [];
  const discarded: { event: string; reason: string }[] = [];

  for (const [index, entry] of (Array.isArray(o.triggers) ? o.triggers : []).entries()) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const event = text(e.event);
    const mechanism = text(e.mechanism);
    const offeringNamed = text(e.offering);
    const queries = strings(e.queries).filter((query) => !looksCompanySpecific(query, model.name));

    if (!event || !mechanism) {
      discarded.push({ event: event || `trigger ${index + 1}`, reason: 'no event or no mechanism' });
      continue;
    }

    // The rule that makes this not a generic signal taxonomy.
    const offering = matchOffering(offeringNamed, offeringNames);
    if (!offering) {
      discarded.push({
        event,
        reason:
          `names the offering "${offeringNamed}", which is not something this business sells ` +
          `(it sells: ${offeringNames.join('; ')}). A change with no route to an offering is not a trigger.`,
      });
      continue;
    }

    if (queries.length === 0) {
      discarded.push({ event, reason: 'no query that could find companies without naming one' });
      continue;
    }

    const strengthRaw = text(e.strength, 'moderate') as TriggerStrength;

    triggers.push({
      id: text(e.id, `t${index + 1}`),
      event,
      mechanism,
      offering,
      strength: STRENGTHS.has(strengthRaw) ? strengthRaw : 'moderate',
      observableTraces: strings(e.observableTraces),
      queries,
      exclusions: strings(e.exclusions),
      falsifyingQuestion: text(e.falsifyingQuestion),
    });
  }

  if (triggers.length === 0) {
    throw new Error(
      'no demand trigger survived validation: nothing the model proposed connected a real-world ' +
        'change to something this business actually sells',
    );
  }

  const rejected = (Array.isArray(o.rejected) ? o.rejected : [])
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      return { event: text(e.event), why: text(e.why) };
    })
    .filter((r) => r.event.length > 0);

  return { triggers, rejected, discarded };
}

export async function deriveTriggers(
  model: CommercialModel,
  client: ModelClient,
): Promise<TriggerSet> {
  const response = await client.complete({
    purpose: 'demand-triggers',
    system: TRIGGER_PROMPT,
    user: renderModel(model),
    maxTokens: 4096,
  });
  return coerceTriggers(parseJsonObject(response), model);
}

/** Strong first, then moderate; speculative only if there is budget left. */
export function planQueries(set: TriggerSet, budget: number): { query: string; triggerId: string }[] {
  const rank: Record<TriggerStrength, number> = { strong: 0, moderate: 1, speculative: 2 };
  const ordered = [...set.triggers].sort((a, b) => rank[a.strength] - rank[b.strength]);

  // Round-robin across triggers rather than draining one: a budget spent
  // entirely on the first trigger tests one hypothesis, not the model.
  const plan: { query: string; triggerId: string }[] = [];
  for (let depth = 0; plan.length < budget; depth += 1) {
    let added = false;
    for (const trigger of ordered) {
      const query = trigger.queries[depth];
      if (!query) continue;
      plan.push({ query, triggerId: trigger.id });
      added = true;
      if (plan.length >= budget) break;
    }
    if (!added) break;
  }
  return plan;
}
