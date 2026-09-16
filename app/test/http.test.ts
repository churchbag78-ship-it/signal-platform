/**
 * The HTTP boundary.
 *
 * Everything else in this suite injects the models directly, which leaves the
 * one thing a missing credential would otherwise leave completely untested:
 * whether the product can actually talk to a model over HTTP — the request it
 * builds, the headers it sends, the response shape it expects.
 *
 * This runs the real server against a local stand-in that replays the recorded
 * real model responses. What it proves: the request/response contract holds
 * over a socket, and the product works end to end through it. What it does not
 * prove: that api.anthropic.com accepts that request, which cannot be tested
 * without a credential (there is none here; the API answers with 401).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { modelsFromEnv, startServer } from '../src/server.ts';
import { MemoryStore } from '../src/store.ts';
import { realExtractionCases } from '../../engine/fixtures/real-model-extractions.ts';
import { realReasoningCases } from '../fixtures/real-reasoning.ts';

const extraction = realExtractionCases.find((c) => c.id === 'maeving-ukef')!.modelResponse;
const reasoning = realReasoningCases.find((c) => c.id === 'maeving-ukef')!.response;

interface Call {
  path: string;
  authHeader: string | undefined;
  version: string | undefined;
  model: string;
  system: string;
}

function replayServer(calls: Call[]): Server {
  return createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const payload = JSON.parse(body) as { system: string; model: string };
      calls.push({
        path: request.url ?? '',
        authHeader: request.headers['x-api-key'] as string | undefined,
        version: request.headers['anthropic-version'] as string | undefined,
        model: payload.model,
        system: payload.system,
      });
      // The two calls are told apart the way a real provider never would:
      // by which contract they were given. That is the point — they are two
      // different jobs with two different prompts.
      const isReasoning = payload.system.includes('commercial assessment');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ content: [{ text: isReasoning ? reasoning : extraction }] }));
    });
  });
}

test('both model calls go over real HTTP, and the product works through them', async () => {
  const calls: Call[] = [];
  const provider = replayServer(calls);
  provider.listen(0);
  await once(provider, 'listening');
  const providerPort = (provider.address() as AddressInfo).port;

  const models = modelsFromEnv({
    SIGNAL_LLM_API_KEY: 'replayed-credential',
    SIGNAL_LLM_MODEL: 'recorded',
    SIGNAL_LLM_ENDPOINT: `http://127.0.0.1:${providerPort}/v1/messages`,
  });
  assert.ok(models);

  const app = startServer(0, { store: new MemoryStore(), models, runDate: () => '2026-09-09' });
  await once(app, 'listening');
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;

  const post = (path: string, fields: Record<string, string>) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
      redirect: 'manual',
    });

  try {
    const client = await post('/clients', {
      name: 'Orbital Direct Ltd',
      domain: 'orbitaldirect.co.uk',
      offerings: 'freight forwarding (air, road, sea)\ncustoms clearance and documentation',
      demandTriggers: 'export growth or new overseas market entry',
      buyerFunctions: 'Operations',
      disqualifiers: 'third-party logistics providers and freight forwarders',
    });
    const clientId = client.headers.get('location')!.split('/').at(-1)!;

    const target = await post('/targets', {
      clientId,
      canonicalName: 'Maeving Ltd',
      canonicalDomain: 'maeving.com',
      town: 'Coventry',
      country: 'United Kingdom',
      industry: 'Electric motorcycle manufacturing',
      descriptors: 'electric motorcycles',
    });
    const targetId = target.headers.get('location')!.split('/').at(-1)!;

    await post('/evidence', {
      targetId,
      url: 'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
      title: 'Maeving gears up exports with UKEF backing',
      text:
        'Coventry-based Maeving secured a £3m trade finance facility backed by UK Export Finance ' +
        'to meet growing demand in the US, Germany and France, creating 13 new jobs.',
      providedBy: 'alex@orbitaldirect.co.uk',
    });

    const assessed = await post('/assess', { targetId });
    assert.equal(assessed.status, 303);
    const brief = await (await fetch(base + assessed.headers.get('location')!)).text();

    // Two calls, in order, each carrying the credential and the API version.
    assert.equal(calls.length, 2);
    assert.equal(calls.every((c) => c.authHeader === 'replayed-credential'), true);
    assert.equal(calls.every((c) => c.version === '2023-06-01'), true);
    assert.equal(calls.every((c) => c.model === 'recorded'), true);
    assert.match(calls[0]!.system, /extract structured commercial evidence|claims/i);
    assert.match(calls[1]!.system, /commercial assessment/);
    // The reasoning call is given facts, never the raw search results.
    assert.match(calls[1]!.system, /You are given FACTS ONLY/);

    // And the product came out the other side with a usable brief.
    assert.match(brief, /Maeving secured a £3m trade finance facility/);
    assert.match(brief, /Settle it by asking/);
    assert.match(brief, /page retrieved/);

    // The engine still refused to take the model's growth label on trust.
    assert.match(brief, /model said demand increasing/);
  } finally {
    app.close();
    provider.close();
    await Promise.all([once(app, 'close'), once(provider, 'close')]);
  }
});
