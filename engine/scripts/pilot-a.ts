/**
 * Runs Pilot A end to end and prints the report.
 *
 *   node scripts/pilot-a.ts
 *
 * Demonstrates: company → verified change → commercial implication →
 * client relevance → opportunity score → recommended sales action, plus every
 * rejection and why.
 */

import {
  orbitalDirect,
  pilotAExtractions,
  pilotASearchCorpus,
  pilotATargets,
} from '../fixtures/pilot-a.ts';
import { CorpusClaimExtractor, StaticSearchClient } from '../src/research/corpus.ts';
import { WebResearchAdapter } from '../src/research/adapter.ts';
import { runPipeline } from '../src/pipeline.ts';
import { supportingFacts } from '../src/claims.ts';
import { CostLedger } from '../src/providers/registry.ts';
import { NullContactProvider, enrichContacts } from '../src/providers/contacts.ts';

const RUN_DATE = '2026-09-08';
/** Only genuinely promising rows are worth a salesperson's time. */
const REPORTABLE_FLOOR = 60;

const adapter = new WebResearchAdapter({
  // Replays a capture taken before change-family discovery existed.
  queryStrategy: 'template',
  search: new StaticSearchClient(pilotASearchCorpus),
  extractor: new CorpusClaimExtractor(pilotAExtractions),
  targets: pilotATargets,
  runDate: RUN_DATE,
});

const result = await runPipeline(adapter, {
  client: orbitalDirect,
  runDate: RUN_DATE,
  ledger: [],
  limit: 50,
  reportableFloor: REPORTABLE_FLOOR,
});

const line = (char = '─') => console.log(char.repeat(78));

console.log('\nSIGNAL COMMERCIAL INTELLIGENCE REPORT');
line('═');
console.log(`CLIENT:            ${orbitalDirect.name}`);
console.log(`DATE:              ${RUN_DATE}`);
console.log(`COMPANIES SEARCHED: ${pilotATargets.length}`);
console.log(`NUMBER REQUESTED:  50 (reportable floor ${REPORTABLE_FLOOR})`);
console.log(`NUMBER RETURNED:   ${result.opportunities.length}`);

console.log('\nFUNNEL');
line();
for (const [stage, count] of Object.entries(result.funnel)) {
  console.log(`  ${stage.padEnd(12)} ${count}`);
}

console.log('\nOPPORTUNITIES');
line('═');

for (const [index, opportunity] of result.opportunities.entries()) {
  const signal = adapter
    .signals()
    .find((s) => s.company.domain === opportunity.company.domain)!;

  console.log(`\n${index + 1}. ${opportunity.company.name} — ${opportunity.score.total}/100`);
  console.log(`   ${opportunity.score.classification} · confidence ${opportunity.score.confidence}`);
  line();
  console.log(`   TRIGGER        ${signal.trigger}`);
  console.log(`   WHAT CHANGED   ${signal.whatChanged}`);
  console.log(`   EVENT DATE     ${signal.eventDate ?? 'not established'}`);
  console.log(`   DISCOVERED     ${signal.discoveredAt}`);
  console.log(`   FRESHNESS      ${signal.freshness.ageDays} days — ${signal.freshness.reason}`);
  console.log(`   ICP RELEVANCE  ${signal.icpRelevance.rationale}`);
  console.log(`   OWNING ROLE    ${signal.owningFunction.function}`);
  console.log(`                  ${signal.owningFunction.rationale}`);

  console.log('\n   FACTS');
  for (const fact of supportingFacts(signal.hypothesis.id, signal.claims)) {
    console.log(`     • ${fact.statement}`);
    console.log(
      `       ${fact.source.url}`,
    );
    console.log(
      `       tier ${fact.source.tier} · ${fact.eventDate ?? 'undated'} · ${fact.verification}`,
    );
  }

  const inferences = signal.claims.filter((c) => c.kind === 'inference');
  if (inferences.length > 0) {
    console.log('\n   INFERENCES');
    for (const inf of inferences) {
      console.log(`     → ${inf.statement}`);
      console.log(`       because: ${inf.reasoning}`);
    }
  }

  console.log('\n   COMMERCIAL HYPOTHESIS');
  console.log(`     ? ${signal.hypothesis.statement}`);
  console.log(`       test: ${signal.hypothesis.testableBy}`);

  if (signal.contradictions.length > 0) {
    console.log('\n   CONTRADICTIONS');
    for (const c of signal.contradictions) {
      console.log(`     ! [${c.severity}] ${c.note}`);
    }
  }

  console.log(`\n   WHY NOW        ${opportunity.whyNow}`);
  console.log(`   SALES ANGLE    ${opportunity.salesAngle}`);
  console.log(`   ACTION         ${opportunity.recommendedAction.action}`);
  console.log(`                  ${opportunity.recommendedAction.rationale}`);
  console.log('\n   SCORE');
  for (const item of opportunity.score.explanation) {
    console.log(`     ${item}`);
  }
}

console.log('\n\nREJECTED — researched and not reported');
line('═');

for (const rejection of adapter.rejections()) {
  console.log(`\n  ${rejection.company.name} [${rejection.stage}]`);
  console.log(`    ${rejection.reason}`);
  if (rejection.errors) {
    for (const error of rejection.errors) console.log(`    - ${error}`);
  }
}

for (const drop of result.dropped) {
  console.log(`\n  ${drop.company.name} [${drop.stage}]`);
  console.log(`    ${drop.reason}`);
}

// Contact enrichment: attempted only for rows that earned it, and with no
// provider configured it changes nothing about the report above.
const ledger = new CostLedger();
const enrichment = await enrichContacts(
  result.opportunities.map((o) => ({
    company: o.company,
    role: o.decisionMakerRole,
    score: o.score.total,
  })),
  new NullContactProvider(),
  { minScore: 75, creditBudget: 0, approvedForSpend: false },
  ledger,
);

console.log('\n\nCONTACT ENRICHMENT');
line('═');
console.log(`  provider: none configured · credits spent: ${ledger.totalCredits()}`);
for (const outcome of enrichment) {
  console.log(`  ${outcome.company.name}: ${outcome.result.status} — ${outcome.reason}`);
}
console.log(
  '\n  Every opportunity above stands without contact data. The owning function\n' +
    '  is identified by reasoning; the person is a later, optional layer.\n',
);
