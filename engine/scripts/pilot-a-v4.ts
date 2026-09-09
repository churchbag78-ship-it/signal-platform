/**
 * Pilot A v4 — verification pipeline.
 *
 *   node scripts/pilot-a-v4.ts
 *
 * Runs the pilot twice against identical evidence:
 *
 *   A. UNVERIFIED — the honest state of this environment. Page retrieval is
 *      blocked, so every claim stays at snippet level and the 70-point cap
 *      applies.
 *
 *   B. RECONSTRUCTED — the same run with the verification path exercised
 *      against partial page reconstructions. This shows what the cap is
 *      costing and whether removing it produces real differentiation. It is
 *      NOT live verification; see fixtures/reconstructed-pages.ts.
 */

import { orbitalDirect, pilotATargets } from '../fixtures/pilot-a.ts';
import { liveCaptureV3, liveExtractionsV3 } from '../fixtures/pilot-a-live-v3.ts';
import { reconstructedPages } from '../fixtures/reconstructed-pages.ts';
import { AgentBridgeSearchClient } from '../src/research/agent-bridge.ts';
import { CorpusClaimExtractor } from '../src/research/corpus.ts';
import { WebResearchAdapter } from '../src/research/adapter.ts';
import { FixturePageRetriever, NullPageRetriever, type PageRetriever } from '../src/research/retrieval.ts';
import { runPipeline, type RunResult } from '../src/pipeline.ts';
import { supportingFacts } from '../src/claims.ts';
import type { ClientProfile } from '../src/pipeline.ts';
import type { CompanyIdentity } from '../src/domain.ts';

const RUN_DATE = '2026-09-09';
const FLOOR = 60;
const line = (c = '─') => console.log(c.repeat(78));

function prescreen(company: CompanyIdentity, _client: ClientProfile): string | null {
  const disqualified: Record<string, string> = {
    'bleckmann.com': 'third-party logistics provider — a competitor',
    'aldi.co.uk': 'enterprise retailer running its own distribution network',
  };
  const reason = disqualified[company.domain];
  return reason ? `${reason}; matches client disqualifier list` : null;
}

async function run(retriever: PageRetriever) {
  const search = new AgentBridgeSearchClient(liveCaptureV3);
  const adapter = new WebResearchAdapter({
    search,
    extractor: new CorpusClaimExtractor(liveExtractionsV3),
    targets: pilotATargets,
    runDate: RUN_DATE,
    maxQueriesPerCompany: 2,
    prescreen,
    retriever,
  });

  const started = Date.now();
  const result = await runPipeline(adapter, {
    client: orbitalDirect,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
    reportableFloor: FLOOR,
  });

  return { adapter, result, search, elapsedMs: Date.now() - started };
}

function summarise(label: string, run: Awaited<ReturnType<typeof run>>) {
  const { adapter, result } = run;
  const signals = adapter.signals();

  const verifications = signals.flatMap((s) => s.verifications);
  const pageLevel = verifications.filter((v) => v.level === 'page_retrieved').length;
  const snippetLevel = verifications.filter((v) => v.level === 'search_snippet').length;
  const retrievalFailures = verifications.filter((v) => v.outcome !== 'retrieved').length;
  const passageFailures = verifications.filter(
    (v) => v.outcome === 'retrieved' && v.level === 'search_snippet',
  ).length;

  console.log(`\n${label}`);
  line('═');
  console.log(`  reported: ${result.opportunities.length}   funnel: ${JSON.stringify(result.funnel)}`);
  console.log(
    `  verification — page: ${pageLevel} · snippet: ${snippetLevel} · ` +
      `retrieval failures: ${retrievalFailures} · passage mismatches: ${passageFailures}`,
  );

  for (const o of result.opportunities) {
    const caps = o.score.appliedCaps.map((c) => `${c.cap} (${c.reason})`).join('; ') || 'none';
    console.log(
      `  ${o.company.name.padEnd(26)} ${String(o.score.total).padStart(3)}/100  raw ${o.score.raw}  ` +
        `${o.score.classification.padEnd(22)} ${o.score.confidence.padEnd(6)} caps: ${caps}`,
    );
  }

  for (const drop of result.dropped) {
    console.log(`  ${drop.company.name.padEnd(26)} dropped [${drop.stage}] ${drop.reason}`);
  }

  return { pageLevel, snippetLevel, retrievalFailures, passageFailures };
}

function distribution(result: RunResult): string {
  const scores = result.opportunities.map((o) => o.score.total);
  if (scores.length === 0) return 'no scores';
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const spread = max - min;
  return `n=${scores.length} min=${min} max=${max} spread=${spread} mean=${mean.toFixed(1)} [${scores.join(', ')}]`;
}

console.log('\nSIGNAL — PILOT A v4 (VERIFICATION PIPELINE)');
line('═');
console.log(`CLIENT: ${orbitalDirect.name}   DATE: ${RUN_DATE}`);

const unverified = await run(
  new NullPageRetriever('egress policy blocks outbound page fetches from this environment'),
);
const unverifiedStats = summarise('A. UNVERIFIED — page retrieval blocked (the honest state)', unverified);

const reconstructed = await run(new FixturePageRetriever(reconstructedPages));
const reconstructedStats = summarise(
  'B. RECONSTRUCTED — verification path exercised (NOT live verification)',
  reconstructed,
);

console.log('\n\nSCORE DISTRIBUTION');
line('═');
console.log(`  A unverified:     ${distribution(unverified.result)}`);
console.log(`  B reconstructed:  ${distribution(reconstructed.result)}`);
console.log(`  raw (uncapped):   ${unverified.result.opportunities.map((o) => o.score.raw).join(', ')}`);

console.log('\n\nREASONING CHAIN — strongest opportunity');
line('═');

const top = reconstructed.result.opportunities[0];
if (top) {
  const signal = reconstructed.adapter.signals().find((s) => s.company.domain === top.company.domain)!;
  console.log(`\n  ${top.company.name} — ${top.score.total}/100 (raw ${top.score.raw})\n`);

  console.log('  FACTS (what a source states)');
  for (const f of supportingFacts(signal.hypothesis.id, signal.claims)) {
    console.log(`    • ${f.statement}`);
    console.log(`      ${f.source.publisher} tier ${f.source.tier} · ${f.eventDate ?? 'undated'} · ${f.verification}`);
    console.log(`      identity: ${f.identity?.status} — ${f.identity?.explanation}`);
  }

  console.log('\n  INFERENCE (what we concluded)');
  for (const c of signal.claims.filter((c) => c.kind === 'inference')) {
    console.log(`    → ${c.statement}`);
    console.log(`      because: ${c.reasoning}`);
  }

  console.log('\n  HYPOTHESIS (unproven commercial implication)');
  console.log(`    ? ${signal.hypothesis.statement}`);
  console.log(`      test: ${signal.hypothesis.testableBy}`);

  console.log(`\n  CLIENT RELEVANCE   ${signal.icpRelevance.rationale}`);
  console.log(`  POLARITY           ${signal.polarity} — ${signal.polarityRationale}`);
  console.log(`  CONSEQUENCE        ${signal.consequence.rationale}`);
  console.log(`  OWNING ROLE        ${signal.owningFunction.function}`);
  console.log(`  WHY NOW            ${signal.whyNow}`);
  console.log(`  SALES ACTION       ${top.recommendedAction.action} — ${top.recommendedAction.rationale}`);
  console.log(`  ANGLE              ${signal.salesAngle}`);
}

console.log('\n\nVERIFICATION FAILURES');
line('═');
for (const signal of reconstructed.adapter.signals()) {
  for (const v of signal.verifications.filter((v) => v.failure)) {
    console.log(`  ${signal.company.name}: ${v.url}`);
    console.log(`    ${v.failure}`);
  }
}
console.log(
  `\n  A: ${unverifiedStats.retrievalFailures} retrieval failures (all: retrieval unavailable)` +
    `\n  B: ${reconstructedStats.retrievalFailures} retrieval failures, ` +
    `${reconstructedStats.passageFailures} passage mismatches`,
);
console.log();
