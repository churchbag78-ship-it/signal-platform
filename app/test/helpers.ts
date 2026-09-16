/** Shared test scaffolding. Not a test file, so the runner does not pick it up. */

import type { IdentityFingerprint } from '../../engine/src/domain.ts';
import type { ClientProfile } from '../../engine/src/pipeline.ts';
import type { ExtractedClaim } from '../../engine/src/research/extraction.ts';
import type { ExtractionRequest } from '../../engine/src/research/types.ts';
import type { LlmExtractionResult } from '../../engine/src/research/llm-extractor.ts';
import type { ProvidedEvidence } from '../src/providers.ts';
import type { ReasoningOutput, ReasoningRequest } from '../src/reasoner.ts';

export const RUN_DATE = '2026-09-16';

export const orbitalDirect: ClientProfile = {
  name: 'Orbital Direct',
  domain: 'orbitaldirect.co.uk',
  offerings: ['pallet storage', 'export haulage', 'contract packing'],
  demandTriggers: ['new overseas market entry', 'new premises', 'export finance'],
  buyerFunctions: ['Operations', 'Supply Chain'],
  disqualifiers: ['companies that run their own fleet'],
};

export const acme: IdentityFingerprint = {
  canonicalName: 'Acme Components Ltd',
  canonicalDomain: 'acmecomponents.co.uk',
  geography: { country: 'United Kingdom', region: 'West Midlands', town: 'Coventry' },
  industry: 'precision engineering',
  descriptors: ['gear pumps'],
};

export const PAGE_BODY =
  'Acme Components Ltd, the Coventry precision engineering firm, has secured a ' +
  '£3m export finance facility backed by UK Export Finance. The Coventry-based ' +
  'manufacturer of gear pumps said the facility, agreed in August 2026, will ' +
  'fund shipments to new customers in Germany and will create 13 new jobs.';

export function evidence(overrides: Partial<ProvidedEvidence> = {}): ProvidedEvidence {
  return {
    url: 'https://www.coventrytelegraph.net/business/acme-export-finance',
    title: 'Acme Components secures £3m export finance facility',
    text: PAGE_BODY,
    publishedAt: '2026-08-14',
    providedBy: 'alex@orbitaldirect.co.uk',
    providedAt: RUN_DATE,
    ...overrides,
  };
}

export function claim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: 'c1',
    claimText:
      'Acme Components Ltd secured a £3m export finance facility backed by UK Export Finance.',
    supportingPassage:
      'Acme Components Ltd, the Coventry precision engineering firm, has secured a £3m export finance facility backed by UK Export Finance.',
    sourceUrl: 'https://www.coventrytelegraph.net/business/acme-export-finance',
    publicationDate: '2026-08-14',
    eventDate: '2026-08-14',
    dateBasis: 'change_occurred',
    topic: 'export_trade',
    identityAttributes: {
      statedName: 'Acme Components Ltd',
      statedGeography: { country: 'United Kingdom', town: 'Coventry' },
      statedIndustry: 'precision engineering',
    },
    demandImpacts: [
      {
        offering: 'export haulage',
        effect: 'increases',
        rationale: 'the facility funds shipments to new customers in Germany',
      },
    ],
    extractionConfidence: 0.9,
    verification: 'search_snippet',
    ...overrides,
  };
}

export function stubExtractor(result: Partial<LlmExtractionResult> = {}) {
  const calls: ExtractionRequest[] = [];
  return {
    id: 'stub-extractor',
    calls,
    async extractClaims(request: ExtractionRequest): Promise<LlmExtractionResult> {
      calls.push(request);
      return {
        claims: [claim()],
        trigger: 'export_finance',
        whatChanged: 'Acme secured a £3m export finance facility.',
        polarity: 'demand_increasing',
        polarityRationale: 'more outbound shipments',
        discarded: 0,
        ...result,
      };
    },
  };
}

export function reasoningOutput(overrides: Partial<ReasoningOutput> = {}): ReasoningOutput {
  return {
    trigger: 'export_finance',
    whatChanged:
      'Acme Components secured a £3m export finance facility backed by UK Export Finance in August 2026.',
    triggerClaimIds: ['c1'],
    inferences: [
      {
        kind: 'inference',
        id: 'i1',
        statement: 'Outbound shipment volume will rise as the facility is drawn down.',
        derivedFrom: ['c1'],
        reasoning: 'export finance exists to fund shipments',
      },
    ],
    hypothesis: {
      kind: 'hypothesis',
      id: 'h1',
      statement: 'Acme will need additional export haulage capacity.',
      derivedFrom: ['i1'],
      reasoning: 'more shipments need more movements',
      testableBy: 'Ask who moves their export pallets today and whether that capacity is committed.',
    },
    polarity: 'demand_increasing',
    polarityRationale: 'the facility funds shipments, which creates movements',
    consequence: { actionable: true, rationale: 'export haulage is directly sellable here' },
    owningFunction: { function: 'Operations', rationale: 'despatch owns outbound movements' },
    icpRelevance: { fits: true, rationale: 'an exporter with no fleet of its own' },
    contradictions: [],
    judgements: { icpFit: 21, signalStrength: 17, commercialRelevance: 13 },
    whyNow: 'The facility was agreed in August 2026 and the shipments follow it.',
    salesAngle: 'Ask how they are moving the extra volume the facility funds.',
    ...overrides,
  };
}

export function stubReasoner(output: ReasoningOutput = reasoningOutput()) {
  const calls: ReasoningRequest[] = [];
  return {
    calls,
    async reason(request: ReasoningRequest): Promise<ReasoningOutput> {
      calls.push(request);
      return output;
    },
  };
}
