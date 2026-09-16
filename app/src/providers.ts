/**
 * The three adapters that let the existing research engine run over evidence a
 * user supplies, instead of evidence a search API returns.
 *
 * Why this shape: outbound web search and page retrieval are unavailable in
 * this environment (CONNECT is refused with HTTP 403), and the product still
 * has to be usable end to end. Rather than stub the engine or weaken its
 * checks, the evidence is PASTED and then put through exactly the same path a
 * live run would take — the same identity gate, the same passage verification,
 * the same scoring. `WebResearchAdapter` is used unchanged; only its two
 * injected boundaries (search, retrieval) and its extractor are replaced.
 *
 * What this deliberately does NOT do is pretend. A pasted page is served as
 * the page body, so `passageSupportedByPage` does real work: a claim whose
 * supporting passage is not in the pasted text stays at snippet level, exactly
 * as it would against a fetched page. The one thing it cannot attest is that
 * the text came from the URL it claims to — that is the user's assertion, and
 * it is recorded as such in `ProvidedEvidence.providedBy`.
 */

import type { IsoDate, IdentityFingerprint } from '../../engine/src/domain.ts';
import type {
  ClaimExtractor,
  ExtractionOutput,
  ExtractionRequest,
  SearchClient,
  SearchResult,
} from '../../engine/src/research/types.ts';
import type {
  PageRetriever,
  RetrievalOutcome,
  RetrievedPage,
} from '../../engine/src/research/retrieval.ts';
import { contentHash } from '../../engine/src/research/retrieval.ts';
import type { ProviderOperation } from '../../engine/src/providers/registry.ts';
import { promoteToFact } from '../../engine/src/research/extraction.ts';
import type { LlmClaimExtractor } from '../../engine/src/research/llm-extractor.ts';
import type { Reasoner } from './reasoner.ts';
import { checkGrounding, groundingContradictions, type GroundingReport } from './grounding.ts';

/**
 * One piece of evidence as the user supplied it.
 *
 * `text` is the body they pasted. `snippet` is what the extractor is shown
 * first; where they pasted a whole page, it is the opening of it.
 */
export interface ProvidedEvidence {
  url: string;
  title: string;
  /** The pasted body. Empty means "only a snippet was supplied". */
  text: string;
  snippet?: string;
  /** The date the user says the source was published, if they know it. */
  publishedAt?: IsoDate;
  /** Who supplied it. Recorded because the engine cannot verify the origin. */
  providedBy: string;
  providedAt: IsoDate;
}

const SNIPPET_CHARS = 600;

export function evidenceSnippet(item: ProvidedEvidence): string {
  if (item.snippet?.trim()) return item.snippet.trim();
  const body = item.text.replace(/\s+/g, ' ').trim();
  return body.length > SNIPPET_CHARS ? `${body.slice(0, SNIPPET_CHARS)}…` : body;
}

/**
 * Serves the user's evidence to the engine's query plan.
 *
 * The engine still plans its queries — across change families, and across the
 * company's own site — and the plan is still worth running, because it records
 * what a run looked for even when the looking was done by a person. What this
 * client will not do is let that record lie.
 *
 * Two rules, both about not overstating coverage:
 *
 *   The corpus is returned ONCE, not per query. Returning it sixty times would
 *   record a run that saw sixty sources when it saw six.
 *
 *   `site:` queries — the first-party sweep — return nothing. Nobody swept the
 *   company's own website; claiming those sections were covered because the
 *   user happened to paste a press release would turn "we did not look" into
 *   "we looked and found nothing", which is the one negative that must always
 *   be real. The sweep therefore reports every section as unchecked, which is
 *   what actually happened.
 */
export class ProvidedEvidenceSearchClient implements SearchClient {
  readonly id = 'provided-evidence';
  readonly queriesAsked: string[] = [];
  readonly #results: SearchResult[];
  #delivered = false;

  constructor(evidence: ProvidedEvidence[]) {
    this.#results = evidence.map((item) => ({
      query: 'user-provided',
      title: item.title,
      url: item.url,
      snippet: evidenceSnippet(item),
      retrievedAt: item.providedAt,
    }));
  }

  async search(query: string): Promise<SearchResult[]> {
    this.queriesAsked.push(query);
    if (query.startsWith('site:') || this.#delivered) return [];
    this.#delivered = true;
    return this.#results.map((result) => ({ ...result, query }));
  }
}

/**
 * Serves pasted bodies as retrieved pages.
 *
 * This is the reason passage verification still means something here. The body
 * is the user's, but the check against it is the engine's: an extracted claim
 * whose supporting passage is absent from the pasted text fails verification
 * and is recorded as failing, which is how an invented passage is caught.
 *
 * Evidence supplied as a snippet only (no body) is reported `unavailable`, not
 * fabricated into a page — a snippet is a third party's summary and must never
 * be scored as a retrieved page.
 */
export class ProvidedPageRetriever implements PageRetriever {
  readonly id = 'provided-page';
  readonly requested: string[] = [];
  readonly #pages: Map<string, RetrievedPage>;

  constructor(evidence: ProvidedEvidence[]) {
    this.#pages = new Map(
      evidence
        .filter((item) => item.text.trim().length > 0)
        .map((item) => {
          const text = item.text.replace(/\s+/g, ' ').trim();
          return [
            item.url,
            {
              url: item.url,
              status: 200,
              text,
              retrievedAt: item.providedAt,
              contentHash: contentHash(text),
            } satisfies RetrievedPage,
          ];
        }),
    );
  }

  describe(): ProviderOperation {
    return {
      providerId: this.id,
      operation: 'provided.retrieve_page',
      dataType: 'web_page',
      cost: { credits: 0 },
      availability: 'available',
      // Not 0.9. The body is real text, but its origin is asserted by the
      // person who pasted it rather than established by fetching the URL.
      confidence: 0.6,
    };
  }

  async retrieve(url: string): Promise<RetrievalOutcome> {
    this.requested.push(url);
    const page = this.#pages.get(url);
    if (!page) {
      return {
        status: 'unavailable',
        url,
        reason: 'only a snippet was supplied for this source; no page body to check against',
      };
    }
    return { status: 'retrieved', page };
  }
}

export interface ReasoningExtractorOptions {
  extractor: Pick<LlmClaimExtractor, 'id' | 'extractClaims'>;
  reasoner: Pick<Reasoner, 'reason'>;
  /** The target fingerprints, by canonical domain, for the pre-gate below. */
  fingerprints: Map<string, IdentityFingerprint>;
  /** Recorded per company, so a run can show what each model was given. */
  onTrace?: (trace: ExtractionTrace) => void;
}

export interface ExtractionTrace {
  domain: string;
  claimsExtracted: number;
  claimsDiscarded: number;
  claimsGated: number;
  factsReasonedOver: number;
  reasoningSkipped?: string;
  /**
   * Why each claim was refused by the pre-gate.
   *
   * Carried because of what the ClaimExtractor contract cannot express:
   * returning null means "researched, found nothing", and "every source was
   * about a different company" is a different statement with a different next
   * action. Without this the two collapse into one.
   */
  identityRejections?: { url: string; status: string; explanation: string }[];
  /** What the reasoning said that the evidence does not support. */
  grounding?: GroundingReport;
}

/**
 * The missing layer, assembled: EXTRACT → [identity gate] → REASON.
 *
 * `LlmClaimExtractor.extract()` refuses to author an inference chain, and it is
 * right to: reading a source and reasoning about it are different jobs, and
 * collapsing them is how a hypothesis gets presented as a finding. This class
 * performs them as two separate model calls with the engine's identity gate
 * BETWEEN them.
 *
 * The gate is run twice, deliberately. Here it decides what the reasoning model
 * is allowed to see, so a source about a different company never reaches the
 * commercial reasoning at all. In `WebResearchAdapter` it decides, again and
 * authoritatively, what becomes a Fact. This class has no power to admit
 * anything the adapter would reject; it can only withhold.
 */
export class ReasoningExtractor implements ClaimExtractor {
  readonly id: string;
  readonly #options: ReasoningExtractorOptions;

  constructor(options: ReasoningExtractorOptions) {
    this.#options = options;
    this.id = `${options.extractor.id}+reasoner`;
  }

  async extract(request: ExtractionRequest): Promise<ExtractionOutput | null> {
    const domain = request.company.domain;
    const fingerprint = this.#options.fingerprints.get(domain);
    if (!fingerprint) {
      throw new Error(`no identity fingerprint for ${domain}; the identity gate cannot be run`);
    }

    const extracted = await this.#options.extractor.extractClaims(request);

    if (extracted.claims.length === 0) {
      this.#trace({
        domain,
        claimsExtracted: 0,
        claimsDiscarded: extracted.discarded,
        claimsGated: 0,
        factsReasonedOver: 0,
        reasoningSkipped: 'no claim survived extraction',
      });
      return null;
    }

    // Pre-gate: promote against the same rules the adapter will apply, purely
    // to decide what the reasoning model sees. Nothing here is kept as a Fact.
    const admissible = [];
    const identityRejections: { url: string; status: string; explanation: string }[] = [];
    for (const claim of extracted.claims) {
      const outcome = promoteToFact(claim, fingerprint, request.runDate);
      if (outcome.status === 'promoted') {
        admissible.push(outcome.fact);
      } else if (outcome.status === 'rejected') {
        identityRejections.push({
          url: claim.sourceUrl,
          status: outcome.verdict.status,
          explanation: outcome.verdict.explanation,
        });
      } else {
        identityRejections.push({
          url: claim.sourceUrl,
          status: 'invalid_claim',
          explanation: outcome.errors.join('; '),
        });
      }
    }

    if (admissible.length === 0) {
      // Nothing may be reasoned over, so the reasoning model is not called at
      // all. The trace carries WHY, because returning null here would reach
      // the adapter as "researched, found nothing" — and "every source was
      // about a different company" is a different answer.
      this.#trace({
        domain,
        claimsExtracted: extracted.claims.length,
        claimsDiscarded: extracted.discarded,
        claimsGated: extracted.claims.length,
        factsReasonedOver: 0,
        reasoningSkipped: 'no claim passed the identity gate',
        identityRejections,
      });
      return null;
    }

    const reasoning = await this.#options.reasoner.reason({
      company: request.company,
      client: request.client,
      facts: admissible,
      runDate: request.runDate,
    });

    // --- GROUNDING --------------------------------------------------------
    // The chain validator checks that the reasoning is structurally sound. It
    // never reads the sentences, which is how "Thailand, China and Denmark"
    // reached a salesperson's brief on the strength of no source at all. This
    // reads them: any specific in the generated prose that appears in no piece
    // of evidence becomes a contradiction, which the engine already knows how
    // to act on — `conflicting` caps the score at 60 and routes to manual
    // review rather than to a phone call.
    const grounding = checkGrounding({
      assertions: {
        whatChanged: reasoning.whatChanged,
        hypothesis: reasoning.hypothesis.statement,
        whyNow: reasoning.whyNow,
        salesAngle: reasoning.salesAngle,
        testableBy: reasoning.hypothesis.testableBy,
        ...Object.fromEntries(
          reasoning.inferences.map((inference, i) => [`inference ${i + 1}`, inference.statement]),
        ),
      },
      facts: admissible,
      claims: extracted.claims,
      allowed: [
        request.company.name,
        request.company.domain,
        request.client.name,
        ...request.client.offerings,
        ...request.client.demandTriggers,
      ],
    });

    this.#trace({
      domain,
      claimsExtracted: extracted.claims.length,
      claimsDiscarded: extracted.discarded,
      claimsGated: extracted.claims.length - admissible.length,
      factsReasonedOver: admissible.length,
      ...(identityRejections.length > 0 ? { identityRejections } : {}),
      grounding,
    });

    return {
      trigger: reasoning.trigger || extracted.trigger,
      whatChanged: reasoning.whatChanged || extracted.whatChanged,
      ...(reasoning.triggerClaimIds ? { triggerClaimIds: reasoning.triggerClaimIds } : {}),
      // The claims are the extractor's, unaltered. The reasoner reads them; it
      // does not get to edit the evidence it reasons from.
      claims: extracted.claims,
      inferences: reasoning.inferences,
      hypothesis: reasoning.hypothesis,
      polarity: reasoning.polarity,
      polarityRationale: reasoning.polarityRationale,
      consequence: reasoning.consequence,
      owningFunction: reasoning.owningFunction,
      icpRelevance: reasoning.icpRelevance,
      contradictions: [...reasoning.contradictions, ...groundingContradictions(grounding)],
      judgements: reasoning.judgements,
      whyNow: reasoning.whyNow,
      salesAngle: reasoning.salesAngle,
    };
  }

  #trace(trace: ExtractionTrace): void {
    this.#options.onTrace?.(trace);
  }
}
