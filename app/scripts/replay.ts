/**
 * Replay a captured run through the real pipeline.
 *
 * Every stage of the product runs here for real. Only the transport is
 * replayed, because this environment's egress proxy refuses CONNECT for every
 * host and carries no model credential. The capture file states, at its top,
 * which of its contents are genuine and which are not — read that before
 * drawing a conclusion from the output.
 *
 *   node scripts/replay.ts captures/<file>.json <website>
 */

import { runSignal } from '../src/run.ts';
import {
  BridgeModelClient,
  BridgePageRetriever,
  BridgeSearchClient,
  loadCapture,
} from '../src/transport.ts';

const [, , capturePath, website] = process.argv;
if (!capturePath || !website) {
  console.error('usage: node scripts/replay.ts <capture.json> <website>');
  process.exit(1);
}

const capture = loadCapture(capturePath);

console.log('SIGNAL — replayed run');
console.log(`capture: ${capturePath}`);
console.log(`transport: ${capture.transport}\n`);

const record = await runSignal({
  website: website!,
  runDate: capture.capturedAt,
  search: new BridgeSearchClient(capture),
  retriever: new BridgePageRetriever(capture),
  model: new BridgeModelClient(capture),
  engine: { apiKey: 'bridge', model: 'bridge' },
  queryBudget: 6,
  onProgress: (progress) =>
    console.log(
      `  [${progress.stage}] ${progress.message}` +
        (progress.total ? ` (${progress.done ?? 0}/${progress.total})` : ''),
    ),
});

console.log('\n--- RESULT ---');
if (record.failure) {
  console.log(`STOPPED at ${record.failure.stage}: ${record.failure.reason}`);
}

if (record.model) {
  console.log(`\nCOMMERCIAL MODEL: ${record.model.name}`);
  console.log(`  offerings: ${record.model.offerings.map((o) => o.name).join(' | ')}`);
  console.log(`  cannot serve: ${record.model.cannotServe.join(' | ')}`);
  console.log(
    `  unsupported by the site: ${
      record.model.grounding.findings.length === 0
        ? 'none'
        : record.model.grounding.findings.map((f) => f.specific).join(', ')
    }`,
  );
}

if (record.triggers) {
  console.log(`\nDEMAND TRIGGERS (${record.triggers.triggers.length} kept):`);
  for (const trigger of record.triggers.triggers) {
    console.log(`  [${trigger.strength}] ${trigger.event}`);
    console.log(`      → ${trigger.offering}`);
  }
  for (const rejected of record.triggers.rejected) {
    console.log(`  [discarded by the model] ${rejected.event} — ${rejected.why}`);
  }
  for (const discarded of record.triggers.discarded) {
    console.log(`  [discarded by the engine] ${discarded.event} — ${discarded.reason}`);
  }
}

console.log(`\nSEARCHES: ${record.searches.filter((s) => !s.error).length} run`);
for (const search of record.searches) {
  console.log(`  ${search.error ? 'FAILED' : `${search.resultCount} results`}: ${search.query}`);
}

console.log(`\nCANDIDATES: ${record.candidatesFound}`);
console.log(
  `IDENTITY: ${record.resolutions.resolved} resolved, ${record.resolutions.ambiguous} ambiguous, ${record.resolutions.unresolvable} unresolvable`,
);
for (const entry of record.unresolved) {
  console.log(`  [${entry.status}] ${entry.companyName} — ${entry.explanation}`);
}

console.log(`\nOPPORTUNITIES: ${record.opportunities.length}`);
for (const opportunity of record.opportunities) {
  if (opportunity.assessment.status !== 'opportunity') continue;
  console.log(`  ${opportunity.assessment.company.name}: ${opportunity.assessment.signal.whatChanged}`);
  console.log(`      because: ${opportunity.trigger.mechanism}`);
}

console.log(`\nREJECTED: ${record.rejected.length}`);
for (const rejection of record.rejected) {
  console.log(`  [${rejection.stage}] ${rejection.companyName} — ${rejection.reason}`);
}
