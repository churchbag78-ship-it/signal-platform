import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHANGE_FAMILIES,
  CHANGE_FAMILY_IDS,
  changeFamily,
  disambiguator,
  familyQuery,
  orderFamilies,
  planFamilyQueries,
} from '../src/research/change-families.ts';
import {
  FIRST_PARTY_PATHS,
  SWEPT_SECTIONS,
  firstPartyCandidates,
  firstPartyQueries,
  sweepFirstParty,
} from '../src/research/first-party.ts';
import {
  FileHistoryStore,
  InMemoryHistoryStore,
  droppedFromUniverse,
  isGenuineNegative,
  isInconclusive,
  mergeRecords,
  stateOf,
  type ResearchRecord,
} from '../src/research/history.ts';
import { rejectionState } from '../src/research/adapter.ts';
import type { PageRetriever, RetrievalOutcome } from '../src/research/retrieval.ts';
import { contentHash } from '../src/research/retrieval.ts';
import type { SearchClient, SearchResult } from '../src/research/types.ts';
import type { IdentityFingerprint } from '../src/domain.ts';
import { orbitalDirect } from '../fixtures/pilot-a.ts';

const target: IdentityFingerprint = {
  canonicalName: 'Acme Widgets',
  canonicalDomain: 'acme.co.uk',
  geography: { country: 'United Kingdom', region: 'Derbyshire', town: 'Ilkeston' },
  industry: 'Widget manufacturing',
  aliasDomains: [
    {
      domain: 'acme-widgets.com',
      evidence: 'linked from the canonical site footer under the same brand',
      verifiedBy: 'first_party_link',
    },
    {
      domain: 'acme-guessed.com',
      evidence: 'similar name, nothing establishes ownership',
      verifiedBy: 'unverified',
    },
  ],
};

/* ------------------------- change families ------------------------- */

test('the catalogue covers every change family the brief names', () => {
  for (const id of [
    'expansion',
    'relocation',
    'new_premises',
    'major_contract',
    'project',
    'investment',
    'acquisition',
    'new_market',
    'hiring',
    'partnership',
    'tender',
    'manufacturing_change',
    'distribution_change',
    'technology_automation',
    'restructuring',
    'customer_win',
  ] as const) {
    assert.ok(CHANGE_FAMILY_IDS.includes(id), `missing family: ${id}`);
    assert.ok(changeFamily(id).terms.length > 0, `family has no terms: ${id}`);
  }
  assert.equal(CHANGE_FAMILIES.length, 16);
});

test('no family names a company, industry or country — nothing can be hard-coded to a target', () => {
  const forbidden = /nms|zambia|orbital|maeving|baltex|devol|bramble|winbro|slack|africa|hospital/i;
  for (const family of CHANGE_FAMILIES) {
    for (const term of family.terms) {
      assert.ok(!forbidden.test(term), `${family.id} term leaks a target: ${term}`);
    }
  }
});

test('every query carries disambiguating context', () => {
  for (const family of CHANGE_FAMILIES) {
    const query = familyQuery(target, family);
    assert.ok(query.startsWith('Acme Widgets Ilkeston'), query);
  }
  assert.equal(disambiguator(target), 'Ilkeston');
});

test('a target with no geography still gets disambiguated', () => {
  const bare: IdentityFingerprint = {
    canonicalName: 'Acme',
    canonicalDomain: 'acme.com',
    industry: 'Gear pumps',
  };
  assert.equal(disambiguator(bare), 'Gear pumps');
});

test('strong families are always planned before moderate ones', () => {
  const ordered = orderFamilies(orbitalDirect);
  const firstModerate = ordered.findIndex((f) => f.strength === 'moderate');
  const lastStrong = ordered.map((f) => f.strength).lastIndexOf('strong');
  assert.ok(lastStrong < firstModerate, 'a moderate family was ordered above a strong one');
});

test("the client's own demand triggers do not reorder the plan", () => {
  // This is the v4 blind spot as a regression test: contract and project
  // queries must survive a small budget whatever the client's trigger list says.
  const narrow = { ...orbitalDirect, demandTriggers: ['warehouse move', 'distribution centre'] };
  const planned = planFamilyQueries(target, narrow, { familyBudget: 2 });
  assert.deepEqual(
    planned.map((q) => q.family),
    ['major_contract', 'project'],
  );
});

test('a budget smaller than the catalogue truncates rather than dropping attribution', () => {
  const planned = planFamilyQueries(target, orbitalDirect, { familyBudget: 3 });
  assert.equal(planned.length, 3);
  for (const query of planned) {
    assert.equal(query.kind, 'change_family');
    assert.ok(query.family);
  }
});

test('a zero budget plans nothing rather than throwing', () => {
  assert.deepEqual(planFamilyQueries(target, orbitalDirect, { familyBudget: 0 }), []);
});

/* --------------------------- first party --------------------------- */

test('the sweep covers newsroom, press, announcements, investors, careers and projects', () => {
  const sections = new Set(FIRST_PARTY_PATHS.map((p) => p.section));
  for (const section of [
    'newsroom',
    'press_releases',
    'announcements',
    'investors',
    'careers',
    'projects',
  ] as const) {
    assert.ok(sections.has(section), `no path for ${section}`);
    assert.ok(SWEPT_SECTIONS.includes(section), `${section} is not swept`);
  }
});

test('only the canonical domain and VERIFIED aliases are swept', () => {
  const domains = new Set(firstPartyCandidates(target).map((c) => c.domain));
  assert.ok(domains.has('acme.co.uk'));
  assert.ok(domains.has('acme-widgets.com'));
  assert.ok(!domains.has('acme-guessed.com'), 'an unverified alias was swept');

  const queries = firstPartyQueries(target).map((q) => q.query);
  assert.ok(!queries.some((q) => q.includes('acme-guessed.com')));
});

class StubRetriever implements PageRetriever {
  readonly id = 'stub';
  #pages: Map<string, string>;
  #blocked: boolean;

  constructor(pages: Record<string, string>, blocked = false) {
    this.#pages = new Map(Object.entries(pages));
    this.#blocked = blocked;
  }

  describe() {
    return {
      providerId: this.id,
      operation: 'stub.retrieve_page',
      dataType: 'web_page' as const,
      cost: { credits: 0 },
      availability: (this.#blocked ? 'blocked' : 'available') as 'blocked' | 'available',
      confidence: 1,
    };
  }

  async retrieve(url: string): Promise<RetrievalOutcome> {
    if (this.#blocked) return { status: 'unavailable', url, reason: 'egress blocked' };
    const text = this.#pages.get(url);
    if (text === undefined) return { status: 'failed', url, reason: 'not found', httpStatus: 404 };
    return {
      status: 'retrieved',
      page: {
        url,
        status: 200,
        contentType: 'text/html',
        text,
        retrievedAt: '2026-09-09',
        contentHash: contentHash(text),
      },
    };
  }
}

class StubSearch implements SearchClient {
  readonly id = 'stub-search';
  #results: Record<string, SearchResult[]>;
  #throwOnMiss: boolean;

  constructor(results: Record<string, SearchResult[]>, throwOnMiss = true) {
    this.#results = results;
    this.#throwOnMiss = throwOnMiss;
  }

  async search(query: string): Promise<SearchResult[]> {
    const found = this.#results[query];
    if (found) return found;
    if (this.#throwOnMiss) throw new Error(`no capture for query ${JSON.stringify(query)}`);
    return [];
  }
}

function result(url: string): SearchResult {
  return { query: 'q', title: 't', url, snippet: 's', retrievedAt: '2026-09-09' };
}

test('a retrieved first-party page marks its section covered', async () => {
  const sweep = await sweepFirstParty({
    target,
    retriever: new StubRetriever({ 'https://acme.co.uk/news': 'Acme wins contract' }),
    search: new StubSearch({}, true),
    sections: ['newsroom'],
    maxPaths: 20,
  });

  assert.equal(sweep.pages.length, 1);
  assert.deepEqual(sweep.sectionsCovered, ['newsroom']);
  assert.deepEqual(sweep.sectionsUnchecked, []);
  assert.equal(sweep.retrievalBlocked, false);
});

test('blocked retrieval is reported as unchecked, never as nothing found', async () => {
  const sweep = await sweepFirstParty({
    target,
    retriever: new StubRetriever({}, true),
    search: new StubSearch({}, true),
    sections: ['newsroom'],
    maxPaths: 5,
  });

  assert.equal(sweep.retrievalBlocked, true);
  assert.deepEqual(sweep.sectionsCovered, []);
  assert.deepEqual(sweep.sectionsUnchecked, ['newsroom']);
  assert.ok(sweep.paths.every((p) => p.outcome === 'unavailable'));
  // The site-scoped queries could not run either, and are recorded as such.
  assert.ok(sweep.unexecuted.length > 0);
});

test('a 404 is "we looked and it is not there", distinct from "we could not look"', async () => {
  const sweep = await sweepFirstParty({
    target,
    retriever: new StubRetriever({}),
    search: new StubSearch({}, true),
    sections: ['newsroom'],
    maxPaths: 4,
  });
  assert.ok(sweep.paths.every((p) => p.outcome === 'not_found'));
  assert.equal(sweep.retrievalBlocked, false);
});

test('the site-scoped channel covers a section when direct retrieval cannot', async () => {
  const sweep = await sweepFirstParty({
    target,
    retriever: new StubRetriever({}, true),
    search: new StubSearch({
      'site:acme.co.uk news': [result('https://acme.co.uk/news/contract-award')],
    }),
    sections: ['newsroom'],
    maxPaths: 3,
  });

  assert.deepEqual(sweep.sectionsCovered, ['newsroom']);
  assert.equal(sweep.sourcesFound, 1);
});

test('a search hit on a domain the company does not own does not count as first-party', async () => {
  const sweep = await sweepFirstParty({
    target,
    retriever: new StubRetriever({}, true),
    search: new StubSearch({
      'site:acme.co.uk news': [result('https://someaggregator.com/acme')],
    }),
    sections: ['newsroom'],
    maxPaths: 0,
  });

  assert.deepEqual(sweep.sectionsCovered, []);
  assert.equal(sweep.sourcesFound, 0);
});

test("one section's hit does not mark another section covered", async () => {
  const sweep = await sweepFirstParty({
    target,
    retriever: new StubRetriever({}, true),
    search: new StubSearch({
      'site:acme.co.uk news': [result('https://acme.co.uk/news/x')],
      'site:acme.co.uk projects contract': [],
    }),
    sections: ['newsroom', 'projects'],
    maxPaths: 0,
  });

  assert.deepEqual(sweep.sectionsCovered, ['newsroom']);
  assert.deepEqual(sweep.sectionsUnchecked, ['projects']);
});

/* ----------------------------- history ----------------------------- */

function record(overrides: Partial<ResearchRecord>): ResearchRecord {
  const base: ResearchRecord = {
    domain: 'acme.co.uk',
    company: 'Acme Widgets',
    state: 'no_trigger_found',
    reason: 'nothing found',
    lastCheckedAt: '2026-09-09',
    coverage: {
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
    },
    evidence: [],
    history: [
      { runDate: '2026-09-09', state: 'no_trigger_found', reason: 'nothing found', queries: 6, sourcesSeen: 0 },
    ],
    timesResearched: 1,
  };
  return { ...base, ...overrides };
}

test('the six outcome states stay distinct and classify correctly', () => {
  assert.equal(isGenuineNegative('no_trigger_found'), true);
  assert.equal(isGenuineNegative('no_commercial_consequence'), true);

  for (const state of [
    'not_researched',
    'insufficient_evidence',
    'identity_unresolved',
    'identity_collision',
    'research_failure',
  ] as const) {
    assert.equal(isGenuineNegative(state), false, state);
    assert.equal(isInconclusive(state), true, state);
  }
});

test('every rejection stage maps to a state, and research failure maps to itself', () => {
  assert.equal(rejectionState('research_failure'), 'research_failure');
  assert.equal(rejectionState('no_trigger_found'), 'no_trigger_found');
  assert.equal(rejectionState('no_commercial_consequence'), 'no_commercial_consequence');
  assert.equal(rejectionState('identity_collision'), 'identity_collision');
  assert.equal(rejectionState('identity_unresolved'), 'identity_unresolved');
  assert.equal(rejectionState('icp'), 'disqualified');
  assert.equal(rejectionState('stale'), 'insufficient_evidence');
  assert.equal(rejectionState('invalid_claims'), 'insufficient_evidence');
});

test('a company never seen reads as not_researched, not as a negative', () => {
  assert.equal(stateOf([], 'acme.co.uk'), 'not_researched');
  assert.equal(isGenuineNegative(stateOf([], 'acme.co.uk')), false);
});

test('a research failure never overwrites what was already known', () => {
  const stored = [record({ state: 'signal_found', reason: 'contract win', trigger: 'major_contract' })];
  const merged = mergeRecords(stored, [
    record({
      state: 'research_failure',
      reason: 'no query could be executed',
      history: [
        {
          runDate: '2026-09-10',
          state: 'research_failure',
          reason: 'no query could be executed',
          queries: 0,
          sourcesSeen: 0,
        },
      ],
    }),
  ]);

  assert.equal(merged[0]!.state, 'signal_found');
  assert.equal(merged[0]!.trigger, 'major_contract');
  assert.ok(merged[0]!.reason.includes('could not re-check'));
  // The failure itself is not hidden — it is in the history.
  assert.equal(merged[0]!.history.at(-1)!.state, 'research_failure');
  assert.equal(merged[0]!.timesResearched, 2);
});

test('a conclusive re-check does replace the stored state', () => {
  const stored = [record({ state: 'no_trigger_found' })];
  const merged = mergeRecords(stored, [
    record({
      state: 'signal_found',
      reason: 'contract win',
      history: [
        { runDate: '2026-09-10', state: 'signal_found', reason: 'contract win', queries: 9, sourcesSeen: 12 },
      ],
    }),
  ]);
  assert.equal(merged[0]!.state, 'signal_found');
  assert.equal(merged[0]!.history.length, 2);
});

test('a company researched once stays in the universe when a later run omits it', () => {
  const stored = [record({ domain: 'adslaser.co.uk', company: 'ADS Laser Cutting Ltd' })];
  const dropped = droppedFromUniverse(stored, ['maeving.com', 'baltex.co.uk']);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0]!.company, 'ADS Laser Cutting Ltd');
});

test('the in-memory store round-trips', async () => {
  const store = new InMemoryHistoryStore();
  await store.save([record({})]);
  assert.equal((await store.load()).length, 1);
});

test('the file store round-trips through an injected filesystem', async () => {
  const files = new Map<string, string>();
  const dirs: string[] = [];
  const store = new FileHistoryStore('state/history.json', {
    async readFile(path) {
      const found = files.get(path);
      if (found === undefined) throw new Error('ENOENT');
      return found;
    },
    async writeFile(path, data) {
      files.set(path, data);
    },
    async mkdir(path) {
      dirs.push(path);
      return path;
    },
  });

  assert.deepEqual(await store.load(), []);
  await store.save([record({})]);
  assert.deepEqual(dirs, ['state']);
  assert.equal((await store.load())[0]!.domain, 'acme.co.uk');
});

test('an unreadable store is an empty history, not a crash', async () => {
  const store = new FileHistoryStore('state/history.json', {
    async readFile() {
      return 'not json';
    },
    async writeFile() {},
    async mkdir() {
      return undefined;
    },
  });
  assert.deepEqual(await store.load(), []);
});

/* ------------------- adapter discovery integration ------------------ */

import { WebResearchAdapter } from '../src/research/adapter.ts';
import { CorpusClaimExtractor } from '../src/research/corpus.ts';
import { AgentBridgeSearchClient } from '../src/research/agent-bridge.ts';
import { NullPageRetriever } from '../src/research/retrieval.ts';
import { liveCaptureV5, liveExtractionsV5 } from '../fixtures/pilot-a-live-v5.ts';
import { pilotATargets } from '../fixtures/pilot-a.ts';

function v5Adapter(overrides: Record<string, unknown> = {}) {
  return new WebResearchAdapter({
    search: new AgentBridgeSearchClient(liveCaptureV5),
    extractor: new CorpusClaimExtractor(liveExtractionsV5),
    targets: pilotATargets,
    runDate: '2026-09-09',
    retriever: new NullPageRetriever('blocked'),
    queryStrategy: 'change_family',
    familyBudget: 6,
    firstPartySections: ['newsroom', 'press_releases', 'projects'],
    maxFirstPartyPaths: 6,
    ...overrides,
  });
}

test('the first-party sweep runs before any change-family query, for every researched company', async () => {
  const adapter = v5Adapter();
  await adapter.discoverTriggers(orbitalDirect);

  // Bleckmann and Aldi have no captures in this corpus, so their sweep
  // queries could not be executed — recorded as coverage loss, not as absence.
  const swept = [...adapter.coverageByDomain].filter(([, c]) => c.queriesRun.length > 0);
  assert.equal(swept.length, 7);

  for (const [domain, coverage] of swept) {
    assert.ok(coverage.firstPartyQueriesRun > 0, `${domain} got no first-party sweep`);
    const firstFamilyIndex = coverage.queriesRun.findIndex((q) => !q.startsWith('site:'));
    const lastSiteIndex = coverage.queriesRun.map((q) => q.startsWith('site:')).lastIndexOf(true);
    assert.ok(lastSiteIndex < firstFamilyIndex, `${domain} ran a family query before the sweep`);
  }
});

test('a company rejected on the client disqualifiers spends no queries at all', async () => {
  const adapter = v5Adapter();
  await adapter.discoverTriggers({
    ...orbitalDirect,
    disqualifiers: ['third-party logistics'],
  });
  // The prescreen hook is what enforces this; without one, every target is researched.
  assert.equal(adapter.coverageByDomain.size, pilotATargets.length);
});

test('coverage is recorded whatever the outcome, including for a company with no signal', async () => {
  const adapter = v5Adapter();
  await adapter.discoverTriggers(orbitalDirect);

  const winbro = adapter.coverageByDomain.get('winbrogroup.com');
  assert.ok(winbro, 'no coverage recorded for a no-trigger company');
  assert.equal(winbro.familiesChecked.length, 6);
  assert.ok(winbro.firstPartySectionsCovered.length > 0);
  assert.equal(winbro.retrievalBlocked, true);
});

test('a transport that can execute nothing yields research_failure, never a negative finding', async () => {
  const adapter = v5Adapter({
    // A capture file with no captures: every query throws.
    search: new AgentBridgeSearchClient({ capturedAt: '2026-09-09', transport: 'none', captures: [] }),
  });
  await adapter.discoverTriggers(orbitalDirect);

  const rejections = adapter.rejections();
  assert.ok(rejections.length > 0);
  for (const rejection of rejections) {
    assert.equal(rejection.stage, 'research_failure');
    assert.ok(!rejection.reason.includes('no dated commercial change'));
  }
  assert.equal(rejectionState('research_failure'), 'research_failure');
});

test('the run persists one record per target, and keeps a prior company in the universe', async () => {
  const store = new InMemoryHistoryStore([
    {
      domain: 'adslaser.co.uk',
      company: 'ADS Laser Cutting Ltd',
      state: 'signal_found',
      reason: 'export growth',
      lastCheckedAt: '2026-09-08',
      coverage: {
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
      },
      evidence: [],
      history: [],
      timesResearched: 1,
    },
  ]);

  const adapter = v5Adapter({ history: store });
  await adapter.discoverTriggers(orbitalDirect);

  const records = await store.load();
  assert.equal(records.length, pilotATargets.length + 1);
  assert.equal(adapter.droppedFromUniverse.length, 1);
  assert.equal(adapter.droppedFromUniverse[0]!.company, 'ADS Laser Cutting Ltd');

  // Each outcome keeps its own state; they must not collapse into one another.
  const states = new Map(records.map((r) => [r.domain, r.state]));
  assert.equal(states.get('winbrogroup.com'), 'no_trigger_found');
  assert.equal(states.get('slackandparr.com'), 'no_commercial_consequence');
  // Was `insufficient_evidence` until date attribution: the signal used to be
  // rejected as stale because an undated current claim took the date of an
  // older corroborating one.
  assert.equal(states.get('nmsinfrastructure.com'), 'signal_found');
  assert.equal(states.get('maeving.com'), 'signal_found');
});

test('the persisted record carries evidence and coverage, not just a verdict', async () => {
  const store = new InMemoryHistoryStore();
  await v5Adapter({ history: store }).discoverTriggers(orbitalDirect);

  const maeving = (await store.load()).find((r) => r.domain === 'maeving.com')!;
  assert.equal(maeving.trigger, 'export_finance');
  assert.ok(maeving.evidence.length >= 2);
  assert.ok(maeving.evidence.every((e) => e.url.startsWith('http')));
  assert.equal(maeving.coverage.familiesChecked.length, 6);
  assert.equal(maeving.history.at(-1)!.state, 'signal_found');
});

test('a first-party programme claim reaches the pipeline and survives freshness undated', async () => {
  // The diagnostic case, stated as behaviour rather than as a company name in
  // the query generator. Before date attribution this signal was rejected as
  // `stale`: its undated first-party claim took the date of a 2022
  // corroborating fact. It now carries no change date, which is a different
  // state from old.
  const adapter = v5Adapter();
  await adapter.discoverTriggers(orbitalDirect);

  const signal = adapter.signals().find((s) => s.company.domain === 'nmsinfrastructure.com');
  assert.ok(signal, 'the first-party programme claim produced no signal');
  assert.equal(signal.dating.changeDate, null);
  assert.equal(signal.freshness.excluded, false);
  assert.ok(signal.dating.rejected.length >= 2, 'older dates were not rejected');
  assert.ok(signal.coverage.firstPartySourcesFound > 0, 'the sweep found no first-party source');
});
