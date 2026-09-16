/**
 * Persistence.
 *
 * A single JSON file, written atomically (temp file, then rename), read whole.
 * There is no database because there is no problem a database would solve here:
 * one user, tens of companies, no concurrent writers. A Postgres dependency at
 * this stage would buy nothing and cost the ability to run the product by
 * cloning the repository and typing `node src/server.ts`.
 *
 * When that stops being true — more than one user, or concurrent runs — this
 * is the file to replace, and the `Store` interface is the seam to replace it
 * at. That is not today.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { IdentityFingerprint, IsoDate } from '../../engine/src/domain.ts';
import type { ClientProfile } from '../../engine/src/pipeline.ts';
import type { ProvidedEvidence } from './providers.ts';
import type { Assessment } from './analyse.ts';

export interface StoredClient {
  id: string;
  profile: ClientProfile;
  createdAt: string;
}

export interface StoredTarget {
  id: string;
  clientId: string;
  fingerprint: IdentityFingerprint;
  createdAt: string;
}

export interface StoredEvidence extends ProvidedEvidence {
  id: string;
  targetId: string;
}

export interface StoredAssessment {
  id: string;
  clientId: string;
  targetId: string;
  runDate: IsoDate;
  createdAt: string;
  assessment: Assessment;
}

export interface StoreData {
  version: 1;
  clients: StoredClient[];
  targets: StoredTarget[];
  evidence: StoredEvidence[];
  assessments: StoredAssessment[];
}

export function emptyStore(): StoreData {
  return { version: 1, clients: [], targets: [], evidence: [], assessments: [] };
}

export interface Store {
  read(): Promise<StoreData>;
  write(data: StoreData): Promise<void>;
}

let counter = 0;

/** Short, sortable, collision-resistant enough for a single-writer file. */
export function newId(prefix: string): string {
  counter += 1;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff).toString(36).padStart(4, '0');
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}

export class FileStore implements Store {
  readonly path: string;
  #cache: StoreData | null = null;

  constructor(path: string) {
    this.path = path;
  }

  async read(): Promise<StoreData> {
    if (this.#cache) return this.#cache;
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      // Tolerate a file written by an earlier shape, but never invent records.
      this.#cache = {
        version: 1,
        clients: parsed.clients ?? [],
        targets: parsed.targets ?? [],
        evidence: parsed.evidence ?? [],
        assessments: parsed.assessments ?? [],
      };
      return this.#cache;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        this.#cache = emptyStore();
        return this.#cache;
      }
      // A corrupt store is not an empty store. Starting fresh here would
      // silently destroy a user's work, so it fails instead.
      throw new Error(
        `could not read the store at ${this.path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async write(data: StoreData): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(temp, this.path);
    this.#cache = data;
  }
}

/** For tests, and for a run that should leave nothing behind. */
export class MemoryStore implements Store {
  #data: StoreData = emptyStore();

  async read(): Promise<StoreData> {
    return this.#data;
  }

  async write(data: StoreData): Promise<void> {
    this.#data = data;
  }
}

export function defaultStorePath(env: Record<string, string | undefined> = process.env): string {
  return env.SIGNAL_STORE ?? join(process.cwd(), 'data', 'signal.json');
}

// --- operations ------------------------------------------------------------
// Deterministic application behaviour, so none of it involves a model.

export async function addClient(store: Store, profile: ClientProfile): Promise<StoredClient> {
  const data = await store.read();
  const client: StoredClient = {
    id: newId('cli'),
    profile,
    createdAt: new Date().toISOString(),
  };
  await store.write({ ...data, clients: [...data.clients, client] });
  return client;
}

export async function addTarget(
  store: Store,
  clientId: string,
  fingerprint: IdentityFingerprint,
): Promise<StoredTarget> {
  const data = await store.read();
  if (!data.clients.some((c) => c.id === clientId)) {
    throw new Error(`no client ${clientId}`);
  }
  const target: StoredTarget = {
    id: newId('tgt'),
    clientId,
    fingerprint,
    createdAt: new Date().toISOString(),
  };
  await store.write({ ...data, targets: [...data.targets, target] });
  return target;
}

export async function addEvidence(
  store: Store,
  targetId: string,
  evidence: ProvidedEvidence,
): Promise<StoredEvidence> {
  const data = await store.read();
  if (!data.targets.some((t) => t.id === targetId)) {
    throw new Error(`no target ${targetId}`);
  }
  const stored: StoredEvidence = { ...evidence, id: newId('ev'), targetId };
  await store.write({ ...data, evidence: [...data.evidence, stored] });
  return stored;
}

export async function removeEvidence(store: Store, evidenceId: string): Promise<void> {
  const data = await store.read();
  await store.write({ ...data, evidence: data.evidence.filter((e) => e.id !== evidenceId) });
}

export async function recordAssessment(
  store: Store,
  record: Omit<StoredAssessment, 'id' | 'createdAt'>,
): Promise<StoredAssessment> {
  const data = await store.read();
  const stored: StoredAssessment = {
    ...record,
    id: newId('asm'),
    createdAt: new Date().toISOString(),
  };
  // Assessments accumulate. An earlier verdict on the same company is the
  // record of what the system said when it had less evidence, and overwriting
  // it would erase the only evidence of whether the system is improving.
  await store.write({ ...data, assessments: [...data.assessments, stored] });
  return stored;
}

export function evidenceFor(data: StoreData, targetId: string): StoredEvidence[] {
  return data.evidence.filter((e) => e.targetId === targetId);
}

export function targetsFor(data: StoreData, clientId: string): StoredTarget[] {
  return data.targets.filter((t) => t.clientId === clientId);
}

export function latestAssessment(
  data: StoreData,
  targetId: string,
): StoredAssessment | undefined {
  return data.assessments.filter((a) => a.targetId === targetId).at(-1);
}
