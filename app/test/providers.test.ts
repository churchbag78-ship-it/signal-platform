import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceSnippet,
  ProvidedEvidenceSearchClient,
  ProvidedPageRetriever,
  ReasoningExtractor,
  type ExtractionTrace,
} from '../src/providers.ts';
import { verifyClaimPassage } from '../../engine/src/research/retrieval.ts';
import { acme, claim, evidence, orbitalDirect, RUN_DATE, reasoningOutput, stubExtractor, stubReasoner } from './helpers.ts';
import { toCompanyIdentity } from '../../engine/src/domain.ts';

test('the corpus is delivered once, so a run cannot claim to have seen it sixty times', async () => {
  const search = new ProvidedEvidenceSearchClient([evidence(), evidence({ url: 'https://b.example/x' })]);

  const first = await search.search('acme components export finance');
  const second = await search.search('acme components new premises');

  assert.equal(first.length, 2);
  assert.equal(second.length, 0);
  assert.deepEqual(search.queriesAsked.length, 2);
});

test('a first-party sweep query returns nothing, because nobody swept the site', async () => {
  // Otherwise "we did not look" is recorded as "we looked and found nothing",
  // which is the one negative that must always be real.
  const search = new ProvidedEvidenceSearchClient([evidence()]);
  assert.deepEqual(await search.search('site:acmecomponents.co.uk news'), []);
  // And the corpus is still available to the change-family plan afterwards.
  assert.equal((await search.search('acme components export finance')).length, 1);
});

test('a pasted body is served as the page, so passage verification does real work', async () => {
  const retriever = new ProvidedPageRetriever([evidence()]);
  const result = await verifyClaimPassage(claim().sourceUrl, claim().supportingPassage, retriever);
  assert.equal(result.level, 'page_retrieved');
  assert.equal(result.outcome, 'retrieved');
});

test('a passage that is not in the pasted page does not earn page level', async () => {
  const retriever = new ProvidedPageRetriever([evidence()]);
  const result = await verifyClaimPassage(
    claim().sourceUrl,
    'Acme opened distribution centres in Thailand, China and Denmark employing four hundred staff.',
    retriever,
  );
  assert.equal(result.level, 'search_snippet');
  assert.match(result.failure ?? '', /does not contain the supporting passage/);
});

test('evidence supplied as a snippet is never fabricated into a retrieved page', async () => {
  const retriever = new ProvidedPageRetriever([evidence({ text: '', snippet: 'a summary' })]);
  const outcome = await retriever.retrieve(evidence().url);
  assert.equal(outcome.status, 'unavailable');
});

test('the snippet falls back to the head of the pasted body', () => {
  assert.match(evidenceSnippet(evidence()), /^Acme Components Ltd, the Coventry/);
  assert.equal(evidenceSnippet(evidence({ snippet: 'given' })), 'given');
});

function extractorFor() {
  return new ReasoningExtractor({
    extractor: stubExtractor(),
    reasoner: stubReasoner(),
    fingerprints: new Map([[toCompanyIdentity(acme).domain, acme]]),
  });
}

const request = {
  company: toCompanyIdentity(acme),
  client: orbitalDirect,
  results: [],
  runDate: RUN_DATE,
};

test('extraction and reasoning are two calls with the identity gate between them', async () => {
  const traces: ExtractionTrace[] = [];
  const reasoner = stubReasoner();
  const extractor = new ReasoningExtractor({
    extractor: stubExtractor(),
    reasoner,
    fingerprints: new Map([[toCompanyIdentity(acme).domain, acme]]),
    onTrace: (t) => traces.push(t),
  });

  const output = await extractor.extract(request);

  assert.ok(output);
  assert.equal(output.hypothesis.id, 'h1');
  assert.equal(output.claims.length, 1);
  // The reasoner saw a promoted Fact, not a raw claim.
  assert.equal(reasoner.calls[0]?.facts[0]?.kind, 'fact');
  assert.equal(traces[0]?.factsReasonedOver, 1);
  assert.equal(traces[0]?.claimsGated, 0);
});

test('a source about a different company never reaches the commercial reasoning', async () => {
  const traces: ExtractionTrace[] = [];
  const reasoner = stubReasoner();
  const extractor = new ReasoningExtractor({
    extractor: stubExtractor({
      claims: [
        claim({
          identityAttributes: {
            statedName: 'Acme Components Inc',
            statedGeography: { country: 'United States', town: 'Denver' },
            statedIndustry: 'software',
          },
        }),
      ],
    }),
    reasoner,
    fingerprints: new Map([[toCompanyIdentity(acme).domain, acme]]),
    onTrace: (t) => traces.push(t),
  });

  const output = await extractor.extract(request);

  assert.equal(output, null);
  assert.equal(reasoner.calls.length, 0);
  assert.match(traces[0]?.reasoningSkipped ?? '', /identity gate/);
});

test('an ungrounded specific in the write-up becomes a contradiction the engine can act on', async () => {
  const extractor = new ReasoningExtractor({
    extractor: stubExtractor(),
    reasoner: stubReasoner(
      reasoningOutput({
        whatChanged: 'Acme opened distribution centres in Thailand, China and Denmark.',
      }),
    ),
    fingerprints: new Map([[toCompanyIdentity(acme).domain, acme]]),
  });

  const output = await extractor.extract(request);

  const notes = output?.contradictions.map((c) => c.note) ?? [];
  assert.equal(output?.contradictions.some((c) => c.severity === 'conflicting'), true);
  assert.equal(notes.filter((n) => /Thailand|China|Denmark/.test(n)).length, 3);
});

test('a company with no fingerprint is refused rather than assessed without a gate', async () => {
  const extractor = extractorFor();
  await assert.rejects(
    () => extractor.extract({ ...request, company: { name: 'Other', domain: 'other.com' } }),
    /no identity fingerprint/,
  );
});

test('zero extracted claims is "nothing found", not an error', async () => {
  const extractor = new ReasoningExtractor({
    extractor: stubExtractor({ claims: [] }),
    reasoner: stubReasoner(),
    fingerprints: new Map([[toCompanyIdentity(acme).domain, acme]]),
  });
  assert.equal(await extractor.extract(request), null);
});
