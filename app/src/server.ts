/**
 * The product surface: `node src/server.ts`.
 *
 * `node:http` and nothing else. Every dependency in a product is a thing that
 * can break, a thing to keep current and a thing to explain; the standard
 * library covers routing, forms and HTML for a server that renders eight
 * pages, so nothing is added.
 *
 * The journey:
 *   1. Define the client — who is selling, and what changes create demand.
 *   2. Add a company, as an identity fingerprint rather than a name.
 *   3. Supply evidence: a URL, a headline, and the page text where available.
 *   4. Run the assessment.
 *   5. Read the verdict — or the reason there is no verdict.
 *   6. Open the brief: what changed, why now, how to open the conversation.
 *   7. Check the evidence and the caveats behind it, each one traceable.
 *   8. See what the run did NOT look at, so nothing is mistaken for coverage.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { IdentityFingerprint, IsoDate } from '../../engine/src/domain.ts';
import type { ClientProfile } from '../../engine/src/pipeline.ts';
import { LlmClaimExtractor, LLM_PRESETS } from '../../engine/src/research/llm-extractor.ts';
import { Reasoner } from './reasoner.ts';
import { analyse } from './analyse.ts';
import {
  assessmentPage,
  clientPage,
  clientsPage,
  escape,
  homePage,
  layout,
  opportunityPage,
  progressPage,
  runPage,
  targetPage,
} from './views.ts';
import { runSignal, type RunProgress } from './run.ts';
import {
  AnthropicModelClient,
  BridgeModelClient,
  BridgePageRetriever,
  BridgeSearchClient,
  HttpSearchClient,
  loadCapture,
  SEARCH_PRESETS,
  type ModelClient,
} from './transport.ts';
import { HttpPageRetriever, NullPageRetriever, type PageRetriever } from '../../engine/src/research/retrieval.ts';
import type { SearchClient } from '../../engine/src/research/types.ts';
import {
  addClient,
  addEvidence,
  addTarget,
  defaultStorePath,
  evidenceFor,
  FileStore,
  newId,
  recordAssessment,
  recordRun,
  removeEvidence,
  runsFor,
  type Store,
} from './store.ts';

const MAX_BODY_BYTES = 2_000_000;

async function readBody(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('request body too large');
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function lines(value: string | null): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function today(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

function send(response: ServerResponse, status: number, html: string): void {
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(303, { location });
  response.end();
}

function errorPage(title: string, message: string): string {
  return layout(title, `<h1>${escape(title)}</h1><div class="panel"><p>${escape(message)}</p>
<p><a href="/">Back to clients</a></p></div>`);
}

export interface Models {
  extractor: Pick<LlmClaimExtractor, 'id' | 'extractClaims'>;
  reasoner: Pick<Reasoner, 'reason'>;
}

/**
 * Both model calls come from one credential. Where it is absent, the product
 * still runs and still stores evidence — it simply cannot assess, and says so
 * in those words. A missing key must never be presented as a finding.
 */
export function modelsFromEnv(env: Record<string, string | undefined> = process.env): Models | null {
  const apiKey = env.SIGNAL_LLM_API_KEY ?? env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = env.SIGNAL_LLM_MODEL ?? 'claude-opus-5';
  const preset = LLM_PRESETS.anthropic;
  if (!preset) throw new Error('the anthropic preset is missing from LLM_PRESETS');

  // `SIGNAL_LLM_ENDPOINT` points both calls somewhere else. It exists so the
  // HTTP path itself can be exercised against a local replay server — the one
  // part of the product that a missing credential otherwise leaves untested.
  // It is not a way to point the product at an arbitrary service in anger.
  const endpoint = env.SIGNAL_LLM_ENDPOINT ?? preset.endpoint;

  return {
    extractor: new LlmClaimExtractor({ ...preset, endpoint, model, apiKey }),
    reasoner: new Reasoner({ apiKey, model, endpoint }),
  };
}

/**
 * Everything the research pipeline needs from outside the process.
 *
 * `search` and `retriever` are null when no credential is configured. The
 * application still runs and still keeps history; it refuses to research and
 * says why, because a missing credential must never be presented as a finding
 * about a company.
 */
export interface Research {
  search: SearchClient;
  retriever: PageRetriever;
  model: ModelClient;
  engine: { apiKey: string; model: string; endpoint?: string };
}

export interface AppOptions {
  store: Store;
  models: Models | null;
  research?: Research | null;
  /** Overridable so a test can pin the run date. */
  runDate?: () => IsoDate;
}

/**
 * In-flight runs, so the progress page can show what is happening now.
 *
 * Deliberately in memory: a run lasts minutes and belongs to the process doing
 * it. The finished record goes to the store; the live log does not need to
 * survive a restart, and persisting it would be infrastructure bought for
 * nothing.
 */
interface LiveRun {
  website: string;
  log: RunProgress[];
  finishedRunId?: string;
  error?: string;
}

const liveRuns = new Map<string, LiveRun>();

export function createApp(options: AppOptions) {
  const runDate = options.runDate ?? today;

  return async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const store = options.store;

    try {
      if (request.method === 'GET') {
        const data = await store.read();

        if (path === '/') {
          return send(
            response,
            200,
            homePage(runsFor(data), options.research != null),
          );
        }

        if (path === '/diagnostic') return send(response, 200, clientsPage(data));

        const runMatch = /^\/run\/([\w-]+)$/.exec(path);
        if (runMatch) {
          const id = runMatch[1]!;
          const live = liveRuns.get(id);
          if (live && !live.finishedRunId && !live.error) {
            return send(response, 200, progressPage(id, live.website, live.log));
          }
          if (live?.error) {
            return send(response, 500, errorPage('The run could not be completed', live.error));
          }
          const stored = data.runs.find((run) => run.id === (live?.finishedRunId ?? id));
          if (!stored) return send(response, 404, errorPage('No such search', 'It may have been removed.'));
          return send(response, 200, runPage(stored));
        }

        const opportunityMatch = /^\/run\/([\w-]+)\/opportunity\/(\d+)$/.exec(path);
        if (opportunityMatch) {
          const stored = data.runs.find((run) => run.id === opportunityMatch[1]);
          if (!stored) return send(response, 404, errorPage('No such search', 'It may have been removed.'));
          return send(response, 200, opportunityPage(stored, Number(opportunityMatch[2])));
        }

        const clientMatch = /^\/client\/([\w-]+)$/.exec(path);
        if (clientMatch) {
          const client = data.clients.find((c) => c.id === clientMatch[1]);
          if (!client) return send(response, 404, errorPage('No such client', 'It may have been removed.'));
          return send(response, 200, clientPage(data, client));
        }

        const targetMatch = /^\/target\/([\w-]+)$/.exec(path);
        if (targetMatch) {
          const target = data.targets.find((t) => t.id === targetMatch[1]);
          const client = data.clients.find((c) => c.id === target?.clientId);
          if (!target || !client) {
            return send(response, 404, errorPage('No such company', 'It may have been removed.'));
          }
          return send(response, 200, targetPage(data, client, target, evidenceFor(data, target.id)));
        }

        const assessmentMatch = /^\/assessment\/([\w-]+)$/.exec(path);
        if (assessmentMatch) {
          const record = data.assessments.find((a) => a.id === assessmentMatch[1]);
          if (!record) return send(response, 404, errorPage('No such assessment', 'It may have been removed.'));
          return send(
            response,
            200,
            assessmentPage(record.assessment, `/target/${record.targetId}`),
          );
        }

        return send(response, 404, errorPage('Not found', `Nothing is served at ${path}.`));
      }

      if (request.method === 'POST') {
        const form = await readBody(request);

        if (path === '/runs') {
          const website = (form.get('website') ?? '').trim();
          if (!website) {
            return send(response, 400, errorPage('No website', 'Signal needs a company website to start from.'));
          }
          if (!options.research) {
            return send(
              response,
              503,
              errorPage(
                'Research is not configured',
                'Signal needs a model credential and a search credential to research. Neither the ' +
                  'application nor this message says anything about any company — no research has been done.',
              ),
            );
          }

          // The run outlives the request. The browser gets a progress page
          // immediately and polls it; nothing is faked while it waits.
          const id = newId('live');
          const live: LiveRun = { website, log: [] };
          liveRuns.set(id, live);

          const research = options.research;
          void (async () => {
            try {
              const record = await runSignal({
                website,
                runDate: runDate(),
                search: research.search,
                retriever: research.retriever,
                model: research.model,
                engine: research.engine,
                queryBudget: Number(form.get('budget') ?? 12) || 12,
                ...(form.get('constraints')?.trim() ? { constraints: form.get('constraints')!.trim() } : {}),
                onProgress: (progress) => live.log.push(progress),
              });
              const stored = await recordRun(store, website, record.runDate, record);
              live.finishedRunId = stored.id;
            } catch (error) {
              live.error = error instanceof Error ? error.message : String(error);
            }
          })();

          return redirect(response, `/run/${id}`);
        }

        if (path === '/clients') {
          const profile: ClientProfile = {
            name: (form.get('name') ?? '').trim(),
            domain: (form.get('domain') ?? '').trim(),
            offerings: lines(form.get('offerings')),
            demandTriggers: lines(form.get('demandTriggers')),
            buyerFunctions: lines(form.get('buyerFunctions')),
            disqualifiers: lines(form.get('disqualifiers')),
          };
          if (!profile.name || !profile.domain || profile.offerings.length === 0) {
            return send(
              response,
              400,
              errorPage('Incomplete client', 'A client needs a name, a domain and at least one offering — the offering is what makes a change into a signal.'),
            );
          }
          const client = await addClient(store, profile);
          return redirect(response, `/client/${client.id}`);
        }

        if (path === '/targets') {
          const clientId = (form.get('clientId') ?? '').trim();
          const geography = {
            ...(form.get('country')?.trim() ? { country: form.get('country')!.trim() } : {}),
            ...(form.get('region')?.trim() ? { region: form.get('region')!.trim() } : {}),
            ...(form.get('town')?.trim() ? { town: form.get('town')!.trim() } : {}),
          };
          const fingerprint: IdentityFingerprint = {
            canonicalName: (form.get('canonicalName') ?? '').trim(),
            canonicalDomain: (form.get('canonicalDomain') ?? '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
            ...(Object.keys(geography).length > 0 ? { geography } : {}),
            ...(form.get('industry')?.trim() ? { industry: form.get('industry')!.trim() } : {}),
            ...(lines(form.get('descriptors')).length > 0
              ? { descriptors: lines(form.get('descriptors')) }
              : {}),
            ...(form.get('companyNumber')?.trim()
              ? { companyNumber: form.get('companyNumber')!.trim() }
              : {}),
          };
          if (!fingerprint.canonicalName || !fingerprint.canonicalDomain) {
            return send(
              response,
              400,
              errorPage('Incomplete company', 'A company needs a name and a domain. The domain is the identity key — a name alone collides with same-named businesses, and a source about the wrong company is the failure that matters most.'),
            );
          }
          const target = await addTarget(store, clientId, fingerprint);
          return redirect(response, `/target/${target.id}`);
        }

        if (path === '/evidence') {
          const targetId = (form.get('targetId') ?? '').trim();
          const publishedAt = (form.get('publishedAt') ?? '').trim();
          await addEvidence(store, targetId, {
            url: (form.get('url') ?? '').trim(),
            title: (form.get('title') ?? '').trim(),
            text: form.get('text') ?? '',
            ...(form.get('snippet')?.trim() ? { snippet: form.get('snippet')!.trim() } : {}),
            ...(publishedAt ? { publishedAt } : {}),
            providedBy: (form.get('providedBy') ?? '').trim() || 'unnamed',
            providedAt: runDate(),
          });
          return redirect(response, `/target/${targetId}`);
        }

        const deleteMatch = /^\/evidence\/([\w-]+)\/delete$/.exec(path);
        if (deleteMatch) {
          const data = await store.read();
          const item = data.evidence.find((e) => e.id === deleteMatch[1]);
          await removeEvidence(store, deleteMatch[1]!);
          return redirect(response, item ? `/target/${item.targetId}` : '/');
        }

        if (path === '/assess') {
          const targetId = (form.get('targetId') ?? '').trim();
          const data = await store.read();
          const target = data.targets.find((t) => t.id === targetId);
          const client = data.clients.find((c) => c.id === target?.clientId);
          if (!target || !client) {
            return send(response, 404, errorPage('No such company', 'It may have been removed.'));
          }

          if (!options.models) {
            return send(
              response,
              503,
              errorPage(
                'No model credential',
                'Assessment needs a model to read the sources and to reason about them. Set SIGNAL_LLM_API_KEY (or ANTHROPIC_API_KEY) and restart. Nothing has been assessed, and no verdict about this company should be inferred from this.',
              ),
            );
          }

          const assessment = await analyse({
            client: client.profile,
            target: target.fingerprint,
            evidence: evidenceFor(data, target.id),
            runDate: runDate(),
            extractor: options.models.extractor,
            reasoner: options.models.reasoner,
          });

          const record = await recordAssessment(store, {
            clientId: client.id,
            targetId: target.id,
            runDate: assessment.runDate,
            assessment,
          });
          return redirect(response, `/assessment/${record.id}`);
        }

        return send(response, 404, errorPage('Not found', `Nothing accepts a POST at ${path}.`));
      }

      response.writeHead(405, { allow: 'GET, POST' });
      response.end();
    } catch (error) {
      send(
        response,
        500,
        errorPage('Something went wrong', error instanceof Error ? error.message : String(error)),
      );
    }
  };
}

export function startServer(port: number, options: AppOptions) {
  const handle = createApp(options);
  const server = createServer((request, response) => {
    void handle(request, response);
  });
  server.listen(port);
  return server;
}

/**
 * Wire up research from the environment.
 *
 * One search provider, one page fetcher, one model. Not a provider zoo: five
 * theoretical providers are a way of avoiding the question of which one works.
 *
 * Three ways this resolves, and the product says which one it is on:
 *
 *   LIVE      SIGNAL_LLM_API_KEY + SIGNAL_SEARCH_API_KEY are set. Real search,
 *             real page fetching, real model calls.
 *   BRIDGE    SIGNAL_CAPTURE points at a capture file. Searches, pages and
 *             model responses recorded elsewhere are replayed. Used where the
 *             process itself has no egress; an uncaptured query is an error,
 *             never an empty result.
 *   NONE      Neither. The app runs, keeps history and refuses to research.
 */
export function researchFromEnv(env: Record<string, string | undefined> = process.env): Research | null {
  const capturePath = env.SIGNAL_CAPTURE;
  const apiKey = env.SIGNAL_LLM_API_KEY ?? env.ANTHROPIC_API_KEY;
  const model = env.SIGNAL_LLM_MODEL ?? 'claude-opus-5';

  if (capturePath) {
    const capture = loadCapture(capturePath);
    return {
      search: new BridgeSearchClient(capture),
      retriever: new BridgePageRetriever(capture),
      model: new BridgeModelClient(capture),
      // The engine-side calls go through the same bridge when replaying.
      engine: { apiKey: apiKey ?? 'bridge', model, ...(env.SIGNAL_LLM_ENDPOINT ? { endpoint: env.SIGNAL_LLM_ENDPOINT } : {}) },
    };
  }

  const searchKey = env.SIGNAL_SEARCH_API_KEY;
  const preset = SEARCH_PRESETS[env.SIGNAL_SEARCH_PROVIDER ?? 'brave'];
  if (!apiKey || !searchKey || !preset) return null;

  return {
    search: new HttpSearchClient({ ...preset, apiKey: searchKey }),
    retriever: new HttpPageRetriever({ userAgent: 'SignalResearchBot/0.2' }),
    model: new AnthropicModelClient({
      apiKey,
      model,
      ...(env.SIGNAL_LLM_ENDPOINT ? { endpoint: env.SIGNAL_LLM_ENDPOINT } : {}),
    }),
    engine: { apiKey, model, ...(env.SIGNAL_LLM_ENDPOINT ? { endpoint: env.SIGNAL_LLM_ENDPOINT } : {}) },
  };
}

if (import.meta.filename === process.argv[1]) {
  const port = Number(process.env.PORT ?? 3000);
  const storePath = defaultStorePath();
  const models = modelsFromEnv();
  const research = researchFromEnv();

  startServer(port, { store: new FileStore(storePath), models, research });

  console.log(`Signal listening on http://localhost:${port}`);
  console.log(`Store: ${storePath}`);

  if (research) {
    console.log(
      process.env.SIGNAL_CAPTURE
        ? `Research: BRIDGE — replaying ${process.env.SIGNAL_CAPTURE}. No live search or fetching.`
        : `Research: LIVE — ${research.search.id} search, ${research.model.id}.`,
    );
  } else {
    console.log(
      'Research: NOT CONFIGURED. Signal needs SIGNAL_LLM_API_KEY and SIGNAL_SEARCH_API_KEY\n' +
        '  (or SIGNAL_CAPTURE for a replayed run). It will refuse to research rather than guess.\n' +
        '  History and the manual diagnostic harness at /diagnostic still work.',
    );
  }
}
