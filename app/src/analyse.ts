/**
 * One assessment, end to end.
 *
 * Evidence in → claims (AI) → identity gate → facts → commercial reasoning
 * (AI) → grounding check → chain validation → direction → dating → freshness
 * → two-axis score → quadrant → recommended action.
 *
 * Two model calls, both bounded and both auditable. Everything between and
 * after them is deterministic engine code that already existed and is used
 * unchanged. This module is wiring and honesty: it assembles the run, and it
 * records what happened including when nothing did.
 */

import type { IdentityFingerprint, IsoDate } from '../../engine/src/domain.ts';
import { toCompanyIdentity } from '../../engine/src/domain.ts';
import type { ClientProfile, Opportunity } from '../../engine/src/pipeline.ts';
import { runPipeline } from '../../engine/src/pipeline.ts';
import { WebResearchAdapter } from '../../engine/src/research/adapter.ts';
import type { NoSignal, ResearchSignal } from '../../engine/src/research/types.ts';
import type { ResearchCoverage } from '../../engine/src/research/history.ts';
import {
  ProvidedEvidenceSearchClient,
  ProvidedPageRetriever,
  ReasoningExtractor,
  type ExtractionTrace,
  type ProvidedEvidence,
} from './providers.ts';
import type { LlmClaimExtractor } from '../../engine/src/research/llm-extractor.ts';
import type { Reasoner } from './reasoner.ts';
import { ownedDomains } from '../../engine/src/identity.ts';

export interface AnalyseRequest {
  client: ClientProfile;
  target: IdentityFingerprint;
  evidence: ProvidedEvidence[];
  runDate: IsoDate;
  extractor: Pick<LlmClaimExtractor, 'id' | 'extractClaims'>;
  reasoner: Pick<Reasoner, 'reason'>;
}

/**
 * What a run produced. Three outcomes, kept distinct on purpose:
 *
 *   `opportunity` — a signal that survived every gate and is worth a call.
 *   `rejected`    — the engine looked and reached a negative verdict. The
 *                   STAGE says which negative, because "found nothing",
 *                   "too thin", "wrong company" and "too old" are four
 *                   different answers with four different next actions.
 *   `failed`      — the run could not be completed: a model was unreachable,
 *                   a credential was missing. This is NEVER a finding about
 *                   the company and must never be displayed as one.
 */
export type Assessment =
  | {
      status: 'opportunity';
      company: { name: string; domain: string };
      runDate: IsoDate;
      opportunity: Opportunity;
      signal: ResearchSignal;
      trace: ExtractionTrace | null;
      coverage: ResearchCoverage | null;
      evidenceSupplied: EvidenceSummary;
    }
  | {
      status: 'rejected';
      company: { name: string; domain: string };
      runDate: IsoDate;
      stage: string;
      reason: string;
      errors?: string[];
      identityRejections?: { url: string; status: string; explanation: string }[];
      trace: ExtractionTrace | null;
      coverage: ResearchCoverage | null;
      evidenceSupplied: EvidenceSummary;
    }
  | {
      status: 'failed';
      company: { name: string; domain: string };
      runDate: IsoDate;
      /** Which step could not run. */
      step: 'extract' | 'reason' | 'pipeline';
      reason: string;
      trace: ExtractionTrace | null;
      evidenceSupplied: EvidenceSummary;
    };

export interface EvidenceSummary {
  items: number;
  /** Items where a page body was pasted, so passages can be checked. */
  withBody: number;
  /** Items on a domain the company owns. */
  firstParty: number;
  urls: string[];
}

export function summariseEvidence(
  evidence: ProvidedEvidence[],
  target: IdentityFingerprint,
): EvidenceSummary {
  const owned = ownedDomains(target);
  const isOwned = (url: string) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      return owned.some((domain) => host === domain || host.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  };

  return {
    items: evidence.length,
    withBody: evidence.filter((e) => e.text.trim().length > 0).length,
    firstParty: evidence.filter((e) => isOwned(e.url)).length,
    urls: evidence.map((e) => e.url),
  };
}

/** Which step a thrown error came from, so a failure names itself honestly. */
function stepOf(error: unknown): 'extract' | 'reason' | 'pipeline' {
  const message = error instanceof Error ? error.message : String(error);
  if (/extraction provider/i.test(message)) return 'extract';
  if (/reasoning model|cannot reason|hypothesis|inference/i.test(message)) return 'reason';
  return 'pipeline';
}

export async function analyse(request: AnalyseRequest): Promise<Assessment> {
  const company = toCompanyIdentity(request.target);
  const identity = { name: company.name, domain: company.domain };
  const evidenceSupplied = summariseEvidence(request.evidence, request.target);

  // A holder, not a plain `let`: the extractor writes the trace from inside a
  // callback, which narrowing cannot see.
  const traced: { value: ExtractionTrace | null } = { value: null };

  if (request.evidence.length === 0) {
    return {
      status: 'failed',
      company: identity,
      runDate: request.runDate,
      step: 'extract',
      reason: 'no evidence was supplied, so there was nothing to assess',
      trace: traced.value,
      evidenceSupplied,
    };
  }

  const search = new ProvidedEvidenceSearchClient(request.evidence);
  const retriever = new ProvidedPageRetriever(request.evidence);
  const extractor = new ReasoningExtractor({
    extractor: request.extractor,
    reasoner: request.reasoner,
    fingerprints: new Map([[company.domain, request.target]]),
    onTrace: (t) => {
      traced.value = t;
    },
  });

  const adapter = new WebResearchAdapter({
    search,
    extractor,
    retriever,
    targets: [request.target],
    runDate: request.runDate,
  });

  try {
    const result = await runPipeline(adapter, {
      client: request.client,
      runDate: request.runDate,
      ledger: [],
      limit: 1,
      twoAxis: true,
    });

    const outcome = adapter.outcomes[0];
    const coverage = adapter.coverageByDomain.get(company.domain) ?? null;
    const opportunity = result.opportunities[0];

    if (opportunity && outcome?.outcome === 'signal') {
      return {
        status: 'opportunity',
        company: identity,
        runDate: request.runDate,
        opportunity,
        signal: outcome.signal,
        trace: traced.value,
        coverage,
        evidenceSupplied,
      };
    }

    // The research produced a signal but the pipeline did not report it —
    // scoring floor, freshness, dedupe. The pipeline's own reason is the
    // honest one; falling back to the research rejection would be wrong.
    const droppedHere = result.dropped[0];
    if (outcome?.outcome === 'signal' && droppedHere) {
      return {
        status: 'rejected',
        company: identity,
        runDate: request.runDate,
        stage: droppedHere.stage,
        reason: droppedHere.reason,
        trace: traced.value,
        coverage,
        evidenceSupplied,
      };
    }

    const rejection: NoSignal | undefined =
      outcome?.outcome === 'no_signal' ? outcome.rejection : undefined;

    // The one place the app must correct the engine's reading.
    //
    // `ClaimExtractor.extract` can only return an output or null, and the
    // adapter reads null as "researched across the trigger model, found
    // nothing". When the reasoning was skipped because no claim survived the
    // identity gate, that is the wrong answer: nobody established that there
    // was nothing to find, only that the sources were about someone else.
    // Those two negatives must never collapse, so the trace restores the
    // distinction the interface cannot carry.
    const gated = traced.value;
    if (gated?.reasoningSkipped === 'no claim passed the identity gate') {
      const rejections = gated.identityRejections ?? [];
      const collision = rejections.some((r) => r.status === 'identity_collision');
      return {
        status: 'rejected',
        company: identity,
        runDate: request.runDate,
        stage: collision ? 'identity_collision' : 'identity_unresolved',
        reason: collision
          ? 'every source describes a different company with a similar name'
          : 'no source could be confidently attributed to this company',
        identityRejections: rejections,
        trace: traced.value,
        coverage,
        evidenceSupplied,
      };
    }

    return {
      status: 'rejected',
      company: identity,
      runDate: request.runDate,
      stage: rejection?.stage ?? droppedHere?.stage ?? 'unknown',
      reason: rejection?.reason ?? droppedHere?.reason ?? 'the run produced no signal and no reason',
      ...(rejection?.errors ? { errors: rejection.errors } : {}),
      ...(rejection?.identityRejections
        ? { identityRejections: rejection.identityRejections }
        : {}),
      trace: traced.value,
      coverage,
      evidenceSupplied,
    };
  } catch (error) {
    // A model that could not be reached is not a verdict on the company.
    return {
      status: 'failed',
      company: identity,
      runDate: request.runDate,
      step: stepOf(error),
      reason: error instanceof Error ? error.message : String(error),
      trace: traced.value,
      evidenceSupplied,
    };
  }
}
