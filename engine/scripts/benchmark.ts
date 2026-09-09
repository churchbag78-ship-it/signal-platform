/**
 * Commercial benchmark — engine versus gold set, before and after discovery.
 *
 *   node scripts/benchmark.ts
 *
 * BEFORE: the v4 engine — two fixed template queries per company, no
 * first-party sweep, no durable state.
 * AFTER:  the v5 engine — a mandatory first-party sweep on every owned domain,
 * then change-family queries, with research state persisted.
 *
 * Everything between discovery and the score is byte-identical across the two.
 * The gold labels were written from the sources, not from any score, and
 * nothing here changes the engine.
 */

import { orbitalDirect, pilotATargets } from '../fixtures/pilot-a.ts';
import { liveCaptureV3, liveExtractionsV3 } from '../fixtures/pilot-a-live-v3.ts';
import { liveCaptureV5, liveExtractionsV5 } from '../fixtures/pilot-a-live-v5.ts';
import { reconstructedPages, reconstructedPagesV5 } from '../fixtures/reconstructed-pages.ts';
import { AgentBridgeSearchClient } from '../src/research/agent-bridge.ts';
import { CorpusClaimExtractor } from '../src/research/corpus.ts';
import { WebResearchAdapter, rejectionState } from '../src/research/adapter.ts';
import {
  FixturePageRetriever,
  NullPageRetriever,
  type PageRetriever,
} from '../src/research/retrieval.ts';
import {
  InMemoryHistoryStore,
  type ResearchCoverage,
  type ResearchRecord,
} from '../src/research/history.ts';
import { CHANGE_FAMILIES } from '../src/research/change-families.ts';
import { SWEPT_SECTIONS } from '../src/research/first-party.ts';
import { runPipeline } from '../src/pipeline.ts';
import type { ClientProfile } from '../src/pipeline.ts';
import type { CompanyIdentity } from '../src/domain.ts';
import { orbitalGoldSet } from '../benchmark/gold-set.ts';
import {
  evaluate,
  matrixCell,
  type EngineOutcome,
  type Evaluation,
} from '../src/analysis/evaluation.ts';
import { assessReasoning, GENERIC_PATTERNS } from '../src/analysis/reasoning.ts';
import {
  discoveryCost,
  discoveryMetrics,
  discoveryRecall,
  recoveredSignals,
  POST_DISCOVERY_STAGES,
  type DiscoveryOutcome,
} from '../src/analysis/discovery.ts';

const RUN_DATE = '2026-09-09';
const FLOOR = 60;
/** The run's query budget. Sections and families beyond it are recorded unchecked. */
const FIRST_PARTY_SECTIONS = ['newsroom', 'press_releases', 'projects'] as const;
const FAMILY_BUDGET = 6;

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

type Strategy = 'template' | 'change_family';

const EMPTY_COVERAGE: ResearchCoverage = {
  familiesChecked: [],
  firstPartySectionsCovered: [],
  firstPartySectionsUnchecked: [],
  firstPartyPathsAttempted: 0,
  firstPartyPathsRetrieved: 0,
  firstPartySourcesFound: 0,
  firstPartyQueriesRun: 0,
  retrievalBlocked: false,
  queriesRun: [],
  sourcesSeen: 0,
};

/**
 * A record from the v1 run, seeded so persistence can be demonstrated rather
 * than described. ADS Laser Cutting WAS researched in v1 and then dropped from
 * the target list in v2 with nothing recording that it had ever been seen.
 */
const priorRuns = (): ResearchRecord[] => [
  {
    domain: 'adslaser.co.uk',
    company: 'ADS Laser Cutting Ltd',
    state: 'signal_found',
    reason: 'export_growth: first-half sales up 15% with an established Scandinavian customer base',
    lastCheckedAt: '2026-09-08',
    coverage: { ...EMPTY_COVERAGE, queriesRun: ['ADS Laser Cutting Ltd Leicester export growth'] },
    evidence: [],
    history: [
      {
        runDate: '2026-09-08',
        state: 'signal_found',
        reason: 'export_growth',
        queries: 1,
        sourcesSeen: 2,
      },
    ],
    timesResearched: 1,
  },
];

async function runPilot(strategy: Strategy, retriever: PageRetriever) {
  const legacy = strategy === 'template';
  const history = new InMemoryHistoryStore(priorRuns());

  const adapter = new WebResearchAdapter({
    search: new AgentBridgeSearchClient(legacy ? liveCaptureV3 : liveCaptureV5),
    extractor: new CorpusClaimExtractor(legacy ? liveExtractionsV3 : liveExtractionsV5),
    targets: pilotATargets,
    runDate: RUN_DATE,
    prescreen,
    retriever,
    queryStrategy: strategy,
    ...(legacy
      ? { maxQueriesPerCompany: 2 }
      : {
          familyBudget: FAMILY_BUDGET,
          firstPartySections: [...FIRST_PARTY_SECTIONS],
          maxFirstPartyPaths: 6,
          history,
        }),
  });

  const result = await runPipeline(adapter, {
    client: orbitalDirect,
    runDate: RUN_DATE,
    ledger: [],
    limit: 50,
    reportableFloor: FLOOR,
  });

  return { adapter, result, history };
}

function engineOutcomes(run: Awaited<ReturnType<typeof runPilot>>): EngineOutcome[] {
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
      researched: rejection.queriesRun.length > 0,
    });
  }

  return outcomes;
}

function discoveryOutcomes(run: Awaited<ReturnType<typeof runPilot>>): DiscoveryOutcome[] {
  const { adapter } = run;

  return adapter.outcomes.map((outcome) => {
    const company =
      outcome.outcome === 'signal' ? outcome.signal.company : outcome.rejection.company;
    const coverage =
      adapter.coverageByDomain.get(company.domain) ??
      (outcome.outcome === 'signal' ? outcome.signal.coverage : outcome.rejection.coverage) ??
      EMPTY_COVERAGE;

    return {
      domain: company.domain,
      company: company.name,
      state:
        outcome.outcome === 'signal' ? 'signal_found' : rejectionState(outcome.rejection.stage),
      changeFound:
        outcome.outcome === 'signal' ||
        POST_DISCOVERY_STAGES.includes(outcome.rejection.stage),
      signalDiscovered: outcome.outcome === 'signal',
      ...(outcome.outcome === 'signal' ? {} : { rejectedAt: outcome.rejection.stage }),
      coverage,
      identityRejections:
        outcome.outcome === 'signal'
          ? outcome.signal.identityRejections.map((r) => ({ url: r.url, status: r.status }))
          : (outcome.rejection.identityRejections ?? []).map((r) => ({
              url: r.url,
              status: r.status,
            })),
    };
  });
}

function reportEvaluation(label: string, evaluation: Evaluation) {
  console.log(`\n\n${label}`);
  line('═');

  const { confusion: c, rates: r } = evaluation;
  console.log(
    `\n  confusion   TP ${c.truePositives} · FP ${c.falsePositives} · FN ${c.falseNegatives} · ` +
      `TN ${c.trueNegatives} · never researched ${c.notResearched}`,
  );
  console.log(
    `  rates       reported ${r.reported} · precision ${pct(r.precision)} · ` +
      `FP-rate ${pct(r.falsePositiveRate)} (of reported) · recall ${pct(r.recall)} · missed ${r.missed}`,
  );

  console.log('\n  PER COMPANY');
  for (const row of evaluation.rows) {
    const e = row.engine;
    const enginePart = e?.reported
      ? `#${e.rank} ${e.score}/100 ${e.confidence} ${e.action}`
      : e
        ? `not reported [${e.rejectedAt}]${e.researched ? '' : ' (no research spent)'}`
        : 'never put to the engine';
    console.log(
      `    ${row.gold.company.padEnd(26)} gold ${row.gold.label.padEnd(22)} ` +
        `${row.verdict.padEnd(15)} ${enginePart}`,
    );
  }

  const rank = evaluation.ranking;
  console.log(
    `\n  ranking     concordant ${rank.concordant} · discordant ${rank.discordant} · ` +
      `tied on value ${rank.tied} · tau ${rank.tau.toFixed(2)}`,
  );
  for (const inv of rank.inversions) {
    console.log(`    inversion: ${inv.above} above ${inv.below}, which the gold set values higher`);
  }

  const a = evaluation.actions;
  console.log(`  actions     ${JSON.stringify(a.byAction)}`);
  console.log(
    `  evidence    agreement ${evaluation.evidence.agree}/${evaluation.evidence.compared} ` +
      `(${pct(evaluation.evidence.agreementRate)}), overstated ${evaluation.evidence.overstated.length}`,
  );
  for (const o of evaluation.evidence.overstated) {
    console.log(`    overstated: ${o.company} — engine ${o.engine}, gold ${o.gold}`);
  }
  console.log(
    `  value       agreement ${evaluation.value.agree}/${evaluation.value.compared} ` +
      `(${pct(evaluation.value.agreementRate)}), overstated ${evaluation.value.overstated.length}`,
  );
  for (const o of evaluation.value.overstated) {
    console.log(`    overstated: ${o.company} — engine ${o.engine}, gold ${o.gold}`);
  }
}

/* ------------------------------- run ------------------------------- */

const before = await runPilot('template', new FixturePageRetriever(reconstructedPages));
const afterUnverified = await runPilot('change_family', new NullPageRetriever('egress policy blocks outbound page fetches'));
const after = await runPilot('change_family', new FixturePageRetriever(reconstructedPagesV5));

console.log('\nSIGNAL — COMMERCIAL BENCHMARK · DISCOVERY MILESTONE');
line('═');
console.log(`CLIENT: ${orbitalDirect.name}   DATE: ${RUN_DATE}   GOLD ENTRIES: ${orbitalGoldSet.length}`);
console.log(
  `PLAN: first-party sweep over ${FIRST_PARTY_SECTIONS.length} of ${SWEPT_SECTIONS.length} sections ` +
    `· ${FAMILY_BUDGET} of ${CHANGE_FAMILIES.length} change families per company`,
);

/* --------------------------- discovery ----------------------------- */

const beforeDiscovery = discoveryOutcomes(before);
const afterDiscovery = discoveryOutcomes(after);

const prescreened = afterDiscovery.filter((o) => o.rejectedAt === 'icp').length;
const metricsBefore = discoveryMetrics(beforeDiscovery, prescreened, pilotATargets.length);
const metricsAfter = discoveryMetrics(afterDiscovery, prescreened, pilotATargets.length);

console.log('\n\nDISCOVERY');
line('═');
const row = (name: string, b: string | number, a: string | number) =>
  console.log(`  ${name.padEnd(38)}${String(b).padStart(10)}${String(a).padStart(14)}`);

console.log(`  ${''.padEnd(38)}${'BEFORE'.padStart(10)}${'AFTER'.padStart(14)}`);
row('companies in universe', metricsBefore.companiesInUniverse, metricsAfter.companiesInUniverse);
row('companies researched', metricsBefore.companiesResearched, metricsAfter.companiesResearched);
row('prescreened (no research spent)', metricsBefore.companiesPrescreened, metricsAfter.companiesPrescreened);
row('queries executed', metricsBefore.queriesTotal, metricsAfter.queriesTotal);
row('  first-party sweep', metricsBefore.queriesFirstParty, metricsAfter.queriesFirstParty);
row('  change-family', metricsBefore.queriesChangeFamily, metricsAfter.queriesChangeFamily);
row('change families covered', metricsBefore.familiesCovered, metricsAfter.familiesCovered);
row('first-party sources checked', metricsBefore.firstPartySourcesChecked, metricsAfter.firstPartySourcesChecked);
row('sources seen', metricsBefore.sourcesSeen, metricsAfter.sourcesSeen);
row('commercial changes found', metricsBefore.changesFound, metricsAfter.changesFound);
row('signals reaching scoring', metricsBefore.signalsDiscovered, metricsAfter.signalsDiscovered);
row('identity collisions caught', metricsBefore.identityCollisions, metricsAfter.identityCollisions);
row('identity unresolved', metricsBefore.identityUnresolved, metricsAfter.identityUnresolved);
row('stale rejections', metricsBefore.staleSignals, metricsAfter.staleSignals);
row('contradiction rejections', metricsBefore.contradictionRejections, metricsAfter.contradictionRejections);
row('genuine negatives retained', metricsBefore.genuineNegativesRetained, metricsAfter.genuineNegativesRetained);
row('research failures', metricsBefore.researchFailures, metricsAfter.researchFailures);

console.log('\n  QUERIES BY CHANGE FAMILY (after)');
for (const family of CHANGE_FAMILIES) {
  const n = metricsAfter.queriesByFamily[family.id] ?? 0;
  console.log(
    `    ${family.id.padEnd(24)}${family.strength.padEnd(10)}${String(n).padStart(3)}` +
      (n === 0 ? '   — outside this run’s budget' : ''),
  );
}

console.log('\n  FIRST-PARTY SECTIONS');
for (const section of SWEPT_SECTIONS) {
  const covered = metricsAfter.firstPartySectionsCovered[section] ?? 0;
  const unchecked = metricsAfter.firstPartySectionsUnchecked[section] ?? 0;
  const swept = (FIRST_PARTY_SECTIONS as readonly string[]).includes(section);
  console.log(
    `    ${section.padEnd(18)}covered ${String(covered).padStart(2)} · unchecked ${String(unchecked).padStart(2)}` +
      (swept ? '' : '   — not swept in this run (query budget)'),
  );
}
console.log(
  `\n  Direct page retrieval was blocked for ${metricsAfter.firstPartyRetrievalBlocked} of ` +
    `${afterDiscovery.length} companies; the site-scoped search channel carried the sweep.`,
);

/* ------------------------ discovery recall ------------------------- */

const recallBefore = discoveryRecall(orbitalGoldSet, beforeDiscovery);
const recallAfter = discoveryRecall(orbitalGoldSet, afterDiscovery);

console.log('\n\nDISCOVERY RECALL — measured separately from downstream precision');
line('═');
console.log(
  '  Recall counts a genuine opportunity as DISCOVERED when a commercial change was\n' +
    '  found and reached the pipeline — including when the pipeline then rejected it.\n' +
    '  Whether that rejection was right is a downstream question, measured below.\n',
);
console.log(
  `  BEFORE  ${recallBefore.discovered}/${recallBefore.opportunities} discovered (${pct(recallBefore.recall)}) · ` +
    `${recallBefore.scored} reached scoring`,
);
console.log(
  `  AFTER   ${recallAfter.discovered}/${recallAfter.opportunities} discovered (${pct(recallAfter.recall)}) · ` +
    `${recallAfter.scored} reached scoring`,
);
console.log('\n  still not discovered:');
for (const miss of recallAfter.missed) {
  console.log(`    ${miss.company.padEnd(26)} ${miss.state}${miss.rejectedAt ? ` [${miss.rejectedAt}]` : ''}`);
}
console.log(
  `\n  false discoveries (signal found where the gold set says no opportunity): ${recallAfter.falseDiscoveries.length}`,
);
for (const fd of recallAfter.falseDiscoveries) {
  console.log(`    ${fd.company.padEnd(26)} gold ${fd.label}`);
}

const recovered = recoveredSignals(beforeDiscovery, afterDiscovery);
console.log(`\n  signals recovered that the previous run missed: ${recovered.length}`);
for (const r of recovered) {
  console.log(`    ${r.company.padEnd(26)} was ${r.previousState}, now produces a signal`);
}

/* ---------------------------- cost --------------------------------- */

const costBefore = discoveryCost(beforeDiscovery);
const costAfter = discoveryCost(afterDiscovery);
void metricsBefore.signalsDiscovered;
console.log('\n\nRESEARCH COST');
line('═');
console.log(`  BEFORE  ${costBefore.searchCalls} search calls · ${costBefore.pageRetrievals} page fetches attempted`);
console.log(`  AFTER   ${costAfter.searchCalls} search calls · ${costAfter.pageRetrievals} page fetches attempted`);
console.log(
  `  Ratio   ${(costAfter.searchCalls / Math.max(1, costBefore.searchCalls)).toFixed(1)}x the search volume ` +
    `for ${metricsAfter.changesFound - metricsBefore.changesFound} additional commercial change(s) found.`,
);
console.log('  Credits spent: 0. No paid provider was called.');

/* ------------------------- evaluation ------------------------------ */

const evalBefore = evaluate(orbitalGoldSet, engineOutcomes(before));
const evalAfterUnverified = evaluate(orbitalGoldSet, engineOutcomes(afterUnverified));
const evalAfter = evaluate(orbitalGoldSet, engineOutcomes(after));

reportEvaluation('BEFORE — v4 template queries (reconstructed verification)', evalBefore);
reportEvaluation('AFTER — v5 discovery, page retrieval blocked (the honest state)', evalAfterUnverified);
reportEvaluation('AFTER — v5 discovery (reconstructed verification)', evalAfter);

/* --------------------------- matrix -------------------------------- */

console.log('\n\nTWO-AXIS MATRIX (gold evidence x gold commercial value) — after');
line('═');
console.log('  Rows: evidence quality. Columns: commercial value. * = reported by the engine.\n');
const grades = ['high', 'medium', 'low'] as const;
console.log(`    ${''.padEnd(10)}${grades.map((g) => `value ${g}`.padEnd(22)).join('')}`);
for (const evidence of grades) {
  const cells = grades.map(
    (value) =>
      matrixCell(evalAfter.matrix, evidence, value)
        .map((m) => `${m.company.split(' ')[0]}${m.reported ? '*' : ''}`)
        .join(', ') || '—',
  );
  console.log(`    ev ${evidence.padEnd(7)}${cells.map((c) => c.padEnd(22)).join('')}`);
}

/* -------------------------- reasoning ------------------------------ */

console.log('\n\nCOMMERCIAL REASONING — tested separately from the evidence');
line('═');
const reasoning = after.result.opportunities.map((o) => {
  const signal = after.adapter.signals().find((s) => s.company.domain === o.company.domain)!;
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
  `  ${'company'.padEnd(24)}${'hypothesis'.padEnd(12)}${'angle'.padEnd(12)}${'why now'.padEnd(12)}${'consequence'.padEnd(14)}levels`,
);
for (const r of reasoning) {
  console.log(
    `  ${r.company.padEnd(24)}${r.hypothesis.verdict.padEnd(12)}${r.salesAngle.verdict.padEnd(12)}` +
      `${r.whyNow.verdict.padEnd(12)}${r.consequence.verdict.padEnd(14)}${r.depth.levels}/3`,
  );
}
const genericHits = reasoning.flatMap((r) =>
  [r.hypothesis, r.salesAngle, r.whyNow, r.consequence].flatMap((s) =>
    s.generic.map((g) => `${r.company}: ${g}`),
  ),
);
console.log(
  `\n  Generic-logistics hallucinations: ${genericHits.length} (of ${GENERIC_PATTERNS.length} constructions searched)`,
);
console.log(
  `  Three-level reasoning: ${reasoning.filter((r) => r.depth.levels === 3).length}/${reasoning.length}; ` +
    `${reasoning.filter((r) => r.depth.answersItsOwnQuestion).length} answer their own third-order question.`,
);

/* -------------------------- persistence ---------------------------- */

console.log('\n\nDURABLE RESEARCH STATE');
line('═');
const records = await after.history.load();
console.log(
  `  ${'company'.padEnd(26)}${'state'.padEnd(26)}${'last checked'.padEnd(14)}queries  first-party`,
);
for (const record of records) {
  console.log(
    `  ${record.company.padEnd(26)}${record.state.padEnd(26)}${record.lastCheckedAt.padEnd(14)}` +
      `${String(record.coverage.queriesRun.length).padStart(4)}    ${String(record.coverage.firstPartySourcesFound).padStart(4)}`,
  );
}
console.log(
  `\n  Companies known to the store but absent from this run's target list: ` +
    `${after.adapter.droppedFromUniverse.length}`,
);
for (const record of after.adapter.droppedFromUniverse) {
  console.log(
    `    ${record.company} — last state ${record.state} on ${record.lastCheckedAt}. ` +
      'Still in the universe; this run did not re-check it.',
  );
}
console.log();
