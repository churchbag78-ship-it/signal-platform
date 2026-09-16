import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addClient,
  addEvidence,
  addTarget,
  evidenceFor,
  FileStore,
  latestAssessment,
  MemoryStore,
  newId,
  recordAssessment,
  removeEvidence,
  targetsFor,
} from '../src/store.ts';
import { acme, evidence, orbitalDirect, RUN_DATE } from './helpers.ts';
import type { Assessment } from '../src/analyse.ts';

async function tempPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'signal-store-'));
  return join(dir, 'nested', 'signal.json');
}

test('a missing store reads as empty and a written one survives a reopen', async () => {
  const path = await tempPath();
  const store = new FileStore(path);
  assert.deepEqual((await store.read()).clients, []);

  const client = await addClient(store, orbitalDirect);
  const target = await addTarget(store, client.id, acme);
  await addEvidence(store, target.id, evidence());

  const reopened = new FileStore(path);
  const data = await reopened.read();
  assert.equal(data.clients.length, 1);
  assert.equal(targetsFor(data, client.id).length, 1);
  assert.equal(evidenceFor(data, target.id).length, 1);
});

test('a corrupt store fails loudly rather than starting fresh over the top of it', async () => {
  const path = await tempPath();
  await new FileStore(path).write({ version: 1, clients: [], targets: [], evidence: [], assessments: [] });
  await writeFile(path, '{ not json', 'utf8');
  await assert.rejects(() => new FileStore(path).read(), /could not read the store/);
});

test('the file on disk is readable JSON, so a person can inspect it', async () => {
  const path = await tempPath();
  const store = new FileStore(path);
  await addClient(store, orbitalDirect);
  const raw = await readFile(path, 'utf8');
  assert.equal(JSON.parse(raw).clients[0].profile.name, 'Orbital Direct');
  assert.match(raw, /\n$/);
});

test('evidence cannot be attached to a company that does not exist', async () => {
  const store = new MemoryStore();
  await assert.rejects(() => addEvidence(store, 'tgt_nope', evidence()), /no target/);
});

test('a company cannot be attached to a client that does not exist', async () => {
  const store = new MemoryStore();
  await assert.rejects(() => addTarget(store, 'cli_nope', acme), /no client/);
});

test('evidence can be withdrawn', async () => {
  const store = new MemoryStore();
  const client = await addClient(store, orbitalDirect);
  const target = await addTarget(store, client.id, acme);
  const item = await addEvidence(store, target.id, evidence());
  await removeEvidence(store, item.id);
  assert.equal(evidenceFor(await store.read(), target.id).length, 0);
});

test('assessments accumulate, because an earlier verdict is the record of what was known then', async () => {
  const store = new MemoryStore();
  const client = await addClient(store, orbitalDirect);
  const target = await addTarget(store, client.id, acme);

  const make = (reason: string): Assessment => ({
    status: 'rejected',
    company: { name: acme.canonicalName, domain: acme.canonicalDomain },
    runDate: RUN_DATE,
    stage: 'insufficient_evidence',
    reason,
    trace: null,
    coverage: null,
    evidenceSupplied: { items: 0, withBody: 0, firstParty: 0, urls: [] },
  });

  await recordAssessment(store, { clientId: client.id, targetId: target.id, runDate: RUN_DATE, assessment: make('first') });
  await recordAssessment(store, { clientId: client.id, targetId: target.id, runDate: RUN_DATE, assessment: make('second') });

  const data = await store.read();
  assert.equal(data.assessments.length, 2);
  const last = latestAssessment(data, target.id);
  assert.equal(last?.assessment.status === 'rejected' && last.assessment.reason, 'second');
});

test('ids are unique across a burst', () => {
  const ids = new Set(Array.from({ length: 500 }, () => newId('x')));
  assert.equal(ids.size, 500);
});
