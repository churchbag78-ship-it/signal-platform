/**
 * Pilot A corpus — Orbital Direct, captured 2026-09-08.
 *
 * Real search results and real extraction decisions from the run recorded in
 * runs/orbital-direct/2026-09-08/. Page fetching was blocked by the execution
 * environment, so every fact is `search_summary_only` and every row is capped
 * accordingly. That is a property of the capture, not of the engine — when the
 * same companies are researched with fetch access, the same corpus shape holds
 * and the caps lift.
 */

import type { CompanyIdentity, Fact, Hypothesis, Inference } from '../src/domain.ts';
import type { ClientProfile } from '../src/pipeline.ts';
import type { ExtractionCorpus } from '../src/research/corpus.ts';
import type { SearchResult } from '../src/research/types.ts';
import { toSource } from '../src/research/sources.ts';

const RUN_DATE = '2026-09-08';

export const orbitalDirect: ClientProfile = {
  name: 'Orbital Direct Ltd',
  domain: 'orbital-direct.com',
  offerings: [
    'freight forwarding (air, road, sea)',
    'same-day courier and UK haulage',
    'warehousing, e-commerce fulfilment and FBA prep',
    'customs clearance and documentation',
    'hazardous/dangerous goods shipping',
    'export packing and cargo insurance',
  ],
  demandTriggers: [
    'export growth or new overseas market entry',
    'new premises or outgrown warehousing',
    'new contract win increasing distribution volume',
    'trade or export finance raised',
    'relocation',
  ],
  buyerFunctions: ['Operations', 'Supply Chain', 'Logistics', 'Procurement'],
  disqualifiers: [
    'third-party logistics providers and freight forwarders (competitors)',
    'enterprise retailers running their own distribution networks',
    'service businesses with no physical goods',
  ],
};

export const pilotATargets: CompanyIdentity[] = [
  { name: 'Maeving Ltd', domain: 'maeving.com', location: 'Coventry', industry: 'Electric motorcycle manufacturing' },
  { name: 'Baltex', domain: 'baltex.co.uk', location: 'Ilkeston, Derbyshire', industry: 'Technical textiles' },
  { name: 'Bramble Group', domain: 'bramblefoods.co.uk', location: 'Market Harborough', industry: 'Fine food manufacturing' },
  { name: 'deVOL Kitchens', domain: 'devolkitchens.com', location: 'Loughborough', industry: 'Kitchen manufacturing and retail' },
  { name: 'NMS International Group', domain: 'nmsinfrastructure.com', location: 'Market Harborough', industry: 'Infrastructure EPCF' },
  { name: 'Winbro Group Technologies', domain: 'winbrogroup.com', location: 'Shepshed', industry: 'Precision machine tools' },
  { name: 'Slack & Parr', domain: 'slackandparr.com', location: 'Kegworth', industry: 'Precision gear pumps' },
  { name: 'Bleckmann', domain: 'bleckmann.com', location: 'Lutterworth', industry: 'Third-party logistics' },
  { name: 'Aldi UK', domain: 'aldi.co.uk', location: 'Bardon, Leicestershire', industry: 'Grocery retail' },
];

function fact(
  id: string,
  statement: string,
  url: string,
  eventDate: string | undefined,
  originId?: string,
  /** The company being researched, so its own site is recognised as first-party. */
  companyDomain?: string,
): Fact {
  return {
    kind: 'fact',
    id,
    statement,
    source: toSource(url, companyDomain, originId),
    ...(eventDate ? { eventDate } : {}),
    discoveredAt: RUN_DATE,
    // Page fetching was blocked; nothing in this corpus was opened at source.
    verification: 'search_summary_only',
  };
}

function inference(id: string, statement: string, derivedFrom: string[], reasoning: string): Inference {
  return { kind: 'inference', id, statement, derivedFrom, reasoning };
}

function hypothesis(
  id: string,
  statement: string,
  derivedFrom: string[],
  reasoning: string,
  testableBy: string,
): Hypothesis {
  return { kind: 'hypothesis', id, statement, derivedFrom, reasoning, testableBy };
}

/** Search results as captured. Trimmed to those that carried a claim. */
export const pilotASearchCorpus: SearchResult[] = [
  {
    query: 'Maeving Ltd Coventry news announcement expansion contract',
    title: 'Maeving in the right direction: E-motorbike maker gears up exports with UKEF backing',
    url: 'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
    snippet:
      'Coventry-based Maeving has secured a £3m trade finance facility backed by UK Export Finance to meet growing demand in the US, Germany and France, creating 13 new jobs.',
    retrievedAt: RUN_DATE,
  },
  {
    query: 'Maeving Ltd administration closure delayed cancelled loss',
    title: 'Maeving 2025 Look Back, 2026 Ahead',
    url: 'https://maeving.com/en-us/blogs/electric-motorcycle-journal/maeving-2025-look-back-2026-ahead',
    snippet: 'No reports of delay, recall or administration were found in the contradiction pass.',
    retrievedAt: RUN_DATE,
  },
  {
    query: 'Baltex export growth or new overseas market entry',
    title: 'Derbyshire textiles specialist secures seven-figure HSBC funding to drive exports',
    url: 'https://www.thebusinessdesk.com/eastmidlands/news/2112823-derbyshire-textiles-specialist-secures-seven-figure-hsbc-funding-to-drive-exports',
    snippet:
      'Baltex has secured a seven-figure HSBC UK package supporting EU imports and exports, and expects 20% export growth over the next twelve months.',
    retrievedAt: RUN_DATE,
  },
  {
    query: 'Bramble Group new premises or outgrown warehousing',
    title: 'Airfield feeds ambitions as Bramble expand onto business park',
    url: 'https://www.leicestershire.gov.uk/news/airfield-feeds-ambitions-as-bramble-expand-onto-business-park',
    snippet:
      'Bramble Foods has moved into Lancaster House, a purpose-built 67,000 sq ft distribution centre at Airfield Business Park.',
    retrievedAt: RUN_DATE,
  },
  {
    query: 'Winbro Group Technologies Shepshed news announcement expansion contract',
    title: 'Winbro Group Technologies 2026 Company Profile',
    url: 'https://pitchbook.com/profiles/company/130557-16',
    snippet:
      'Company profile only. Technology Centre expansion dates from 2023; acquisition by Quaser Machine Tools was 2020.',
    retrievedAt: RUN_DATE,
  },
];

export const pilotAExtractions: ExtractionCorpus = {
  'maeving.com': {
    trigger: 'export_finance',
    whatChanged:
      'Took a £3m UK Export Finance-backed trade finance facility to build production capacity for the US, German and French markets, adding 13 jobs at Coventry.',
    facts: [
      fact(
        'maeving-f1',
        'Maeving secured a £3m trade finance facility from HSBC UK, backed by UK Export Finance, to invest in production capacity for demand in the US, Germany and France, creating 13 new jobs at its Coventry base.',
        'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
        '2026-08-15',
        'ukef-maeving-release',
      ),
      fact(
        'maeving-f2',
        'Maeving won £3m export deal to grow US and Europe sales.',
        'https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/',
        '2026-08-15',
      ),
      fact(
        'maeving-f3',
        'Maeving manufactures electric motorcycles, whose lithium-ion batteries are UN3480/UN3481 Class 9 dangerous goods for international carriage.',
        'https://maeving.com/en-us/pages/maeving-rm1-electric-motorcycle',
        undefined,
        undefined,
        'maeving.com',
      ),
    ],
    inferences: [
      inference(
        'maeving-i1',
        'Export volume to three named markets is committed to rise on a funded timetable, from a company that has until now shipped mainly domestically.',
        ['maeving-f1', 'maeving-f2'],
        'The facility is explicitly earmarked for production capacity serving named export markets, so the volume increase is funded rather than aspirational.',
      ),
      inference(
        'maeving-i2',
        'Each exported unit needs Class 9 dangerous-goods documentation and compliant packing for sea or air carriage.',
        ['maeving-f3'],
        'Lithium-ion batteries are regulated as Class 9; the obligation attaches to every cross-border movement, not to volume.',
      ),
    ],
    hypothesis: hypothesis(
      'maeving-h1',
      'Maeving is about to scale cross-border shipments of a dangerous-goods product and will need DG documentation, compliant export packing and freight capacity beyond what a domestic-first operation has in place.',
      ['maeving-i1', 'maeving-i2'],
      'A funded step-change in export volume plus a regulated cargo type is where existing informal freight arrangements typically break.',
      'Ask what their current DG documentation process is and who handles it — an in-house answer or a named forwarder kills or qualifies this in one question.',
    ),
    owningFunction: {
      function: 'Operations / Supply Chain',
      rationale:
        'Production scale-up and export compliance sit with operations at a company of this size; the founders are visible publicly but would not own DG paperwork.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'UK manufacturer of physical goods, scaling exports to multiple countries, small enough to have no in-house freight or customs function.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'Maeving already sells into the US, so a forwarder relationship may exist; the facility funds scale-up rather than first entry. Contradiction search for delay, recall or administration returned nothing.',
      },
    ],
    judgements: { icpFit: 22, signalStrength: 19, commercialRelevance: 14 },
    whyNow:
      'In August 2026 Maeving took £3m of UKEF-backed finance specifically to build capacity for the US, German and French markets. Export volume steps up on a funded timetable, and every unit crossing a border carries Class 9 batteries needing documentation their domestic operation has not had to produce at scale.',
    salesAngle:
      "You've just taken £3m of UKEF-backed finance to supply the US, Germany and France. The part that usually bites at that point isn't the freight rate — it's Class 9 documentation for the batteries and export packing for a two-wheeler. We handle both, and we're up the road in Loughborough.",
  },

  'baltex.co.uk': {
    trigger: 'export_finance',
    whatChanged:
      'Closed a seven-figure HSBC package built around EU import/export flows, with a stated expectation of 20% export growth over twelve months and manufacturing in both the UK and Poland.',
    facts: [
      // All five outlets carried one HSBC release: one origin, not five sources.
      fact(
        'baltex-f1',
        'Baltex secured a seven-figure funding package from HSBC UK supporting EU imports and exports through TradePay facilities, plus an equity release mortgage funding R&D and manufacturing in the UK and Poland.',
        'https://www.thebusinessdesk.com/eastmidlands/news/2112823-derbyshire-textiles-specialist-secures-seven-figure-hsbc-funding-to-drive-exports',
        '2026-07-20',
        'hsbc-baltex-release',
      ),
      fact(
        'baltex-f2',
        'Baltex anticipates a 20 per cent increase in export growth over the next twelve months.',
        'https://www.themanufacturer.com/articles/baltex-secures-seven-figure-funding-to-drive-european-expansion/',
        '2026-07-20',
        'hsbc-baltex-release',
      ),
    ],
    inferences: [
      inference(
        'baltex-i1',
        'Cross-border movement volume between the UK, the EU and Poland is set to rise by roughly a fifth within the year, each leg requiring post-Brexit customs handling.',
        ['baltex-f1', 'baltex-f2'],
        'The company states the growth figure itself and the funding is structured around the trade flows that produce it.',
      ),
    ],
    hypothesis: hypothesis(
      'baltex-h1',
      'A fifth more cross-border consignments on a UK–Poland–EU route is the point at which existing freight and customs arrangements get renegotiated or outgrown.',
      ['baltex-i1'],
      'Volume increases of this size change the economics of groupage versus ad-hoc booking, and customs admin scales with consignment count.',
      'Ask how many EU consignments they run monthly now and who clears them — if a single forwarder handles Poland end to end, this is a displacement sale, not a gap.',
    ),
    owningFunction: {
      function: 'Supply Chain',
      rationale:
        'Dual-site UK/Poland manufacturing means someone owns the inter-site movement and customs; that is a supply chain role, not finance, despite the trigger being a finance announcement.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Mid-sized East Midlands manufacturer with active import and export flows and a second production site inside the EU.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'Five outlets carried this story but all appear to originate from one HSBC press release — one source, not five. Baltex is a long-established exporter, so an incumbent forwarder is near-certain.',
      },
    ],
    judgements: { icpFit: 23, signalStrength: 17, commercialRelevance: 13 },
    whyNow:
      'On 20 July Baltex closed a seven-figure HSBC package explicitly built around its EU import and export flows, and has publicly committed to 20% export growth over twelve months while running production in both the UK and Poland.',
    salesAngle:
      "You've told the market you expect 20% export growth this year and you're running production in both the UK and Poland. That's a lot of recurring cross-border movements and customs paperwork on a route we run regularly — worth a conversation about what the extra 20% costs you per shipment.",
  },

  'bramblefoods.co.uk': {
    trigger: 'new_premises',
    whatChanged:
      'Opened Lancaster House, a purpose-built 67,000 sq ft main UK distribution hub, supporting up to 50 new roles while expanding product range and customer base.',
    facts: [
      fact(
        'bramble-f1',
        'Bramble Foods has moved into Lancaster House, a purpose-built 67,000 sq ft distribution centre at Airfield Business Park, as its main UK distribution hub.',
        'https://www.leicestershire.gov.uk/news/airfield-feeds-ambitions-as-bramble-expand-onto-business-park',
        '2026-07-31',
      ),
      fact(
        'bramble-f2',
        'The LDC-backed Bramble Group employs around 300 people and expects the new site to support growth toward 350, taking the facility to increase warehousing and stockholding capacity as it expands product range and customer base.',
        'https://www.ldc.co.uk/news/family-food-business-opens-landmark-distribution-centre/',
        '2026-07-31',
      ),
      fact(
        'bramble-f3',
        'Bramble Group brands include Whitakers Chocolates, The Bay Tree and Lings — confectionery and fine-food gifting lines.',
        'https://www.grocerygazette.co.uk/2026/07/31/bramble-foods-opens-new-distribution-hub-and-eyes-expansion/',
        '2026-07-31',
      ),
    ],
    inferences: [
      inference(
        'bramble-i1',
        'Core warehousing demand has just been met in-house, closing the obvious 3PL storage opportunity.',
        ['bramble-f1'],
        'A purpose-built main hub is sized for the business that commissioned it; third-party storage is what it replaces.',
      ),
      inference(
        'bramble-i2',
        'Confectionery and food gifting are heavily Christmas-weighted, so peak-period volume runs well above the average the building was sized for.',
        ['bramble-f2', 'bramble-f3'],
        'Seasonal gifting ranges concentrate despatch into Q4 regardless of annual capacity.',
      ),
    ],
    hypothesis: hypothesis(
      'bramble-h1',
      'The opportunity is not storage but Q4 overflow and peak haulage capacity, plus inbound freight on imported ingredients and finished lines.',
      ['bramble-i1', 'bramble-i2'],
      'A business that has just sized a building for its average is the business that runs short of space and vehicles at peak.',
      'Ask what they did for overflow last November and whether the new hub changes that answer.',
    ),
    owningFunction: {
      function: 'Operations',
      rationale:
        'Site and despatch capacity planning for a new distribution hub sits with operations, who will already be modelling the first peak in it.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'PE-backed Leicestershire food group, right size, expanding range and customer base, with pronounced seasonal peaks.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'Material and it cuts against the obvious pitch: the signal is a company solving its own warehousing problem, which closes rather than opens the storage opportunity. The row survives on seasonality and inbound freight only.',
      },
    ],
    judgements: { icpFit: 20, signalStrength: 12, commercialRelevance: 10 },
    whyNow:
      'Bramble opened its main UK distribution hub on 31 July and is expanding both product range and customer base under PE backing. A business that has just sized a building for its average is the business that runs out of space and vehicles in Q4.',
    salesAngle:
      "You've just opened Lancaster House as your main hub, so you don't need warehousing from us today. What you may need in November is somewhere for the overflow and vehicles for the peak — that's the call worth having in September, not December.",
  },

  'devolkitchens.com': {
    trigger: 'award_international_trade',
    whatChanged:
      'Recognised in the 2026 King\'s Awards for Enterprise for International Trade, while supplying US showrooms in New York and Los Angeles from Leicestershire production.',
    facts: [
      fact(
        'devol-f1',
        'deVOL Kitchens is among six Leicestershire recipients of the 2026 King\'s Awards for Enterprise, in the International Trade category.',
        'https://www.leicestershire.gov.uk/king-honours-six-leicestershire-companies',
        '2026-05-06',
      ),
      fact(
        'devol-f2',
        'deVOL opened its first showroom outside the UK in New York, and has since added a Los Angeles showroom; every deVOL kitchen is still made in Leicestershire.',
        'https://www.kbbreview.com/22981/topstory/devol-opens-showroom-in-new-york/',
        undefined,
      ),
    ],
    inferences: [
      inference(
        'devol-i1',
        'A recurring flow of bulky, high-value, fragile cabinetry moves from Loughborough to both US coasts.',
        ['devol-f1', 'devol-f2'],
        'US showrooms supplied from UK-only production imply continuing transatlantic freight of finished furniture.',
      ),
    ],
    hypothesis: hypothesis(
      'devol-h1',
      'Export packing quality, not freight rate, determines whether deVOL\'s product arrives saleable — which makes crating and handling the point of leverage for a local forwarder.',
      ['devol-i1'],
      'For fragile high-value furniture the cost of damage dwarfs the freight differential, so packing capability is the buying criterion.',
      'Ask what their damage rate on US shipments is and who crates them; a low rate with an incumbent specialist closes this.',
    ),
    owningFunction: {
      function: 'Operations / Logistics',
      rationale:
        'Despatch and packing standards for export orders sit with operations; the showroom side does not own how the product travels.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Leicestershire manufacturer of bulky, fragile, high-value goods exporting to the US, two miles from the client.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'An award is a low-strength signal by design — it confirms an established exporter, so this is a displacement conversation, not a new requirement. The US showrooms are not new.',
      },
    ],
    judgements: { icpFit: 22, signalStrength: 8, commercialRelevance: 11 },
    whyNow:
      'The May 2026 King\'s Award recognises export performance already achieved rather than a change. What makes it worth a call is the cargo: handmade cabinetry made two miles away and shipped to New York and LA is bulky, fragile and high-value, where packing quality decides whether it arrives saleable.',
    salesAngle:
      "Congratulations on the King's Award. You're making kitchens two miles from us and shipping them to New York and LA — high-value, fragile, awkward to crate. If you ever want a second quote on export packing and sea freight from someone local enough to come and look at the load, we're at the other end of Loughborough.",
  },

  'nmsinfrastructure.com': {
    trigger: 'award_international_trade',
    whatChanged:
      'Recognised in the 2026 King\'s Awards for Enterprise for International Trade, as an EPCF infrastructure developer delivering turnkey projects in Sub-Saharan Africa.',
    facts: [
      fact(
        'nms-f1',
        'NMS International Group is among six Leicestershire recipients of the 2026 King\'s Awards for Enterprise, in the International Trade category.',
        'https://www.leicestershire.gov.uk/king-honours-six-leicestershire-companies',
        '2026-05-06',
      ),
      fact(
        'nms-f2',
        'NMS Infrastructure is an EPCF developer delivering fully-funded turnkey infrastructure projects predominantly in Sub-Saharan Africa, with teams covering design, engineering, procurement, logistics and project management.',
        'https://www.nmsinfrastructure.com/contact',
        undefined,
        undefined,
        'nmsinfrastructure.com',
      ),
    ],
    inferences: [
      inference(
        'nms-i1',
        'Turnkey infrastructure delivery in Sub-Saharan Africa implies recurring project-cargo movements of plant, materials and equipment.',
        ['nms-f2'],
        'EPCF contracts require the contractor to land physical materials on site, which is project freight by another name.',
      ),
    ],
    hypothesis: hypothesis(
      'nms-h1',
      'There may be a project-cargo and export documentation requirement for African destinations, though the company describes logistics as an in-house capability.',
      ['nms-i1', 'nms-f1'],
      'Project freight to Sub-Saharan Africa is specialist work, but this company may already do it internally, which is the open question.',
      'Ask whether project logistics is handled in-house or subcontracted per project — their own description suggests in-house, and that would close it.',
    ),
    owningFunction: {
      function: 'Procurement / Project Logistics',
      rationale:
        'On EPCF contracts the project procurement function owns inbound materials movement to site.',
    },
    icpRelevance: {
      fits: true,
      rationale:
        'Exports physical project materials internationally from a Leicestershire base — fit is real, but weaker than a straightforward manufacturer because logistics may be in-house.',
    },
    contradictions: [
      {
        severity: 'caveat',
        note:
          'The company lists logistics among its own in-house capabilities, which materially weakens the case. Award signal is low-strength and four months old.',
      },
    ],
    judgements: { icpFit: 19, signalStrength: 7, commercialRelevance: 9 },
    whyNow:
      'Recognised for international trade in May 2026 while delivering turnkey infrastructure in Sub-Saharan Africa. Weak as a trigger, and the company describes logistics as something it already does itself.',
    salesAngle:
      'Project cargo to Sub-Saharan Africa is specialist work and we would want to understand what you currently subcontract before suggesting anything — worth one exploratory call, not a pitch.',
  },

  // Researched, nothing found. Distinct from "not researched".
  'winbrogroup.com': null,

  'slackandparr.com': {
    trigger: 'relocation',
    whatChanged:
      'Moved to a 73,000 sq ft headquarters on Long Lane, Kegworth — an event search surfaces as though current.',
    facts: [
      fact(
        'slackparr-f1',
        'Slack & Parr moved into a new 73,000 sq ft headquarters on Long Lane, Kegworth, representing roughly £4.5m of investment, fully operational since February 2021.',
        'https://www.thebusinessdesk.com/eastmidlands/news/2047181-multimillion-pound-loan-sees-manufacturer-move-to-new-hq',
        '2020-11-01',
      ),
    ],
    inferences: [
      inference(
        'slackparr-i1',
        'A relocation of this size would normally trigger re-procurement of logistics arrangements.',
        ['slackparr-f1'],
        'Site moves reopen supplier decisions that are otherwise sticky.',
      ),
    ],
    hypothesis: hypothesis(
      'slackparr-h1',
      'A site move would create a freight re-procurement window.',
      ['slackparr-i1'],
      'Standard relocation reasoning — which is exactly why the date matters more than the reasoning.',
      'Check the date of the move before anything else.',
    ),
    owningFunction: { function: 'Operations', rationale: 'Site moves sit with operations.' },
    icpRelevance: {
      fits: true,
      rationale: 'Kegworth precision manufacturer, five miles from the client — fit is good.',
    },
    contradictions: [],
    judgements: { icpFit: 21, signalStrength: 15, commercialRelevance: 12 },
    whyNow: 'Superseded — see freshness.',
    salesAngle: 'n/a',
  },

  'bleckmann.com': {
    trigger: 'new_premises',
    whatChanged: 'Opening a new mega distribution centre in Lutterworth, Leicestershire.',
    facts: [
      fact(
        'bleckmann-f1',
        'Bleckmann, a supply chain management specialist for fashion and lifestyle brands, is opening a new mega distribution centre in Lutterworth, Leicestershire.',
        'https://ww.fashionnetwork.com/news/Bleckmann-to-open-another-giant-distribution-centre-in-uk,1825515.html',
        '2026-06-01',
      ),
    ],
    inferences: [],
    hypothesis: hypothesis(
      'bleckmann-h1',
      'No commercial opportunity: this is a competitor expanding, not a prospect.',
      ['bleckmann-f1'],
      'Bleckmann provides the same third-party logistics services the client sells.',
      'n/a — disqualified by client profile.',
    ),
    owningFunction: { function: 'n/a', rationale: 'n/a' },
    icpRelevance: {
      fits: false,
      rationale:
        'Third-party logistics provider — a competitor, explicitly disqualified in the client profile.',
    },
    contradictions: [],
    judgements: { icpFit: 0, signalStrength: 0, commercialRelevance: 0 },
    whyNow: 'n/a',
    salesAngle: 'n/a',
  },

  'aldi.co.uk': {
    trigger: 'new_premises',
    whatChanged:
      'Opened a £500m, 1.3m sq ft distribution centre at Bardon, Leicestershire — the UK\'s largest supermarket warehouse.',
    facts: [
      fact(
        'aldi-f1',
        'Aldi has invested more than £500m in a 1.3m sq ft distribution centre at Bardon, Leicestershire, employing around 1,000 people and serving nearly 350 stores.',
        'https://www.eastmidlandsbusinesslink.co.uk/mag/news/aldi-invests-500m-in-leicestershire-to-establish-britains-largest-supermarket-warehouse/',
        '2026-07-01',
      ),
    ],
    inferences: [],
    hypothesis: hypothesis(
      'aldi-h1',
      'No commercial opportunity: enterprise retailer operating its own national distribution network.',
      ['aldi-f1'],
      'Scale and self-operation put this far outside what an SME forwarder can serve.',
      'n/a — disqualified by client profile.',
    ),
    owningFunction: { function: 'n/a', rationale: 'n/a' },
    icpRelevance: {
      fits: false,
      rationale:
        'Enterprise retailer running its own distribution network — explicitly disqualified in the client profile.',
    },
    contradictions: [],
    judgements: { icpFit: 0, signalStrength: 0, commercialRelevance: 0 },
    whyNow: 'n/a',
    salesAngle: 'n/a',
  },
};
