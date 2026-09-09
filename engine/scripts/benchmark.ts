/**
 * Commercial benchmark — engine versus gold set.
 *
 *   node scripts/benchmark.ts
 *
 * Runs Pilot A exactly as `pilot-a-v4` does, then measures the result against
 * `benchmark/gold-set.ts`. The gold labels were written from the sources, not
 * from the scores. Nothing here changes the engine.
 */

import { orbitalDirect, pilotATargets } from '../fixtures/pilot-a.ts';
import { liveCaptureV3, liveExtractionsV3 } from '../fixtures/pilot-a-live-v3.ts';
import { reconstructedPages } from '../fixtures/reconstructed-pages.ts';
import { AgentBridgeSearchClient } from '../src/research/agent-bridge.ts';
import { CorpusClaimExtractor } from '../src/research/corpus.ts';
import { WebResearchAdapter } from '../src/research/adapter.ts';
import { FixturePageRetriever, NullPageRetriever, type PageRetriever } from '../src/research/retrieval.ts';
import { runPipeline } from '../src/pipeline.ts';
import type { ClientProfile } from '../src/pipeline.ts';
import type { CompanyIdentity } from '../src/domain.ts';
import { orbitalGoldSet } from '../benchmark/gold-set.ts';
import { evaluate, matrixCell, type EngineOutcome, type Evaluation } from '../src/analysis/evaluation.ts';
import { assessReasoning, GENERIC_PATTERNS } from '../src/analysis/reasoning.ts';

const RUN_DATE = '2026-09-09';
const FLOOR = 60;
const line = (c = '─') => console.log(c.repeat(78));
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

function prescreen(company: CompanyIdentity, _client: ClientProfile): string | null {
  const disqualified: Record<string, string> = {
    'bleckmann.com': 'third-party logistics provider — a competitor',
    'aldi.co.uk': 'enterprise retailer running its own distribution network',
  };
  const reason = disqualified[company.domain];
  return reason ? `${reason}; matches client disqualifier list` : null;
}

async function runPilot(retriever: PageRetriever) {
  const adapter = new WebResearchAdapter({
    search: new AgentBridgeSearchClient(liveCaptureV3),
    extractor: new CorpusClaimExtractor(liveExtractionsV3),
    targets: pilotATargets,
    runDate: RUN_DATE,
    maxQueriesPerCompany: 2,
    prescreen,
    retriever,
  });

  const result = await runPipeline(adapter, {
    client: orbitalDirect,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
    reportableFloor: FLOOR,
  });

  return { adapter, result };
}

/**
 * Turn a run into the per-company record the evaluation consumes. Every target
 * put to the engine appears, whatever happened to it — a company researched
 * and rejected must not look the same as one never researched.
 */
function outcomesFrom(run: Awaited<ReturnType<typeof runPilot>>): EngineOutcome[] {
  const { adapter, result } = run;
  const outcomes: EngineOutcome[] = [];

  result.opportunities.forEach((o, index) => {
    outcomes.push({
      domain: o.company.domain,
      company: o.company.name,
      reported: true,
      score: o.score.total,
      raw: o.score.raw,
      rank: index + 1,
      confidence: o.score.confidence,
      classification: o.score.classification,
      action: o.recommendedAction.action,
      researched: true,
    });
  });

  for (const drop of result.dropped) {
    outcomes.push({
      domain: drop.company.domain,
      company: drop.company.name,
      reported: false,
      rejectedAt: drop.stage,
      rejectionReason: drop.reason,
      researched: true,
    });
  }

  for (const rejection of adapter.rejections()) {
    outcomes.push({
      domain: rejection.company.domain,
      company: rejection.company.name,
      reported: false,
      rejectedAt: rejection.stage,
      rejectionReason: rejection.reason,
      // A prescreen rejection spent no research. It is a target-selection
      // decision, not a research finding, and is recorded as such.
      researched: rejection.queriesRun.length > 0,
    });
  }

  return outcomes;
}

function report(label: string, evaluation: Evaluation, outcomes: EngineOutcome[]) {
  console.log(`\n\n${label}`);
  line('═');

  const { confusion: c, rates: r } = evaluation;
  console.log(`\n  CONFUSION`);
  console.log(
    `    true positives ${c.truePositives} · false positives ${c.falsePositives} · ` +
      `false negatives ${c.falseNegatives} · true negatives ${c.trueNegatives} · ` +
      `never researched ${c.notResearched}`,
  );
  console.log(`\n  RATES`);
  console.log(`    reported                     ${r.reported}`);
  console.log(`    precision                    ${pct(r.precision)}`);
  console.log(`    false-positive rate          ${pct(r.falsePositiveRate)}  (of reported)`);
  console.log(`    false-positive rate          ${pct(r.falsePositiveRateOverNegatives)}  (of true negatives + FP)`);
  console.log(`    recall (all gold)            ${pct(r.recall)}`);
  console.log(`    recall (researched only)     ${pct(r.recallOfResearched)}`);
  console.log(`    genuine opportunities missed ${r.missed}`);

  console.log(`\n  PER COMPANY`);
  for (const row of evaluation.rows) {
    const e = row.engine;
    const enginePart = e?.reported
      ? `#${e.rank} ${e.score}/100 ${e.confidence} ${e.action}`
      : e
        ? `not reported [${e.rejectedAt}]${e.researched ? '' : ' (no research spent)'}`
        : 'never put to the engine';
    console.log(
      `    ${row.gold.company.padEnd(28)} gold ${row.gold.label.padEnd(24)} ` +
        `ev/${row.gold.evidence.padEnd(6)} val/${row.gold.value.padEnd(6)} ` +
        `${row.verdict.padEnd(15)} ${enginePart}`,
    );
  }

  const rank = evaluation.ranking;
  console.log(`\n  RANKING QUALITY (against gold commercial value)`);
  console.log(
    `    pairs ${rank.pairs} · concordant ${rank.concordant} · discordant ${rank.discordant} · ` +
      `tied on value ${rank.tied} · tau ${rank.tau.toFixed(2)}${rank.undiscriminating ? ' (no comparable pairs)' : ''}`,
  );
  for (const inv of rank.inversions) {
    console.log(`    inversion: ${inv.above} ranked above ${inv.below}, which the gold set values higher`);
  }

  const a = evaluation.actions;
  console.log(`\n  RECOMMENDED ACTIONS`);
  console.log(`    ${JSON.stringify(a.byAction)}`);
  console.log(`    draft_outreach   ${a.draftOutreach}/${a.total} (${pct(a.draftOutreachShare)})`);
  console.log(`    research_further ${a.researchFurther}/${a.total} (${pct(a.researchFurtherShare)})`);
  if (a.outreachOnNonStrong.length > 0) {
    console.log(`    outreach recommended on non-A rows: ${a.outreachOnNonStrong.join(', ')}`);
  }

  console.log(`\n  EVIDENCE QUALITY (engine confidence vs gold evidence grade)`);
  console.log(`    agreement ${evaluation.evidence.agree}/${evaluation.evidence.compared} (${pct(evaluation.evidence.agreementRate)})`);
  for (const o of evaluation.evidence.overstated) {
    console.log(`    overstated:  ${o.company} — engine ${o.engine}, gold ${o.gold}`);
  }
  for (const o of evaluation.evidence.understated) {
    console.log(`    understated: ${o.company} — engine ${o.engine}, gold ${o.gold}`);
  }

  console.log(`\n  COMMERCIAL VALUE (engine score band vs gold value grade)`);
  console.log(`    agreement ${evaluation.value.agree}/${evaluation.value.compared} (${pct(evaluation.value.agreementRate)})`);
  for (const o of evaluation.value.overstated) {
    console.log(`    overstated:  ${o.company} — engine ${o.engine}, gold ${o.gold}`);
  }
  for (const o of evaluation.value.understated) {
    console.log(`    understated: ${o.company} — engine ${o.engine}, gold ${o.gold}`);
  }

  void outcomes;
}

const unverified = await runPilot(
  new NullPageRetriever('egress policy blocks outbound page fetches from this environment'),
);
const reconstructed = await runPilot(new FixturePageRetriever(reconstructedPages));

const unverifiedOutcomes = outcomesFrom(unverified);
const reconstructedOutcomes = outcomesFrom(reconstructed);

const evalA = evaluate(orbitalGoldSet, unverifiedOutcomes);
const evalB = evaluate(orbitalGoldSet, reconstructedOutcomes);

console.log('\nSIGNAL — COMMERCIAL BENCHMARK (engine vs gold set)');
line('═');
console.log(`CLIENT: ${orbitalDirect.name}   DATE: ${RUN_DATE}   GOLD ENTRIES: ${orbitalGoldSet.length}`);
console.log('Gold labels were written from the sources, without reference to engine scores.');

report('A. UNVERIFIED RUN — page retrieval blocked (the honest state)', evalA, unverifiedOutcomes);
report('B. RECONSTRUCTED RUN — verification path exercised (NOT live verification)', evalB, reconstructedOutcomes);

console.log('\n\nTWO-AXIS MATRIX (gold evidence x gold commercial value)');
line('═');
console.log('  Rows: evidence quality. Columns: commercial value. * = reported by the engine.\n');
const grades = ['high', 'medium', 'low'] as const;
console.log(`    ${''.padEnd(10)}${grades.map((g) => `value ${g}`.padEnd(22)).join('')}`);
for (const evidence of grades) {
  const cells = grades.map((value) =>
    matrixCell(evalB.matrix, evidence, value)
      .map((m) => `${m.company.split(' ')[0]}${m.reported ? '*' : ''}`)
      .join(', ') || '—',
  );
  console.log(`    ev ${evidence.padEnd(7)}${cells.map((c) => c.padEnd(22)).join('')}`);
}
console.log('\n  Read: the engine reported four rows, none of them in the high/high cell.');
console.log('  The one high/high entry — NMS — was never surfaced.');

console.log('\n\nCOMMERCIAL REASONING — tested separately from the evidence');
line('═');
console.log(
  '  Specificity: "generic" = asserts a logistics need without naming what creates it;\n' +
    '  "thin" = fewer than two independent anchors (geography, quantity, cargo regime,\n' +
    '  named service, timing); "specific" = two or more anchors and no generic phrasing.\n' +
    `  ${GENERIC_PATTERNS.length} generic constructions are searched for.\n`,
);

const reasoning = reconstructed.result.opportunities.map((o) => {
  const signal = reconstructed.adapter
    .signals()
    .find((s) => s.company.domain === o.company.domain)!;
  return assessReasoning({
    company: o.company.name,
    claims: signal.claims,
    hypothesis: signal.hypothesis,
    salesAngle: o.salesAngle,
    whyNow: o.whyNow,
    consequence: signal.consequence.rationale,
  });
});

console.log(
  `    ${'company'.padEnd(24)}${'hypothesis'.padEnd(12)}${'angle'.padEnd(12)}` +
    `${'why now'.padEnd(12)}${'consequence'.padEnd(14)}levels`,
);
for (const r of reasoning) {
  console.log(
    `    ${r.company.padEnd(24)}${r.hypothesis.verdict.padEnd(12)}${r.salesAngle.verdict.padEnd(12)}` +
      `${r.whyNow.verdict.padEnd(12)}${r.consequence.verdict.padEnd(14)}${r.depth.levels}/3` +
      `${r.depth.answersItsOwnQuestion ? '  ANSWERS ITS OWN QUESTION' : ''}`,
  );
}

const genericHits = reasoning.flatMap((r) =>
  [r.hypothesis, r.salesAngle, r.whyNow, r.consequence].flatMap((s) =>
    s.generic.map((g) => `${r.company}: ${g}`),
  ),
);
console.log(
  `\n  Generic-logistics hallucinations found: ${genericHits.length}` +
    (genericHits.length > 0 ? `\n    ${genericHits.join('\n    ')}` : ''),
);
console.log(
  `  Thin surfaces (no generic phrasing, but under two anchors): ` +
    reasoning
      .flatMap((r) =>
        (
          [
            ['hypothesis', r.hypothesis],
            ['angle', r.salesAngle],
            ['why now', r.whyNow],
            ['consequence', r.consequence],
          ] as const
        )
          .filter(([, s]) => s.verdict === 'thin')
          .map(([name, s]) => `${r.company}/${name} (${s.markerCount} anchor)`),
      )
      .join(', ') || 'none',
);
console.log(
  `  Second-order reasoning: ${reasoning.filter((r) => r.depth.levels === 3).length}/${reasoning.length} reach all three levels; ` +
    `${reasoning.filter((r) => r.depth.answersItsOwnQuestion).length} answer their own third-order question.`,
);
console.log(`  Fully passing all reasoning checks: ${reasoning.filter((r) => r.passes).length}/${reasoning.length}`);

console.log('\n\nFAILURE ACCOUNTING');
line('═');
console.log(`\n  MISSED OPPORTUNITIES BY CAUSE`);
console.log(`    ${JSON.stringify(evalB.failures.missesByReason)}`);
for (const m of evalB.failures.misses) {
  console.log(`    ${m.company.padEnd(28)} ${m.label.padEnd(24)} ${m.reason}`);
}
console.log(`\n  ENGINE ERRORS BY KIND`);
console.log(`    ${JSON.stringify(evalB.failures.errorsByKind)}`);
for (const e of evalB.failures.errors) {
  console.log(`    ${e.company} — ${e.kind}`);
  console.log(`      ${e.detail}`);
}
console.log();
