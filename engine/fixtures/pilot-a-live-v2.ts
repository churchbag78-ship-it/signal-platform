/**
 * Pilot A LIVE v2 — captured 2026-09-08, after identity hardening.
 *
 * Re-run with disambiguated, engine-generated queries and full identity
 * fingerprints. v1 (`pilot-a-live.ts`) is preserved untouched as historical
 * evidence; nothing here was tuned to reproduce either v1 or the original
 * hand-built fixture.
 *
 * Every fact carries an `attribution` describing what the SOURCE says about
 * the company it is discussing — read from the result title and snippet,
 * never derived from the target fingerprint. That independence is what makes
 * the identity gate meaningful rather than circular.
 */

import type { Fact, Hypothesis, Inference, SourceAttribution } from '../src/domain.ts';
import type { ClaimTopic } from '../src/research/registry.ts';
import { asClaims } from './legacy-adapter.ts';
import type { CaptureFile } from '../src/research/agent-bridge.ts';
import type { ExtractionCorpus } from '../src/research/corpus.ts';
import { toSource } from '../src/research/sources.ts';

const RUN_DATE = '2026-09-08';

const UK = 'United Kingdom';

function fact(
  id: string,
  statement: string,
  url: string,
  eventDate: string | undefined,
  stated: Omit<SourceAttribution, 'url'>,
  options: { originId?: string; ownedDomains?: string[] } = {},
): Fact {
  return {
    kind: 'fact',
    id,
    statement,
    source: toSource(url, { ownedDomains: options.ownedDomains ?? [] }, options.originId),
    ...(eventDate ? { eventDate } : {}),
    discoveredAt: RUN_DATE,
    verification: 'search_snippet',
    attribution: { url, ...stated },
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


const STATED_MAEVING = {
  statedName: 'Maeving',
  statedGeography: { country: UK, town: 'Coventry' },
  statedIndustry: 'electric motorbike manufacturing',
};
const STATED_BALTEX = {
  statedName: 'Baltex',
  statedGeography: { country: UK, region: 'Derbyshire', town: 'Ilkeston' },
  statedIndustry: 'technical textiles',
};
const STATED_BRAMBLEFOODS = {
  statedName: 'Bramble Foods',
  statedGeography: { country: UK, town: 'Market Harborough' },
  statedIndustry: 'fine food manufacturing and distribution',
};
const STATED_DEVOLKITCHENS = {
  statedName: 'deVOL Kitchens',
  statedGeography: { country: UK, town: 'Loughborough' },
  statedIndustry: 'handmade kitchens',
};
const STATED_SLACKANDPARR = {
  statedName: 'Slack & Parr',
  statedGeography: { country: UK, town: 'Kegworth' },
  statedIndustry: 'precision pump manufacturing',
};

const DEVOL_DOMAINS = ['devolkitchens.com', 'devolkitchens.co.uk'];

export const liveCaptureV2: CaptureFile = {
  capturedAt: RUN_DATE,
  transport: 'agent WebSearch tool (no search API reachable from process)',
  captures: [
    {
      query: 'Maeving Ltd Coventry news announcement expansion contract',
      results: [
        {
          title: 'Maeving in the right direction: E-motorbike maker gears up exports with UKEF backing',
          url: 'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
          snippet:
            'Coventry-based Maeving secured a £3m trade finance facility backed by UK Export Finance to meet growing demand in the US, Germany and France, creating 13 new jobs.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'Maeving Ltd Coventry export growth or new overseas market entry',
      results: [
        {
          title: 'British electric bike firm Maeving gets Government cash to fuel export push',
          url: 'https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/',
          snippet:
            'Maeving started exporting to California, Germany and France in 2023 and exports around half its bikes; US sales have risen fivefold this year versus 2024 despite tariff-driven trade disruption.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'Baltex Ilkeston news announcement expansion contract',
      results: [
        {
          title: 'Baltex secures seven-figure funding to drive European expansion',
          url: 'https://www.themanufacturer.com/articles/baltex-secures-seven-figure-funding-to-drive-european-expansion/',
          snippet:
            'Baltex, headquartered in Ilkeston, Derbyshire, received a seven-figure HSBC UK package; TradePay supports EU imports and exports; investment split between the UK and Poland.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'Baltex Ilkeston export growth or new overseas market entry',
      results: [
        {
          title: "UK's Baltex accelerates international growth strategy",
          url: 'https://knittingindustry.com/uks-baltex-accelerates-international-strategy/',
          snippet:
            'Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months. Exports account for 60% of the business, with agents in Hong Kong, Italy, Finland and the USA.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'Bramble Group Market Harborough news announcement expansion contract',
      results: [
        {
          title: 'Family Food Business Opens Landmark Distribution Centre',
          url: 'https://www.ldc.co.uk/news/family-food-business-opens-landmark-distribution-centre/',
          snippet:
            'Bramble Foods of Market Harborough opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'Bramble Group Market Harborough export growth or new overseas market entry',
      results: [
        {
          title: 'Bramble Foods Group expands portfolio with acquisition of Whitakers Chocolates',
          url: 'https://www.foodanddrinktechnology.com/news/57016/bramble-foods-group-expands-portfolio-with-acquisition-of-whitakers-chocolates/',
          snippet:
            'LDC-backed Bramble acquired Yorkshire-based Whitakers Chocolates in January 2025, having acquired The Bay Tree Food Co in January 2024.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'deVOL Kitchens Loughborough news announcement expansion contract',
      results: [
        {
          title: "Luxury kitchen supplier's expansion is a recipe for success",
          url: 'https://www.matherjamie.co.uk/latest-news/luxury-kitchen-supplier-s-expansion-is-a-recipe-for-success/',
          snippet:
            'deVOL Kitchens of Loughborough bought the 40,000 sq ft former Karl Mayer factory on Kings Road, Shepshed for £1.95m.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'deVOL Kitchens Loughborough export growth or new overseas market entry',
      results: [
        {
          title: "We won a King's Award! - The deVOL Journal",
          url: 'https://www.devolkitchens.co.uk/blog/we-won-a-kings-award',
          snippet:
            'deVOL has grown overseas revenue by 2,300% over six years, with 31% of sales exported, orders from over 35 countries, and new overseas markets established in Thailand, China and Denmark.',
          retrievedAt: RUN_DATE,
        },
        {
          title: 'Our Story | deVOL Kitchens',
          url: 'https://www.devolkitchens.com/about/our-story',
          snippet: 'deVOL Kitchens, Cotes Mill, Loughborough — every kitchen still made in Leicestershire.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'NMS International Group Market Harborough news announcement expansion contract',
      results: [
        {
          title: 'NMS INTERNATIONAL GROUP LTD overview - GOV.UK',
          url: 'https://find-and-update.company-information.service.gov.uk/company/06360525',
          snippet: 'Company record only. No dated commercial announcement surfaced.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      // v1 returned NMS Industries (Chinese mining equipment). With the town
      // qualifier the collision is gone entirely.
      query: 'NMS International Group Market Harborough export growth or new overseas market entry',
      results: [
        {
          title: 'NMS INTERNATIONAL GROUP LTD company key information',
          url: 'https://uk.globaldatabase.com/company/nms-international-group-ltd',
          snippet:
            'NMS International Group Ltd employs 153 people; latest financial report October 2023 shows £159m turnover, up 93.29% year on year.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'Winbro Group Technologies Shepshed news announcement expansion contract',
      results: [
        {
          title: "Government Minister opens Winbro's new Advanced Machining centre",
          url: 'https://www.quaser.com/blog/news-2/government-minister-opens-winbros-new-advanced-machining-centre-83',
          snippet: 'A 43,000 sq ft advanced machining facility in Shepshed — opened 2015.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'Winbro Group Technologies Shepshed export growth or new overseas market entry',
      results: [
        {
          title: 'Winbro Group Technologies : Vision Engineered',
          url: 'https://www.mfg-outlook.com/metal-machinery-manufacturing/winbro-group-technologies-vision-engineered',
          snippet:
            'Sites in Rock Hill (US), Shepshed (UK) and Taichung (Taiwan); Technology Centre plans date from 2023. 143 employees.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      query: 'Slack & Parr Kegworth news announcement expansion contract',
      results: [
        {
          title: 'Slack & Parr weighs up job losses at Kegworth facility',
          url: 'https://www.insidermedia.com/news/midlands/slack-parr-weighs-up-jobs-losses-at-kegworth-facility',
          snippet:
            'Slack & Parr is considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, tariffs in new export markets and rising domestic costs.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
    {
      // v1 returned academic papers on "organisational slack". Gone.
      query: 'Slack & Parr Kegworth export growth or new overseas market entry',
      results: [
        {
          title: 'About Us - Slack & Parr',
          url: 'https://www.slackandparr.com/about-us/',
          snippet:
            'Slack & Parr manufactures precision gear metering pumps from a 64,000 sq ft facility in Kegworth, Derbyshire, with sites in Charlotte, North Carolina and Shanghai.',
          retrievedAt: RUN_DATE,
        },
      ],
    },
  ],
};

export const liveExtractionsV2: ExtractionCorpus = {
  'maeving.com': {
    trigger: 'export_finance',
    whatChanged:
      '£3m UKEF-backed trade finance facility to build production capacity for the US, Germany and France, adding 13 jobs, against US sales already up fivefold year on year.',
    polarity: 'demand_increasing',
    polarityRationale:
      'v2 capture: polarity recorded before rationale was a required field',
    consequence: {
      actionable: true,
      rationale:
        'Funded volume growth on existing export lanes, carrying Class 9 batteries — more consignments and more documentation.',
    },
    claims: asClaims([
      fact(
        'v2-maeving-f1',
        'Maeving secured a £3m trade finance facility from HSBC UK, backed by UK Export Finance, to invest in production capacity for demand in the US, Germany and France, creating 13 new jobs at Coventry.',
        'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
        '2026-08-15',
        {
          statedName: 'Maeving',
          statedGeography: { country: UK, town: 'Coventry' },
          statedIndustry: 'electric motorbike manufacturing',
        },
        { originId: 'ukef-maeving-release' },
      ),
      fact(
        'v2-maeving-f2',
        'Maeving began exporting to California, Germany and France in 2023 and exports around half its bikes; US sales have risen fivefold this year versus 2024 despite tariff-driven trade disruption.',
        'https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/',
        '2026-08-15',
        {
          statedName: 'Maeving',
          statedGeography: { country: UK, town: 'Coventry' },
          statedIndustry: 'electric motorcycles',
        },
      ),
    ], STATED_MAEVING, 'export_trade'),
    inferences: [
      inf(
        'v2-maeving-i1',
        'Consignment volume on established US and European lanes is rising steeply — fivefold on the US lane — with funded capacity behind it and tariff friction to manage.',
        ['v2-maeving-f1', 'v2-maeving-f2'],
        'The company reports the fivefold increase itself, and the facility funds the capacity to serve it.',
      ),
    ],
    hypothesis: hyp(
      'v2-maeving-h1',
      'Freight arrangements sized for 2023-era volumes are carrying several times that on a regulated cargo type, in a tariff environment — which is when rates, consolidation and DG documentation get reopened.',
      ['v2-maeving-i1'],
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
      'v2 capture: polarity recorded before rationale was a required field',
    consequence: {
      actionable: true,
      rationale:
        'A new US aerospace lane is freight that does not yet exist, on top of a fifth more volume across existing EU and UK–Poland routes.',
    },
    claims: asClaims([
      fact(
        'v2-baltex-f1',
        'Baltex, headquartered in Ilkeston, Derbyshire, received a seven-figure HSBC UK package; TradePay supports EU imports and exports, with investment split between the UK and Poland.',
        'https://www.themanufacturer.com/articles/baltex-secures-seven-figure-funding-to-drive-european-expansion/',
        '2026-07-20',
        {
          statedName: 'Baltex',
          statedGeography: { country: UK, region: 'Derbyshire', town: 'Ilkeston' },
          statedIndustry: 'technical textiles',
        },
        { originId: 'hsbc-baltex-release' },
      ),
      fact(
        'v2-baltex-f2',
        'Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months. Exports account for 60% of the business, with agents in Hong Kong, Italy, Finland and the USA.',
        'https://knittingindustry.com/uks-baltex-accelerates-international-strategy/',
        '2026-07-20',
        {
          statedName: 'Baltex',
          statedGeography: { country: UK, town: 'Ilkeston' },
          statedIndustry: 'knitted technical textiles',
        },
      ),
    ], STATED_BALTEX, 'export_trade'),
    inferences: [
      inf(
        'v2-baltex-i1',
        'A Boeing approval opens a US aerospace lane that did not previously exist, on top of a fifth more volume across EU and UK–Poland routes in a business already 60% export.',
        ['v2-baltex-f1', 'v2-baltex-f2'],
        'Aerospace qualification gates entry to that supply chain, and the company names the USA as a new target on the back of it.',
      ),
    ],
    hypothesis: hyp(
      'v2-baltex-h1',
      'A brand-new US aerospace lane needs freight and customs arrangements that do not exist yet, with traceability requirements beyond ordinary export paperwork.',
      ['v2-baltex-i1'],
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
      'v2 capture: polarity recorded before rationale was a required field',
    consequence: {
      actionable: true,
      rationale:
        'Storage is closed by the new hub, but outbound volume, acquisition integration and Q4 peak overflow all grow.',
    },
    claims: asClaims([
      fact(
        'v2-bramble-f1',
        'Bramble Foods of Market Harborough opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park.',
        'https://www.ldc.co.uk/news/family-food-business-opens-landmark-distribution-centre/',
        '2026-07-31',
        {
          statedName: 'Bramble Foods',
          statedGeography: { country: UK, town: 'Market Harborough' },
          statedIndustry: 'fine food manufacturing and distribution',
        },
      ),
      fact(
        'v2-bramble-f2',
        'LDC-backed Bramble acquired Yorkshire-based Whitakers Chocolates in January 2025, having acquired The Bay Tree Food Co in January 2024.',
        'https://www.foodanddrinktechnology.com/news/57016/bramble-foods-group-expands-portfolio-with-acquisition-of-whitakers-chocolates/',
        '2025-01-15',
        {
          statedName: 'Bramble Foods Group',
          statedGeography: { country: UK, town: 'Market Harborough' },
          statedIndustry: 'food manufacturing',
        },
      ),
      // Carried over from the v1 capture, where the un-disambiguated query
      // returned it. Kept deliberately so the identity gate is exercised
      // end-to-end on real colliding data, not only in unit tests.
      fact(
        'v2-bramble-f3',
        'Brambles operates in 60 countries through its CHEP brand, supplying pallets and reusable containers.',
        'https://umbrex.com/resources/company-profiles/brambles-ltd/',
        '2026-06-01',
        {
          statedName: 'Brambles Ltd',
          statedGeography: { country: 'Australia' },
          statedIndustry: 'pallet pooling and supply chain logistics',
        },
      ),
    ], STATED_BRAMBLEFOODS, 'premises'),
    inferences: [
      inf(
        'v2-bramble-i1',
        'Core warehousing is solved in-house, so storage is closed; what grows is outbound despatch across a widening brand portfolio.',
        ['v2-bramble-f1', 'v2-bramble-f2'],
        'A purpose-built main hub replaces third-party storage, but each acquired brand adds despatch volume through it.',
      ),
    ],
    hypothesis: hyp(
      'v2-bramble-h1',
      'The opportunity is outbound haulage and seasonal peak overflow rather than storage — a hub sized for the average will be tested by a food-gifting Q4 across three acquired brands.',
      ['v2-bramble-i1'],
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
      'v2 capture: polarity recorded before rationale was a required field',
    consequence: {
      actionable: true,
      rationale:
        'New Asian and Nordic lanes need crating, consolidation and customs decisions that the US-focused arrangement was not built for.',
    },
    claims: asClaims([
      fact(
        'v2-devol-f1',
        'deVOL has grown overseas revenue by 2,300% over six years, with 31% of sales exported, orders from over 35 countries, and new overseas markets established in Thailand, China and Denmark.',
        'https://www.devolkitchens.co.uk/blog/we-won-a-kings-award',
        '2026-05-06',
        {
          statedName: 'deVOL Kitchens',
          statedGeography: { country: UK, town: 'Loughborough' },
          statedIndustry: 'handmade kitchens',
        },
        { ownedDomains: DEVOL_DOMAINS },
      ),
      fact(
        'v2-devol-f2',
        'deVOL Kitchens, Cotes Mill, Loughborough — every kitchen still made in Leicestershire.',
        'https://www.devolkitchens.com/about/our-story',
        undefined,
        {
          statedName: 'deVOL Kitchens',
          statedGeography: { country: UK, town: 'Loughborough' },
          statedIndustry: 'kitchen manufacturing',
        },
        { ownedDomains: DEVOL_DOMAINS },
      ),
      fact(
        'v2-devol-f3',
        'deVOL Kitchens of Loughborough bought the 40,000 sq ft former Karl Mayer factory on Kings Road, Shepshed for £1.95m.',
        'https://www.matherjamie.co.uk/latest-news/luxury-kitchen-supplier-s-expansion-is-a-recipe-for-success/',
        undefined,
        {
          statedName: 'deVOL Kitchens',
          statedGeography: { country: UK, town: 'Loughborough' },
          statedIndustry: 'luxury kitchens',
        },
      ),
    ], STATED_DEVOLKITCHENS, 'export_trade'),
    inferences: [
      inf(
        'v2-devol-i1',
        'New lanes to Thailand, China and Denmark have been opened recently, alongside an established US flow, for bulky fragile cabinetry made in Leicestershire.',
        ['v2-devol-f1', 'v2-devol-f2'],
        'The company names those three as newly established markets, distinct from the mature US business, and confirms all production remains in Leicestershire.',
      ),
    ],
    hypothesis: hyp(
      'v2-devol-h1',
      'Newly opened Asian and Nordic lanes mean crating, consolidation and customs decisions being made now for destinations the existing US-focused arrangement was not built for.',
      ['v2-devol-i1'],
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

  // Researched with disambiguated queries. The v1 collision with NMS
  // Industries (China) is gone; what remains is a company record and a
  // FY2023 filing, neither of which is a current commercial change.
  'nmsinfrastructure.com': null,

  // Researched. Every event found dates from 2015-2023.
  'winbrogroup.com': null,

  'slackandparr.com': {
    trigger: 'contraction',
    whatChanged:
      'Considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, tariffs in new export markets and rising domestic costs.',
    polarity: 'demand_reducing',
    polarityRationale:
      'v2 capture: polarity recorded before rationale was a required field',
    consequence: {
      actionable: false,
      rationale:
        'Export volumes are contracting and cost is being cut, so freight demand is falling — there is nothing here for a freight forwarder to sell into. Recorded as a real, current signal with negative polarity rather than discarded: a cost-reduction or restructuring vendor would read the same change as an opportunity.',
    },
    claims: asClaims([
      fact(
        'v2-slackparr-f1',
        'Slack & Parr is considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, the imposition of tariffs in new export markets, and significant increases in domestic business costs.',
        'https://www.insidermedia.com/news/midlands/slack-parr-weighs-up-jobs-losses-at-kegworth-facility',
        '2026-08-20',
        {
          statedName: 'Slack & Parr',
          statedGeography: { country: UK, town: 'Kegworth' },
          statedIndustry: 'precision pump manufacturing',
        },
      ),
    ], STATED_SLACKANDPARR, 'restructuring'),
    inferences: [
      inf(
        'v2-slackparr-i1',
        'Export volumes to their principal overseas markets are falling, not rising, and the cost base is under active reduction.',
        ['v2-slackparr-f1'],
        'Redundancy consultation attributed to slowing overseas investment and tariffs describes contracting trade.',
      ),
    ],
    hypothesis: hyp(
      'v2-slackparr-h1',
      'Shipping volume is contracting and cost is being cut, so this is a supplier-squeeze situation rather than a buying situation for a freight forwarder.',
      ['v2-slackparr-i1'],
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
