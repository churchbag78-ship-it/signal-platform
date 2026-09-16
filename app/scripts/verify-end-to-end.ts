/**
 * End-to-end verification of the product, using real recorded model responses.
 *
 * What this runs: the whole product path, with nothing stubbed downstream of
 * the HTTP boundary.
 *
 *   recorded EXTRACTION response  → LlmClaimExtractor (parse, coerce, validate)
 *   → source classification → IDENTITY GATE → Facts
 *   → recorded REASONING response → Reasoner (parse, coerce, validate)
 *   → grounding check → chain validation → direction → dating → freshness
 *   → two-axis scoring → quadrant → recommended action
 *
 * What it cannot run, and does not pretend to:
 *
 *   The HTTP calls themselves. There is no LLM credential in this environment
 *   (`api.anthropic.com` answers and returns 401), so both model responses are
 *   replayed through a transport rather than fetched. Everything downstream of
 *   `fetch` is real; `fetch` is not.
 *
 *   Live retrieval. Outbound CONNECT is refused with 403, so page bodies come
 *   from `reconstructed-pages.ts`, which are search snippets wrapped in a body
 *   and labelled as such. Passage matching against them is close to circular
 *   and is reported that way below.
 *
 * Each case carries an expectation written before its response — including two
 * that expect the engine to REJECT the reasoning. A response that flatters
 * itself fails here.
 */

import { LLM_PRESETS, LlmClaimExtractor } from '../../engine/src/research/llm-extractor.ts';
import { realExtractionCases, recordedTransport } from '../../engine/fixtures/real-model-extractions.ts';
import { reconstructedPagesV5 } from '../../engine/fixtures/reconstructed-pages.ts';
import { orbitalDirect, pilotATargets } from '../../engine/fixtures/pilot-a.ts';
import { Reasoner } from '../src/reasoner.ts';
import { analyse, type Assessment } from '../src/analyse.ts';
import type { ProvidedEvidence } from '../src/providers.ts';
import { realReasoningCases } from '../fixtures/real-reasoning.ts';

const RUN_DATE = '2026-09-09';

const pagesByUrl = new Map(reconstructedPagesV5.map((page) => [page.url, page.text]));

function reasoningTransport(responseText: string) {
  return (async () =>
    new Response(JSON.stringify({ content: [{ text: responseText }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof globalThis.fetch;
}

/** A reasoner that must never be called. Used for the identity-collision case. */
const refusingReasoner = {
  calls: 0,
  async reason(): Promise<never> {
    refusingReasoner.calls += 1;
    throw new Error('the reasoning model was called for a company with no admissible facts');
  },
};

interface Line {
  id: string;
  expected: string;
  got: string;
  pass: boolean;
  detail: string;
}

const lines: Line[] = [];

function describe(assessment: Assessment): string {
  if (assessment.status === 'opportunity') {
    return `opportunity (${assessment.opportunity.axes?.quadrant ?? 'unscored'})`;
  }
  if (assessment.status === 'rejected') return `rejected: ${assessment.stage}`;
  return `failed: ${assessment.step}`;
}

for (const reasoningCase of realReasoningCases) {
  const extractionCase = realExtractionCases.find((c) => c.id === reasoningCase.id);
  if (!extractionCase) throw new Error(`no extraction case for ${reasoningCase.id}`);

  const target = pilotATargets.find((t) => t.canonicalDomain === extractionCase.targetDomain);
  if (!target) throw new Error(`no fingerprint for ${extractionCase.targetDomain}`);

  // The evidence a user would have pasted: the sources the run actually saw.
  const evidence: ProvidedEvidence[] = extractionCase.results.map((result) => ({
    url: result.url,
    title: result.title,
    text: pagesByUrl.get(result.url) ?? '',
    snippet: result.snippet,
    providedBy: 'recorded Pilot A capture',
    providedAt: RUN_DATE,
  }));

  const extractor = new LlmClaimExtractor(
    { ...LLM_PRESETS.anthropic!, model: 'recorded', apiKey: 'replayed' },
    recordedTransport(extractionCase.modelResponse),
  );

  const reasoner =
    reasoningCase.expect.outcome === 'no_facts'
      ? refusingReasoner
      : new Reasoner({ apiKey: 'replayed', model: 'recorded' }, reasoningTransport(reasoningCase.response));

  const assessment = await analyse({
    client: orbitalDirect,
    target,
    evidence,
    runDate: RUN_DATE,
    extractor,
    reasoner,
  });

  const detail: string[] = [];
  let pass = false;

  if (reasoningCase.expect.outcome === 'no_facts') {
    pass =
      assessment.status === 'rejected' &&
      refusingReasoner.calls === 0 &&
      assessment.trace?.reasoningSkipped !== undefined;
    detail.push(`reasoning model called: ${refusingReasoner.calls} times`);
    if (assessment.status === 'rejected') detail.push(`engine said: ${assessment.reason}`);
  } else if (reasoningCase.expect.outcome === 'rejected') {
    pass = assessment.status === 'rejected' && assessment.stage === reasoningCase.expect.stage;
    if (assessment.status === 'rejected') detail.push(`engine said: ${assessment.reason}`);
  } else {
    pass = assessment.status === 'opportunity';
    if (assessment.status === 'opportunity') {
      const axes = assessment.opportunity.axes;
      detail.push(
        `evidence ${axes?.evidence.score ?? '?'} / value ${axes?.value.score ?? '?'}`,
        `direction: ${assessment.signal.polarity} (model declared ${assessment.signal.declaredPolarity})`,
        `dated: ${assessment.signal.eventDate ?? 'no source dates the change'}`,
        `action: ${assessment.opportunity.recommendedAction.action}`,
      );
      if (reasoningCase.expect.groundedPolarity) {
        const ok = assessment.signal.polarity === reasoningCase.expect.groundedPolarity;
        if (!ok) {
          pass = false;
          detail.push(
            `EXPECTED the engine to derive ${reasoningCase.expect.groundedPolarity}, got ${assessment.signal.polarity}`,
          );
        }
      }
    }
  }

  const ungrounded = assessment.trace?.grounding?.findings ?? [];
  if (reasoningCase.expect.ungroundedSpecifics !== undefined) {
    const ok = ungrounded.length === reasoningCase.expect.ungroundedSpecifics;
    if (!ok) pass = false;
    detail.push(
      `ungrounded specifics: ${ungrounded.length} (expected ${reasoningCase.expect.ungroundedSpecifics})` +
        (ungrounded.length ? ` — ${ungrounded.map((f) => `${f.specific} in ${f.field}`).join(', ')}` : ''),
    );
  } else if (ungrounded.length > 0) {
    detail.push(`ungrounded specifics: ${ungrounded.map((f) => f.specific).join(', ')}`);
  }

  lines.push({
    id: reasoningCase.id,
    expected:
      reasoningCase.expect.outcome === 'rejected'
        ? `rejected: ${reasoningCase.expect.stage}`
        : reasoningCase.expect.outcome,
    got: describe(assessment),
    pass,
    detail: detail.join('\n      '),
  });
}

// --- report ---------------------------------------------------------------

console.log('SIGNAL — END-TO-END VERIFICATION');
console.log(`run date ${RUN_DATE}\n`);
console.log('Replayed: both model calls (no LLM credential in this environment — api.anthropic.com returns 401).');
console.log('Reconstructed: page bodies (outbound CONNECT is refused with 403, so no page was fetched).');
console.log('Real: every engine step between and after them.\n');

for (const line of lines) {
  console.log(`${line.pass ? 'PASS' : 'FAIL'}  ${line.id}`);
  console.log(`      expected ${line.expected}, got ${line.got}`);
  if (line.detail) console.log(`      ${line.detail}`);
  console.log();
}

const failed = lines.filter((line) => !line.pass);
console.log(`${lines.length - failed.length}/${lines.length} cases behaved as expected.`);

if (failed.length > 0) {
  console.log(`\nFAILED: ${failed.map((f) => f.id).join(', ')}`);
  process.exitCode = 1;
}
