import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { modelsFromEnv, startServer, type Models } from '../src/server.ts';
import { MemoryStore } from '../src/store.ts';
import { PAGE_BODY, RUN_DATE, stubExtractor, stubReasoner } from './helpers.ts';

async function withServer(
  models: Models | null,
  run: (base: string) => Promise<void>,
): Promise<void> {
  const server = startServer(0, { store: new MemoryStore(), models, runDate: () => RUN_DATE });
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function form(fields: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  };
}

const stubModels = (): Models => ({ extractor: stubExtractor(), reasoner: stubReasoner() });

test('the eight-step journey works over HTTP, from empty to a readable brief', async () => {
  await withServer(stubModels(), async (base) => {
    // 1. Nothing yet.
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /No client yet/);

    // 2. Define the client.
    const created = await fetch(
      `${base}/clients`,
      form({
        name: 'Orbital Direct',
        domain: 'orbitaldirect.co.uk',
        offerings: 'pallet storage\nexport haulage',
        demandTriggers: 'new overseas market entry\nexport finance',
        buyerFunctions: 'Operations',
        disqualifiers: 'companies that run their own fleet',
      }),
    );
    assert.equal(created.status, 303);
    const clientPath = created.headers.get('location')!;
    const clientId = clientPath.split('/').at(-1)!;

    // 3. Add the company as a fingerprint.
    const target = await fetch(
      `${base}/targets`,
      form({
        clientId,
        canonicalName: 'Acme Components Ltd',
        canonicalDomain: 'https://acmecomponents.co.uk/about',
        town: 'Coventry',
        country: 'United Kingdom',
        industry: 'precision engineering',
        descriptors: 'gear pumps',
      }),
    );
    const targetPath = target.headers.get('location')!;
    const targetId = targetPath.split('/').at(-1)!;

    const beforeEvidence = await (await fetch(base + targetPath)).text();
    assert.match(beforeEvidence, /No evidence yet/);

    // 4. Supply evidence.
    const added = await fetch(
      `${base}/evidence`,
      form({
        targetId,
        url: 'https://www.coventrytelegraph.net/business/acme-export-finance',
        title: 'Acme Components secures £3m export finance facility',
        publishedAt: '2026-08-14',
        text: PAGE_BODY,
        providedBy: 'alex@orbitaldirect.co.uk',
      }),
    );
    assert.equal(added.status, 303);

    // 5. Assess.
    const assessed = await fetch(`${base}/assess`, form({ targetId }));
    assert.equal(assessed.status, 303);
    const assessmentPath = assessed.headers.get('location')!;

    // 6-8. The brief, its evidence, its caveats, and what was not looked at.
    const brief = await (await fetch(base + assessmentPath)).text();
    assert.match(brief, /Acme Components Ltd/);
    assert.match(brief, /What changed/);
    assert.match(brief, /Acme will need additional export haulage capacity/);
    assert.match(brief, /Settle it by asking/);
    assert.match(brief, /coventrytelegraph/);
    assert.match(brief, /page retrieved/);
    assert.match(brief, /How it scored/);
    assert.match(brief, /What this run looked at/);
    assert.match(brief, /every name, figure and date in the write-up appears in a source/);

    // The verdict is visible from the company page too.
    assert.match(await (await fetch(base + targetPath)).text(), /Read the full assessment/);
  });
});

test('the domain is normalised to an identity key rather than stored as typed', async () => {
  await withServer(stubModels(), async (base) => {
    const client = await fetch(
      `${base}/clients`,
      form({ name: 'C', domain: 'c.com', offerings: 'x', demandTriggers: 'y' }),
    );
    const clientId = client.headers.get('location')!.split('/').at(-1)!;
    const target = await fetch(
      `${base}/targets`,
      form({ clientId, canonicalName: 'Acme', canonicalDomain: 'https://acmecomponents.co.uk/about' }),
    );
    const page = await (await fetch(base + target.headers.get('location')!)).text();
    assert.match(page, /acmecomponents\.co\.uk/);
    assert.doesNotMatch(page, /https:\/\/acmecomponents\.co\.uk\/about/);
  });
});

test('a client with no offering is refused, because nothing can be a signal without one', async () => {
  await withServer(stubModels(), async (base) => {
    const response = await fetch(`${base}/clients`, form({ name: 'C', domain: 'c.com', offerings: '' }));
    assert.equal(response.status, 400);
    assert.match(await response.text(), /at least one offering/);
  });
});

test('without a model credential the product refuses to assess and says why', async () => {
  await withServer(null, async (base) => {
    const client = await fetch(
      `${base}/clients`,
      form({ name: 'C', domain: 'c.com', offerings: 'x', demandTriggers: 'y' }),
    );
    const clientId = client.headers.get('location')!.split('/').at(-1)!;
    const target = await fetch(
      `${base}/targets`,
      form({ clientId, canonicalName: 'Acme', canonicalDomain: 'acmecomponents.co.uk' }),
    );
    const targetId = target.headers.get('location')!.split('/').at(-1)!;
    await fetch(
      `${base}/evidence`,
      form({ targetId, url: 'https://x.example/a', title: 'a', text: 'b', providedBy: 'me' }),
    );

    const response = await fetch(`${base}/assess`, form({ targetId }));
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.match(body, /No model credential/);
    assert.match(body, /no verdict about this company should be inferred/);
  });
});

test('a failed run is displayed as a failed run, not as a negative finding', async () => {
  const models: Models = {
    extractor: {
      id: 'broken',
      async extractClaims() {
        throw new Error('extraction provider anthropic returned 401');
      },
    },
    reasoner: stubReasoner(),
  };

  await withServer(models, async (base) => {
    const client = await fetch(
      `${base}/clients`,
      form({ name: 'C', domain: 'c.com', offerings: 'x', demandTriggers: 'y' }),
    );
    const clientId = client.headers.get('location')!.split('/').at(-1)!;
    const target = await fetch(
      `${base}/targets`,
      form({ clientId, canonicalName: 'Acme', canonicalDomain: 'acmecomponents.co.uk' }),
    );
    const targetId = target.headers.get('location')!.split('/').at(-1)!;
    await fetch(
      `${base}/evidence`,
      form({ targetId, url: 'https://x.example/a', title: 'a', text: 'b', providedBy: 'me' }),
    );

    const assessed = await fetch(`${base}/assess`, form({ targetId }));
    const page = await (await fetch(base + assessed.headers.get('location')!)).text();
    assert.match(page, /The run could not be completed/);
    assert.match(page, /It says nothing about/);
  });
});

test('user input is escaped rather than rendered', async () => {
  await withServer(stubModels(), async (base) => {
    await fetch(
      `${base}/clients`,
      form({ name: '<script>alert(1)</script>', domain: 'c.com', offerings: 'x', demandTriggers: 'y' }),
    );
    const body = await (await fetch(base)).text();
    assert.doesNotMatch(body, /<script>alert/);
    assert.match(body, /&lt;script&gt;/);
  });
});

test('an unknown page is a 404, not a blank success', async () => {
  await withServer(stubModels(), async (base) => {
    assert.equal((await fetch(`${base}/nope`)).status, 404);
    assert.equal((await fetch(`${base}/client/cli_missing`)).status, 404);
  });
});

test('no credential in the environment means no models, rather than a broken client', () => {
  assert.equal(modelsFromEnv({}), null);
  const models = modelsFromEnv({ SIGNAL_LLM_API_KEY: 'k', SIGNAL_LLM_MODEL: 'm' });
  assert.equal(models?.extractor.id, 'anthropic:m');
});
