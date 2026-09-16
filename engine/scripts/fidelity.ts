/**
 * Runs the recorded REAL model extractions through LlmClaimExtractor and
 * scores them for fidelity.
 *
 *   node scripts/fidelity.ts
 */

import { LlmClaimExtractor, LLM_PRESETS } from '../src/research/llm-extractor.ts';
import { measureFidelity, summariseFidelity } from '../src/research/extraction-fidelity.ts';
import type { FidelityReport } from '../src/research/extraction-fidelity.ts';
import { realExtractionCases, recordedTransport } from '../fixtures/real-model-extractions.ts';
import { orbitalDirect } from '../fixtures/pilot-a.ts';

const RUN_DATE = '2026-09-09';
const line = (c = '─') => console.log(c.repeat(78));

console.log('\nCLAIMEXTRACTOR FIDELITY — real model responses, recorded transport');
line('═');

const reports: FidelityReport[] = [];

for (const testCase of realExtractionCases) {
  const extractor = new LlmClaimExtractor(
    { ...LLM_PRESETS.anthropic!, model: 'recorded', apiKey: 'recorded' },
    recordedTransport(testCase.modelResponse),
  );

  const result = await extractor.extractClaims({
    company: { name: testCase.target, domain: testCase.targetDomain },
    client: orbitalDirect,
    results: testCase.results,
    runDate: RUN_DATE,
  });

  const report = measureFidelity(
    testCase.id,
    result.claims,
    result.polarity,
    result.polarityRationale,
    testCase.gold,
    testCase.results.map((r) => `${r.title} ${r.snippet}`),
  );
  reports.push(report);

  console.log(`\n${testCase.id} — ${testCase.target}`);
  line();
  console.log(`  claims returned: ${result.claims.length}  discarded by schema: ${result.discarded}`);
  console.log(`  polarity: ${result.polarity} — ${result.polarityRationale}`);
  console.log(`  verdict: ${report.passed ? 'PASS' : `${report.findings.length} finding(s)`}`);

  for (const finding of report.findings) {
    console.log(`    ! [${finding.category}]${finding.claimId ? ` ${finding.claimId}:` : ''} ${finding.detail}`);
  }
  if (testCase.gold.notes) console.log(`  note: ${testCase.gold.notes}`);
}

const summary = summariseFidelity(reports);

console.log('\n\nSUMMARY');
line('═');
console.log(`  cases: ${summary.cases}  passed: ${summary.passed}  claims: ${summary.totalClaims}`);
console.log(`  findings: ${summary.totalFindings}`);
for (const [category, count] of Object.entries(summary.byCategory)) {
  console.log(`    ${String(count).padStart(2)} × ${category}`);
}
if (summary.totalFindings === 0) console.log('    none');
console.log();
