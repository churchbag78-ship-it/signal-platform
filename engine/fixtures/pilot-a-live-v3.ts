/**
 * Pilot A LIVE v3 — 2026-09-09, after the source registry expansion and the
 * ClaimExtractor contract.
 *
 * The search results are the real captures from the v2 run (same queries, same
 * pages). What changed is the SHAPE of extraction: every claim is now an
 * `ExtractedClaim` carrying its own topic, supporting passage, publication and
 * event dates, extraction confidence and — critically — the identity
 * attributes read from that source.
 *
 * Nothing here asserts that a source is about the target. There is no field
 * for it. The engine classifies the source in the context of the claim's topic,
 * runs the identity gate on the attributes, and only then builds a Fact.
 *
 * v1 and v2 are preserved unchanged as historical evidence.
 */

import type { Hypothesis, Inference } from '../src/domain.ts';
import type { CaptureFile } from '../src/research/agent-bridge.ts';
import type { ExtractionCorpus } from '../src/research/corpus.ts';
import type { ExtractedClaim } from '../src/research/extraction.ts';
import type { ClaimTopic } from '../src/research/registry.ts';
import { liveCaptureV2 } from './pilot-a-live-v2.ts';

const UK = 'United Kingdom';

/** Same queries, same pages — only the extraction contract has changed. */
export const liveCaptureV3: CaptureFile = liveCaptureV2;

interface ClaimInput {
  id: string;
  claimText: string;
  passage: string;
  url: string;
  topic: ClaimTopic;
  publicationDate?: string;
  eventDate?: string;
  stated: ExtractedClaim['identityAttributes'];
  confidence: number;
  originId?: string;
}

function claim(input: ClaimInput): ExtractedClaim {
  return {
    id: input.id,
    claimText: input.claimText,
    supportingPassage: input.passage,
    sourceUrl: input.url,
    topic: input.topic,
    ...(input.publicationDate ? { publicationDate: input.publicationDate } : {}),
    ...(input.eventDate ? { eventDate: input.eventDate } : {}),
    identityAttributes: input.stated,
    extractionConfidence: input.confidence,
    ...(input.originId ? { originId: input.originId } : {}),
    // Page fetching remains blocked by the egress policy.
    verification: 'search_summary_only',
  };
}

const inf = (id: string, statement: string, derivedFrom: string[], reasoning: string): Inference => ({
  kind: 'inference',
  id,
  statement,
  derivedFrom,
  reasoning,
});

const hyp = (
  id: string,
  statement: string,
  derivedFrom: string[],
  reasoning: string,
  testableBy: string,
): Hypothesis => ({ kind: 'hypothesis', id, statement, derivedFrom, reasoning, testableBy });

export const liveExtractionsV3: ExtractionCorpus = {
  'maeving.com': {
    trigger: 'export_finance',
    whatChanged:
      '£3m UKEF-backed trade finance facility to build production capacity for the US, Germany and France, adding 13 jobs, against US sales already up fivefold year on year.',
    polarity: 'demand_increasing',
    polarityRationale:
      'Funded capacity expansion serving named export markets increases outbound consignment volume on a regulated cargo type.',
    consequence: {
      actionable: true,
      rationale: 'More cross-border consignments and more Class 9 documentation to produce.',
    },
    claims: [
      claim({
        id: 'v3-maeving-c1',
        claimText:
          'Maeving secured a £3m trade finance facility from HSBC UK, backed by UK Export Finance, to invest in production capacity for demand in the US, Germany and France, creating 13 new jobs at Coventry.',
        passage:
          'Coventry-based Maeving secured a £3m trade finance facility backed by UK Export Finance to meet growing demand in the US, Germany and France, creating 13 new jobs.',
        url: 'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
        topic: 'funding',
        publicationDate: '2026-08-15',
        eventDate: '2026-08-15',
        stated: {
          statedName: 'Maeving',
          statedGeography: { country: UK, town: 'Coventry' },
          statedIndustry: 'electric motorbike manufacturing',
        },
        confidence: 0.95,
        originId: 'ukef-maeving-release',
      }),
      claim({
        id: 'v3-maeving-c2',
        claimText:
          'Maeving began exporting to California, Germany and France in 2023, exports around half its bikes, and US sales have risen fivefold this year versus 2024 despite tariff-driven disruption.',
        passage:
          'Maeving started exporting to California, Germany and France in 2023 and exports around half its bikes; US sales have risen fivefold this year versus 2024 despite tariff-driven trade disruption.',
        url: 'https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/',
        topic: 'export_trade',
        publicationDate: '2026-08-15',
        eventDate: '2026-08-15',
        stated: {
          statedName: 'Maeving',
          statedGeography: { country: UK, town: 'Coventry' },
          statedIndustry: 'electric motorcycles',
        },
        confidence: 0.85,
      }),
    ],
    inferences: [
      inf(
        'v3-maeving-i1',
        'Consignment volume on established US and European lanes is rising steeply — fivefold on the US lane — with funded capacity behind it and tariff friction to manage.',
        ['v3-maeving-c1', 'v3-maeving-c2'],
        'The company reports the fivefold increase itself, and the facility funds the capacity to serve it.',
      ),
    ],
    hypothesis: hyp(
      'v3-maeving-h1',
      'Freight arrangements sized for 2023-era volumes are carrying several times that on a regulated cargo type, in a tariff environment — which is when rates, consolidation and DG documentation get reopened.',
      ['v3-maeving-i1'],
      'Growth of this rate on an existing lane changes how it should be shipped, even where a forwarder is already in place.',
      'Ask whether their current US arrangement was priced before the fivefold increase, and who handles the Class 9 paperwork.',
    ),
    owningFunction: {
      function: 'Operations / Supply Chain',
      rationale:
        'Export capacity and DG compliance sit with operations at this size; the trigger is a finance event but the freight decision is not.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Coventry manufacturer of physical goods, exporting around half its output, scaling on funded capacity.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'Maeving has exported since 2023 and ships roughly half its output, so an incumbent forwarder is near-certain — this is displacement, not greenfield.',
      },
    ],
    judgements: { icpFit: 22, signalStrength: 16, commercialRelevance: 13 },
    whyNow:
      'US sales are up fivefold year on year and in August 2026 Maeving took £3m of UKEF-backed finance to fund the capacity behind it. Arrangements set up when they started exporting in 2023 are now carrying several times the volume, through tariffs.',
    salesAngle:
      "Your US sales are up fivefold and you've just funded the capacity to go further. Worth checking whether your shipping was priced for 2023 volumes or today's — and we can look at the Class 9 battery documentation while we're there.",
  },

  'baltex.co.uk': {
    trigger: 'new_market_entry',
    whatChanged:
      'Targeting the USA following Boeing approval, alongside a seven-figure HSBC package funding EU trade flows and a stated 20% export growth target. Exports are already 60% of the business.',
    polarity: 'demand_increasing',
    polarityRationale:
      'A newly qualified US aerospace lane is freight that does not yet exist, on top of a stated 20% volume increase on existing routes.',
    consequence: {
      actionable: true,
      rationale: 'A greenfield export lane needs routing, customs and traceability arrangements made now.',
    },
    claims: [
      claim({
        id: 'v3-baltex-c1',
        claimText:
          'Baltex received a seven-figure HSBC UK package; TradePay supports EU imports and exports, with investment split between the UK and Poland.',
        passage:
          'Baltex, headquartered in Ilkeston, Derbyshire, received a seven-figure HSBC UK package; TradePay supports EU imports and exports; investment split between the UK and Poland.',
        url: 'https://www.themanufacturer.com/articles/baltex-secures-seven-figure-funding-to-drive-european-expansion/',
        topic: 'funding',
        publicationDate: '2026-07-20',
        eventDate: '2026-07-20',
        stated: {
          statedName: 'Baltex',
          statedGeography: { country: UK, region: 'Derbyshire', town: 'Ilkeston' },
          statedIndustry: 'technical textiles',
        },
        confidence: 0.9,
        originId: 'hsbc-baltex-release',
      }),
      claim({
        id: 'v3-baltex-c2',
        claimText:
          'Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months; exports are 60% of the business, with agents in Hong Kong, Italy, Finland and the USA.',
        passage:
          'Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months. Exports account for 60% of the business, with agents in Hong Kong, Italy, Finland and the USA.',
        url: 'https://knittingindustry.com/uks-baltex-accelerates-international-strategy/',
        topic: 'export_trade',
        publicationDate: '2026-07-20',
        eventDate: '2026-07-20',
        stated: {
          statedName: 'Baltex',
          statedGeography: { country: UK, town: 'Ilkeston' },
          statedIndustry: 'knitted technical textiles',
        },
        confidence: 0.85,
      }),
    ],
    inferences: [
      inf(
        'v3-baltex-i1',
        'A Boeing approval opens a US aerospace lane that did not previously exist, on top of a fifth more volume across EU and UK–Poland routes in a business already 60% export.',
        ['v3-baltex-c1', 'v3-baltex-c2'],
        'Aerospace qualification gates entry to that supply chain, and the company names the USA as a new target on the back of it.',
      ),
    ],
    hypothesis: hyp(
      'v3-baltex-h1',
      'A brand-new US aerospace lane needs freight and customs arrangements that do not exist yet, with traceability requirements beyond ordinary export paperwork.',
      ['v3-baltex-i1'],
      'New market entry is a genuinely greenfield freight requirement, unlike volume growth on an established lane.',
      'Ask whether US shipments have started and who handled the first ones — before it is handled this is open, after it is displacement.',
    ),
    owningFunction: {
      function: 'Supply Chain',
      rationale:
        'Dual-site UK/Poland manufacturing plus a new export destination puts routing and customs with supply chain.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Derbyshire technical textiles manufacturer, 60% export, UK and Polish production, newly opened US market.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'Multiple outlets carried this from one HSBC release — one independent source. At 60% export with agents in four territories, incumbent freight relationships certainly exist; only the US aerospace lane is genuinely new.',
      },
    ],
    judgements: { icpFit: 23, signalStrength: 18, commercialRelevance: 14 },
    whyNow:
      'Baltex has cleared Boeing approval and named the USA as a new target market, on top of a July 2026 HSBC package funding EU trade and a 20% export growth target. A US aerospace lane is a route they have not shipped before.',
    salesAngle:
      "Boeing approval opens a US lane you haven't run before. First shipments into an aerospace supply chain are where documentation and traceability trip people up — worth a conversation before the first one goes.",
  },

  'bramblefoods.co.uk': {
    trigger: 'new_premises',
    whatChanged:
      'Opened Lancaster House, a 67,000 sq ft main UK distribution hub, while continuing an acquisitive strategy (Whitakers Chocolates January 2025, The Bay Tree January 2024).',
    polarity: 'demand_increasing',
    polarityRationale:
      'The new hub closes the storage opportunity but a widening brand portfolio increases outbound despatch and seasonal peak load.',
    consequence: {
      actionable: true,
      rationale: 'Outbound haulage and Q4 overflow grow even though third-party storage does not.',
    },
    claims: [
      claim({
        id: 'v3-bramble-c1',
        claimText:
          'Bramble Foods opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park.',
        passage:
          'Bramble Foods of Market Harborough opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park.',
        url: 'https://www.ldc.co.uk/news/family-food-business-opens-landmark-distribution-centre/',
        topic: 'premises',
        publicationDate: '2026-07-31',
        eventDate: '2026-07-31',
        stated: {
          statedName: 'Bramble Foods',
          statedGeography: { country: UK, town: 'Market Harborough' },
          statedIndustry: 'fine food manufacturing and distribution',
        },
        confidence: 0.9,
      }),
      claim({
        id: 'v3-bramble-c2',
        claimText:
          'LDC-backed Bramble acquired Whitakers Chocolates in January 2025, having acquired The Bay Tree Food Co in January 2024.',
        passage:
          'LDC-backed Bramble acquired Yorkshire-based Whitakers Chocolates in January 2025, having acquired The Bay Tree Food Co in January 2024.',
        url: 'https://www.foodanddrinktechnology.com/news/57016/bramble-foods-group-expands-portfolio-with-acquisition-of-whitakers-chocolates/',
        topic: 'corporate_identity',
        publicationDate: '2025-01-15',
        eventDate: '2025-01-15',
        stated: {
          statedName: 'Bramble Foods Group',
          statedGeography: { country: UK, town: 'Market Harborough' },
          statedIndustry: 'food manufacturing',
        },
        confidence: 0.8,
      }),
      // Retained from the v1 capture, where an un-disambiguated query returned
      // it. Kept so the identity gate is exercised on real colliding data.
      claim({
        id: 'v3-bramble-c3',
        claimText: 'Brambles operates in 60 countries through its CHEP pallet-pooling brand.',
        passage:
          'Brambles operates in 60 countries through its CHEP brand, supplying pallets and reusable containers.',
        url: 'https://umbrex.com/resources/company-profiles/brambles-ltd/',
        topic: 'corporate_identity',
        eventDate: '2026-06-01',
        stated: {
          statedName: 'Brambles Ltd',
          statedGeography: { country: 'Australia' },
          statedIndustry: 'pallet pooling and supply chain logistics',
        },
        confidence: 0.75,
      }),
    ],
    inferences: [
      inf(
        'v3-bramble-i1',
        'Core warehousing is solved in-house, so storage is closed; what grows is outbound despatch across a widening brand portfolio.',
        ['v3-bramble-c1', 'v3-bramble-c2'],
        'A purpose-built main hub replaces third-party storage, but each acquired brand adds despatch volume through it.',
      ),
    ],
    hypothesis: hyp(
      'v3-bramble-h1',
      'The opportunity is outbound haulage and seasonal peak overflow rather than storage — a hub sized for the average will be tested by a food-gifting Q4 across three acquired brands.',
      ['v3-bramble-i1'],
      'Storage is the obvious pitch and it is exactly what they have just bought themselves out of.',
      'Ask what they did for overflow last November and whether Lancaster House changes that answer.',
    ),
    owningFunction: {
      function: 'Operations',
      rationale:
        'Despatch and capacity planning for the new hub sit with operations. Coverage names the MD, finance director and sales director but no operations owner — the recurring pattern.',
    },
    icpRelevance: {
      fits: true,
      rationale: 'PE-backed Leicestershire food manufacturer and distributor with pronounced seasonal peaks.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'The signal is a company solving its own warehousing problem, which closes the obvious storage pitch. Survives on peak overflow and outbound haulage.',
      },
    ],
    judgements: { icpFit: 20, signalStrength: 13, commercialRelevance: 11 },
    whyNow:
      'Bramble opened its main UK distribution hub on 31 July while integrating two acquisitions. The building is sized for the average; food gifting is not an average business in Q4.',
    salesAngle:
      "You've just opened Lancaster House, so storage isn't the conversation. Overflow and vehicles for the Christmas peak across three brands might be — and that's a September conversation, not a December one.",
  },

  'devolkitchens.com': {
    trigger: 'new_market_entry',
    whatChanged:
      'Established new overseas markets in Thailand, China and Denmark, with 31% of sales exported and overseas revenue up 2,300% over six years.',
    polarity: 'demand_increasing',
    polarityRationale:
      'Newly opened Asian and Nordic lanes require crating, consolidation and customs decisions the existing US-focused arrangement was not built for.',
    consequence: {
      actionable: true,
      rationale: 'New destinations mean new routing and packing decisions being made now.',
    },
    claims: [
      claim({
        id: 'v3-devol-c1',
        claimText:
          'deVOL has grown overseas revenue by 2,300% over six years, with 31% of sales exported, orders from over 35 countries, and new overseas markets established in Thailand, China and Denmark.',
        passage:
          'deVOL has grown overseas revenue by 2,300% over six years, with 31% of sales exported, orders from over 35 countries, and new overseas markets established in Thailand, China and Denmark.',
        url: 'https://www.devolkitchens.co.uk/blog/we-won-a-kings-award',
        topic: 'export_trade',
        publicationDate: '2026-05-06',
        eventDate: '2026-05-06',
        stated: {
          statedName: 'deVOL Kitchens',
          statedDomain: 'devolkitchens.co.uk',
          statedGeography: { country: UK, town: 'Loughborough' },
          statedIndustry: 'handmade kitchens',
        },
        confidence: 0.9,
      }),
      claim({
        id: 'v3-devol-c2',
        claimText: 'Every deVOL kitchen is still made in Leicestershire, at Cotes Mill, Loughborough.',
        passage: 'deVOL Kitchens, Cotes Mill, Loughborough — every kitchen still made in Leicestershire.',
        url: 'https://www.devolkitchens.com/about/our-story',
        topic: 'corporate_identity',
        stated: {
          statedName: 'deVOL Kitchens',
          statedDomain: 'devolkitchens.com',
          statedGeography: { country: UK, town: 'Loughborough' },
          statedIndustry: 'kitchen manufacturing',
        },
        confidence: 0.95,
      }),
      claim({
        id: 'v3-devol-c3',
        claimText:
          'deVOL Kitchens bought the 40,000 sq ft former Karl Mayer factory on Kings Road, Shepshed for £1.95m.',
        passage:
          'deVOL Kitchens of Loughborough bought the 40,000 sq ft former Karl Mayer factory on Kings Road, Shepshed for £1.95m.',
        url: 'https://www.matherjamie.co.uk/latest-news/luxury-kitchen-supplier-s-expansion-is-a-recipe-for-success/',
        topic: 'premises',
        stated: {
          statedName: 'deVOL Kitchens',
          statedGeography: { country: UK, town: 'Loughborough' },
          statedIndustry: 'luxury kitchens',
        },
        confidence: 0.7,
      }),
    ],
    inferences: [
      inf(
        'v3-devol-i1',
        'New lanes to Thailand, China and Denmark have been opened recently, alongside an established US flow, for bulky fragile cabinetry made in Leicestershire.',
        ['v3-devol-c1', 'v3-devol-c2'],
        'The company names those three as newly established markets, distinct from the mature US business, and confirms all production remains in Leicestershire.',
      ),
    ],
    hypothesis: hyp(
      'v3-devol-h1',
      'Newly opened Asian and Nordic lanes mean crating, consolidation and customs decisions being made now for destinations the existing US-focused arrangement was not built for.',
      ['v3-devol-i1'],
      'Route economics and packing standards that work for New York do not transfer to Bangkok or Shanghai.',
      'Ask who is handling the Thailand and China consignments and whether that is the same arrangement as the US.',
    ),
    owningFunction: {
      function: 'Operations / Logistics',
      rationale: 'Export despatch and packing standards sit with operations, not the showroom side.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Loughborough manufacturer of bulky, fragile, high-value goods exporting 31% of sales, two miles from the client.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'A long-established exporter with 31% of sales overseas certainly has incumbent forwarders. The new-market element is what is fresh; the award itself is not a trigger.',
      },
      {
        severity: 'caveat',
        note: 'The Shepshed factory purchase is undated in available sources and is carried as context, not as the trigger.',
      },
    ],
    judgements: { icpFit: 23, signalStrength: 15, commercialRelevance: 13 },
    whyNow:
      'deVOL has established new overseas markets in Thailand, China and Denmark on top of 31% of sales already exported. Those are lanes nobody has set up yet, for a product where crating decides whether it arrives saleable.',
    salesAngle:
      "You've opened Thailand, China and Denmark on top of the US business. Those routes crate and consolidate differently to New York — and we're at the other end of Loughborough if you want someone to look at a load before it ships.",
  },

  // Researched with disambiguated queries; a company record and a FY2023
  // filing, neither of which is a current commercial change.
  'nmsinfrastructure.com': null,

  // Researched. Every event found dates from 2015-2023.
  'winbrogroup.com': null,

  'slackandparr.com': {
    trigger: 'contraction',
    whatChanged:
      'Considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, tariffs in new export markets and rising domestic costs.',
    polarity: 'demand_reducing',
    polarityRationale:
      'Falling overseas demand and an active cost reduction mean fewer shipments, not more — the change is real and current but points the wrong way for a freight forwarder.',
    consequence: {
      actionable: false,
      rationale:
        'Export volumes are contracting and cost is being cut, so freight demand is falling — there is nothing here for a freight forwarder to sell into. Recorded as a real, current signal with negative polarity rather than discarded: a cost-reduction or restructuring vendor would read the same change as an opportunity.',
    },
    claims: [
      claim({
        id: 'v3-slackparr-c1',
        claimText:
          'Slack & Parr is considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, tariffs in new export markets, and significant increases in domestic business costs.',
        passage:
          'Slack & Parr is considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, the imposition of tariffs in new export markets, and significant increases in domestic business costs.',
        url: 'https://www.insidermedia.com/news/midlands/slack-parr-weighs-up-jobs-losses-at-kegworth-facility',
        topic: 'restructuring',
        publicationDate: '2026-08-20',
        eventDate: '2026-08-20',
        stated: {
          statedName: 'Slack & Parr',
          statedGeography: { country: UK, town: 'Kegworth' },
          statedIndustry: 'precision pump manufacturing',
        },
        confidence: 0.9,
      }),
    ],
    inferences: [
      inf(
        'v3-slackparr-i1',
        'Export volumes to their principal overseas markets are falling, not rising, and the cost base is under active reduction.',
        ['v3-slackparr-c1'],
        'Redundancy consultation attributed to slowing overseas investment and tariffs describes contracting trade.',
      ),
    ],
    hypothesis: hyp(
      'v3-slackparr-h1',
      'Shipping volume is contracting and cost is being cut, so this is a supplier-squeeze situation rather than a buying situation for a freight forwarder.',
      ['v3-slackparr-i1'],
      'A company reducing headcount because export demand fell is not about to add a logistics supplier.',
      'Revisit if export volumes recover or the restructure completes and growth resumes.',
    ),
    owningFunction: {
      function: 'Operations',
      rationale: 'Would own freight if there were freight growth to own; recorded for completeness.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Kegworth precision manufacturer five miles from the client — the profile fits, which is exactly why the negative polarity matters.',
    },
    contradictions: [],
    judgements: { icpFit: 21, signalStrength: 0, commercialRelevance: 0 },
    whyNow: 'n/a — current and well-sourced, but demand-reducing for this client.',
    salesAngle: 'n/a — do not approach on a growth premise.',
  },
};
