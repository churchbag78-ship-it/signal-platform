/**
 * The whole product, in one function.
 *
 *   website → commercial model → demand triggers → searches → candidate
 *   companies → identity resolution → evidence → [the existing engine] →
 *   opportunities and refusals
 *
 * The second half is not reimplemented. Once a candidate has been resolved to
 * an identity and its source pages fetched, it goes through `analyse()`
 * unchanged — the same identity gate, passage verification, grounding check,
 * chain validation, date attribution, direction grounding and two-axis scoring
 * that V1 already had. That machinery was the good half of the old product and
 * it is reused, not rebuilt.
 *
 * What this module adds is the half that never existed: the client is
 * understood from their own website, the triggers are derived from that
 * business rather than taken from a fixed taxonomy, and the companies are
 * discovered rather than typed in.
 *
 * Progress is reported as it happens. Every stage emits what it actually did,
 * including the stages that found nothing, because a run that cannot say what
 * it looked at cannot be trusted about what it found.
 */

import type { IsoDate } from '../../engine/src/domain.ts';
import type { ClientProfile } from '../../engine/src/pipeline.ts';
import type { SearchClient, SearchResult } from '../../engine/src/research/types.ts';
import type { PageRetriever } from '../../engine/src/research/retrieval.ts';
import { LlmClaimExtractor, LLM_PRESETS } from '../../engine/src/research/llm-extractor.ts';
import { analyse, type Assessment } from './analyse.ts';
import { buildCommercialModel, type CommercialModel } from './commercial-model.ts';
import { extractCandidates, mergeCandidates, type CandidateMention } from './discovery.ts';
import { Reasoner } from './reasoner.ts';
import { resolveAll, type Resolution } from './resolve.ts';
import { deriveTriggers, planQueries, type TriggerSet } from './triggers.ts';
import type { ModelClient } from './transport.ts';
import type { ProvidedEvidence } from './providers.ts';
import { readSite, type SiteCorpus } from './website.ts';

export type RunStage =
  | 'reading_website'
  | 'understanding_business'
  | 'deriving_triggers'
  | 'searching'
  | 'finding_companies'
  | 'resolving_identity'
  | 'gathering_evidence'
  | 'assessing'
  | 'done'
  | 'failed';

export interface RunProgress {
  stage: RunStage;
  message: string;
  done?: number;
  total?: number;
}

export interface SearchRecord {
  query: string;
  triggerId: string;
  resultCount: number;
  /** Present when the query could not be executed. Never reported as empty. */
  error?: string;
}

export interface AcceptedOpportunity {
  assessment: Assessment;
  /** The trigger whose search found this company, and why it was searched for. */
  trigger: { id: string; event: string; mechanism: string; offering: string };
  discovery: CandidateMention;
}

export interface RejectedCandidate {
  companyName: string;
  domain?: string;
  whatHappened: string;
  stage: string;
  reason: string;
  sourceUrls: string[];
}

export interface RunRecord {
  website: string;
  runDate: IsoDate;
  startedAt: string;
  finishedAt: string;
  corpus: { pagesRead: string[]; unavailable: { url: string; reason: string }[]; totalChars: number };
  model: CommercialModel | null;
  triggers: TriggerSet | null;
  searches: SearchRecord[];
  candidatesFound: number;
  ignoredResults: { url: string; why: string }[];
  resolutions: { resolved: number; ambiguous: number; unresolvable: number };
  unresolved: { companyName: string; status: string; explanation: string }[];
  opportunities: AcceptedOpportunity[];
  rejected: RejectedCandidate[];
  /** A stage that could not run at all. This is never a finding about anyone. */
  failure?: { stage: RunStage; reason: string };
}

export interface RunOptions {
  website: string;
  runDate: IsoDate;
  search: SearchClient;
  retriever: PageRetriever;
  model: ModelClient;
  /** Model credential for the two engine-side calls, which have their own clients. */
  engine: { apiKey: string; model: string; endpoint?: string };
  queryBudget?: number;
  maxCandidates?: number;
  /** Extra instruction for the trigger stage, e.g. a geography constraint. */
  constraints?: string;
  onProgress?: (progress: RunProgress) => void;
}

/**
 * The commercial model becomes the engine's client profile.
 *
 * This is the join between the new front half and the existing back half. The
 * offerings and exclusions are DERIVED from the website rather than typed by a
 * user, which is the whole point of the change — but the shape the engine
 * consumes is unchanged, so nothing downstream had to be touched.
 */
export function clientProfileFrom(model: CommercialModel, triggers: TriggerSet): ClientProfile {
  return {
    name: model.name,
    domain: model.domain,
    offerings: model.offerings.map((offering) => offering.name),
    demandTriggers: triggers.triggers.map((trigger) => trigger.event),
    buyerFunctions: [],
    disqualifiers: model.cannotServe,
  };
}

const MAX_EVIDENCE_PER_CANDIDATE = 4;

export async function runSignal(options: RunOptions): Promise<RunRecord> {
  const startedAt = new Date().toISOString();
  const report = (progress: RunProgress) => options.onProgress?.(progress);
  const website = options.website.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const record: RunRecord = {
    website,
    runDate: options.runDate,
    startedAt,
    finishedAt: startedAt,
    corpus: { pagesRead: [], unavailable: [], totalChars: 0 },
    model: null,
    triggers: null,
    searches: [],
    candidatesFound: 0,
    ignoredResults: [],
    resolutions: { resolved: 0, ambiguous: 0, unresolvable: 0 },
    unresolved: [],
    opportunities: [],
    rejected: [],
  };

  const finish = (stage: RunStage, reason?: string): RunRecord => {
    record.finishedAt = new Date().toISOString();
    if (reason) {
      record.failure = { stage, reason };
      report({ stage: 'failed', message: reason });
    } else {
      report({ stage: 'done', message: `${record.opportunities.length} opportunities` });
    }
    return record;
  };

  // --- 1. the website --------------------------------------------------
  report({ stage: 'reading_website', message: `Reading ${website}` });
  let corpus: SiteCorpus;
  try {
    corpus = await readSite({
      domain: website,
      retriever: options.retriever,
      onPage: (url, ok) =>
        report({ stage: 'reading_website', message: `${ok ? 'Read' : 'Could not read'} ${url}` }),
    });
  } catch (error) {
    return finish('reading_website', error instanceof Error ? error.message : String(error));
  }

  record.corpus = {
    pagesRead: corpus.pages.map((page) => page.url),
    unavailable: corpus.unavailable,
    totalChars: corpus.totalChars,
  };

  if (corpus.pages.length === 0) {
    return finish(
      'reading_website',
      `no page of ${website} could be read (${corpus.unavailable.length} attempted). ` +
        'Without the website there is nothing to build a commercial model from.',
    );
  }

  // --- 2. the commercial model -----------------------------------------
  report({
    stage: 'understanding_business',
    message: `Understanding the business from ${corpus.pages.length} pages`,
  });
  try {
    record.model = await buildCommercialModel(corpus, options.model);
  } catch (error) {
    return finish('understanding_business', error instanceof Error ? error.message : String(error));
  }

  // --- 3. demand triggers ----------------------------------------------
  report({ stage: 'deriving_triggers', message: 'Working out what creates demand for them' });
  try {
    record.triggers = await deriveTriggers(record.model, options.model);
  } catch (error) {
    return finish('deriving_triggers', error instanceof Error ? error.message : String(error));
  }

  report({
    stage: 'deriving_triggers',
    message: `${record.triggers.triggers.length} demand triggers, ${record.triggers.discarded.length} discarded as generic`,
  });

  // --- 4. search --------------------------------------------------------
  const plan = planQueries(record.triggers, options.queryBudget ?? 12);
  const resultsByTrigger = new Map<string, SearchResult[]>();

  for (const [index, planned] of plan.entries()) {
    report({
      stage: 'searching',
      message: planned.query,
      done: index,
      total: plan.length,
    });
    try {
      const results = await options.search.search(planned.query);
      record.searches.push({
        query: planned.query,
        triggerId: planned.triggerId,
        resultCount: results.length,
      });
      const existing = resultsByTrigger.get(planned.triggerId) ?? [];
      // De-duplicate by URL within a trigger: the same article appearing under
      // two phrasings is one event, not two.
      for (const result of results) {
        if (!existing.some((seen) => seen.url === result.url)) existing.push(result);
      }
      resultsByTrigger.set(planned.triggerId, existing);
    } catch (error) {
      // A query that could not run is a coverage failure, recorded as one.
      record.searches.push({
        query: planned.query,
        triggerId: planned.triggerId,
        resultCount: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const executed = record.searches.filter((search) => !search.error);
  if (executed.length === 0) {
    return finish(
      'searching',
      `no query could be executed (${record.searches.length} attempted). This is a research ` +
        'failure, not a finding: nothing has been established about any company.',
    );
  }

  // --- 5. candidate companies -------------------------------------------
  const groups: CandidateMention[][] = [];
  for (const trigger of record.triggers.triggers) {
    const results = resultsByTrigger.get(trigger.id) ?? [];
    if (results.length === 0) continue;

    report({
      stage: 'finding_companies',
      message: `Reading ${results.length} results for: ${trigger.event}`,
    });
    try {
      const discovery = await extractCandidates(
        results,
        trigger,
        record.model,
        options.model,
        options.runDate,
      );
      groups.push(discovery.candidates);
      record.ignoredResults.push(...discovery.ignored);
    } catch (error) {
      record.ignoredResults.push({
        url: `(trigger ${trigger.id})`,
        why: `candidate extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const merged = mergeCandidates(groups)
    .sort((a, b) => b.triggerIds.length - a.triggerIds.length || b.confidence - a.confidence)
    .slice(0, options.maxCandidates ?? 12);

  record.candidatesFound = merged.length;
  if (merged.length === 0) {
    return finish('finding_companies');
  }

  // --- 6. identity resolution -------------------------------------------
  report({ stage: 'resolving_identity', message: `Identifying ${merged.length} companies`, total: merged.length });
  const resolutions = await resolveAll(merged, options.search, (done, total) =>
    report({ stage: 'resolving_identity', message: `${done} of ${total}`, done, total }),
  );

  for (const resolution of resolutions) {
    record.resolutions[resolution.status === 'resolved' ? 'resolved' : resolution.status] += 1;
    if (resolution.status !== 'resolved') {
      record.unresolved.push({
        companyName: resolution.candidate.companyName,
        status: resolution.status,
        explanation: resolution.explanation,
      });
    }
  }

  const resolved = resolutions.filter(
    (resolution): resolution is Resolution & { fingerprint: NonNullable<Resolution['fingerprint']> } =>
      resolution.status === 'resolved' && resolution.fingerprint !== undefined,
  );

  if (resolved.length === 0) {
    return finish('resolving_identity');
  }

  // --- 7 & 8. evidence, then the existing engine ------------------------
  const client = clientProfileFrom(record.model, record.triggers);
  const triggerById = new Map(record.triggers.triggers.map((trigger) => [trigger.id, trigger]));

  for (const [index, resolution] of resolved.entries()) {
    const candidate = resolution.candidate;
    report({
      stage: 'gathering_evidence',
      message: candidate.companyName,
      done: index,
      total: resolved.length,
    });

    const evidence: ProvidedEvidence[] = [];
    for (const url of candidate.sourceUrls.slice(0, MAX_EVIDENCE_PER_CANDIDATE)) {
      const outcome = await options.retriever.retrieve(url);
      evidence.push({
        url,
        title: candidate.whatHappened.slice(0, 120),
        text: outcome.status === 'retrieved' ? outcome.page.text : '',
        snippet: candidate.whatHappened,
        providedBy: `signal discovery (${resolution.basis ?? 'resolved'})`,
        providedAt: options.runDate,
      });
    }

    if (evidence.every((item) => item.text.trim().length === 0)) {
      record.rejected.push({
        companyName: candidate.companyName,
        domain: resolution.fingerprint.canonicalDomain,
        whatHappened: candidate.whatHappened,
        stage: 'evidence_unavailable',
        reason:
          'none of the source pages could be retrieved, so no claim could be checked against a page. ' +
          'This is a retrieval failure, not a judgement about the company.',
        sourceUrls: candidate.sourceUrls,
      });
      continue;
    }

    report({ stage: 'assessing', message: candidate.companyName, done: index, total: resolved.length });

    const preset = LLM_PRESETS.anthropic!;
    const assessment = await analyse({
      client,
      target: resolution.fingerprint,
      evidence,
      runDate: options.runDate,
      extractor: new LlmClaimExtractor({
        ...preset,
        ...(options.engine.endpoint ? { endpoint: options.engine.endpoint } : {}),
        model: options.engine.model,
        apiKey: options.engine.apiKey,
      }),
      reasoner: new Reasoner({
        apiKey: options.engine.apiKey,
        model: options.engine.model,
        ...(options.engine.endpoint ? { endpoint: options.engine.endpoint } : {}),
      }),
    });

    const trigger = triggerById.get(candidate.triggerId);

    if (assessment.status === 'opportunity' && trigger) {
      record.opportunities.push({
        assessment,
        trigger: {
          id: trigger.id,
          event: trigger.event,
          mechanism: trigger.mechanism,
          offering: trigger.offering,
        },
        discovery: candidate,
      });
      continue;
    }

    record.rejected.push({
      companyName: candidate.companyName,
      domain: resolution.fingerprint.canonicalDomain,
      whatHappened: candidate.whatHappened,
      stage: assessment.status === 'rejected' ? assessment.stage : `run_failed:${assessment.status === 'failed' ? assessment.step : 'unknown'}`,
      reason: assessment.status === 'rejected' ? assessment.reason : assessment.status === 'failed' ? assessment.reason : 'no opportunity',
      sourceUrls: candidate.sourceUrls,
    });
  }

  // Strongest first: commercial value orders, evidence breaks ties — the same
  // rule the engine uses internally, applied across candidates.
  record.opportunities.sort((a, b) => {
    const left = a.assessment.status === 'opportunity' ? a.assessment.opportunity.axes : undefined;
    const right = b.assessment.status === 'opportunity' ? b.assessment.opportunity.axes : undefined;
    if (!left || !right) return 0;
    return right.value.score - left.value.score || right.evidence.score - left.evidence.score;
  });

  return finish('done');
}
