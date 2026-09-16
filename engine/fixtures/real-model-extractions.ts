/**
 * REAL model extraction responses.
 *
 * What is real here: the search results are genuine Pilot A captures, the
 * system prompt is `EXTRACTION_SYSTEM_PROMPT` verbatim, and each response
 * below is an actual model's output for that input — not a hand-written
 * fixture designed to pass.
 *
 * What is NOT real: the transport. No LLM API key exists in this environment,
 * so the model was run through the agent driving the session rather than over
 * HTTP, and the responses were recorded. `LlmClaimExtractor` parses, coerces
 * and validates them exactly as it would a live API response, so everything
 * downstream of the HTTP boundary is genuinely exercised. The HTTP call itself,
 * and any other model's fidelity, remain untested.
 *
 * Each case carries a GOLD STANDARD: what a careful reader would take from
 * that source. `extraction-fidelity.ts` scores the response against it and
 * records failures. Nothing here is repaired to make a metric look better.
 */

import type { SearchResult } from '../src/research/types.ts';

export interface RealExtractionCase {
  id: string;
  /** The company the extractor was asked about. */
  target: string;
  targetDomain: string;
  results: SearchResult[];
  /** The model's actual response text, recorded verbatim. */
  modelResponse: string;
  /** What a careful reader should take from these sources. */
  gold: {
    claimCount: { min: number; max: number };
    /** Every claim must cite one of these URLs. */
    allowedUrls: string[];
    expectedName: string;
    expectedCountry?: string;
    expectedTown?: string;
    /** Substrings that must appear across the extracted event dates. */
    expectedEventDates: string[];
    expectedTopics: string[];
    expectedPolarity: 'demand_increasing' | 'demand_reducing' | 'neutral';
    /** Facts stated in the sources; used to detect hallucinated specifics. */
    sourceFigures: string[];
    notes?: string;
  };
}

const RUN_DATE = '2026-09-09';

export const realExtractionCases: RealExtractionCase[] = [
  {
    id: 'maeving-ukef',
    target: 'Maeving Ltd',
    targetDomain: 'maeving.com',
    results: [
      {
        query: 'Maeving Ltd Coventry news announcement expansion contract',
        title:
          'Maeving in the right direction: E-motorbike maker gears up exports with UKEF backing',
        url: 'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
        snippet:
          'Coventry-based Maeving secured a £3m trade finance facility backed by UK Export Finance to meet growing demand in the US, Germany and France, creating 13 new jobs.',
        retrievedAt: RUN_DATE,
      },
      {
        query: 'Maeving Ltd Coventry export growth or new overseas market entry',
        title: 'British electric bike firm Maeving gets Government cash to fuel export push',
        url: 'https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/',
        snippet:
          'Maeving started exporting to California, Germany and France in 2023 and exports around half its bikes; US sales have risen fivefold this year versus 2024 despite tariff-driven trade disruption.',
        retrievedAt: RUN_DATE,
      },
    ],
    modelResponse: `{
  "trigger": "export_finance",
  "whatChanged": "Maeving secured a £3m UK Export Finance-backed trade finance facility to expand production for the US, German and French markets, creating 13 jobs.",
  "polarity": "demand_increasing",
  "polarityRationale": "A funded production expansion serving named export markets means more outbound cross-border consignments.",
  "claims": [
    {
      "id": "c1",
      "claimText": "Maeving secured a £3m trade finance facility backed by UK Export Finance to meet growing demand in the US, Germany and France, creating 13 new jobs.",
      "supportingPassage": "Coventry-based Maeving secured a £3m trade finance facility backed by UK Export Finance to meet growing demand in the US, Germany and France, creating 13 new jobs.",
      "sourceUrl": "https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing",
      "statedSourceType": "government announcement",
      "topic": "funding",
      "identityAttributes": {
        "statedName": "Maeving",
        "statedGeography": { "country": "United Kingdom", "town": "Coventry" },
        "statedIndustry": "electric motorbike manufacturing"
      },
      "extractionConfidence": 0.95,
      "verification": "search_snippet"
    },
    {
      "id": "c2",
      "claimText": "Maeving started exporting to California, Germany and France in 2023, exports around half its bikes, and US sales have risen fivefold this year versus 2024 despite tariff-driven trade disruption.",
      "supportingPassage": "Maeving started exporting to California, Germany and France in 2023 and exports around half its bikes; US sales have risen fivefold this year versus 2024 despite tariff-driven trade disruption.",
      "sourceUrl": "https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/",
      "statedSourceType": "specialist motoring news",
      "topic": "export_trade",
      "identityAttributes": {
        "statedName": "Maeving",
        "statedIndustry": "electric motorbikes"
      },
      "extractionConfidence": 0.85,
      "verification": "search_snippet"
    }
  ]
}`,
    gold: {
      claimCount: { min: 2, max: 3 },
      allowedUrls: [
        'https://www.gov.uk/government/news/maeving-in-the-right-direction-e-motorbike-maker-gears-up-exports-with-ukef-backing',
        'https://www.motorcyclenews.com/news/2026/august/maeving-get-3m-government-backed-cash-injection/',
      ],
      expectedName: 'Maeving',
      expectedCountry: 'United Kingdom',
      expectedTown: 'Coventry',
      // Neither snippet states a date. A correct extractor omits eventDate
      // rather than inventing one from the URL or the retrieval date.
      expectedEventDates: [],
      expectedTopics: ['funding', 'export_trade'],
      expectedPolarity: 'demand_increasing',
      sourceFigures: ['£3m', '13', 'fivefold', 'half'],
      notes:
        'The MCN URL contains "2026/august" but the snippet states no date. Emitting an event date here would be inference, not extraction.',
    },
  },

  {
    id: 'baltex-boeing',
    target: 'Baltex',
    targetDomain: 'baltex.co.uk',
    results: [
      {
        query: 'Baltex Ilkeston export growth or new overseas market entry',
        title: "UK's Baltex accelerates international growth strategy",
        url: 'https://knittingindustry.com/uks-baltex-accelerates-international-strategy/',
        snippet:
          'Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months. Exports account for 60% of the business, with agents in Hong Kong, Italy, Finland and the USA.',
        retrievedAt: RUN_DATE,
      },
    ],
    modelResponse: `{
  "trigger": "new_market_entry",
  "whatChanged": "Baltex is targeting the USA market following Boeing approval and expects 20% export growth over the next twelve months.",
  "polarity": "demand_increasing",
  "polarityRationale": "Entering a new export market and forecasting 20% export growth both increase cross-border shipping volume.",
  "claims": [
    {
      "id": "c1",
      "claimText": "Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months.",
      "supportingPassage": "Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months.",
      "sourceUrl": "https://knittingindustry.com/uks-baltex-accelerates-international-strategy/",
      "statedSourceType": "textiles trade publication",
      "topic": "export_trade",
      "identityAttributes": {
        "statedName": "Baltex",
        "statedGeography": { "country": "United Kingdom" },
        "statedIndustry": "technical textiles"
      },
      "extractionConfidence": 0.9,
      "verification": "search_snippet"
    },
    {
      "id": "c2",
      "claimText": "Exports account for 60% of Baltex's business, with agents in Hong Kong, Italy, Finland and the USA.",
      "supportingPassage": "Exports account for 60% of the business, with agents in Hong Kong, Italy, Finland and the USA.",
      "sourceUrl": "https://knittingindustry.com/uks-baltex-accelerates-international-strategy/",
      "statedSourceType": "textiles trade publication",
      "topic": "export_trade",
      "identityAttributes": {
        "statedName": "Baltex",
        "statedIndustry": "technical textiles"
      },
      "extractionConfidence": 0.9,
      "verification": "search_snippet"
    }
  ]
}`,
    gold: {
      claimCount: { min: 1, max: 3 },
      allowedUrls: ['https://knittingindustry.com/uks-baltex-accelerates-international-strategy/'],
      expectedName: 'Baltex',
      expectedCountry: 'United Kingdom',
      expectedEventDates: [],
      expectedTopics: ['export_trade'],
      expectedPolarity: 'demand_increasing',
      sourceFigures: ['20%', '60%', 'Boeing'],
      notes:
        'The snippet does not state Ilkeston; only the query did. An extractor that reports "Ilkeston" is importing the target, not reading the source.',
    },
  },

  {
    id: 'brambles-collision',
    target: 'Bramble Group',
    targetDomain: 'bramblefoods.co.uk',
    results: [
      {
        query: 'Bramble Group export growth or new overseas market entry',
        title: 'Brambles Strategy and Business Model',
        url: 'https://umbrex.com/resources/company-profiles/brambles-ltd/',
        snippet:
          'Brambles operates in 60 countries through its CHEP brand, supplying pallets and reusable containers. Headquartered in Sydney, Australia.',
        retrievedAt: RUN_DATE,
      },
    ],
    modelResponse: `{
  "trigger": "unclassified",
  "whatChanged": "No change was reported; this is a company profile of Brambles Ltd, a pallet-pooling business headquartered in Australia.",
  "polarity": "neutral",
  "polarityRationale": "The source describes an ongoing business model rather than a change.",
  "claims": [
    {
      "id": "c1",
      "claimText": "Brambles operates in 60 countries through its CHEP brand, supplying pallets and reusable containers, and is headquartered in Sydney, Australia.",
      "supportingPassage": "Brambles operates in 60 countries through its CHEP brand, supplying pallets and reusable containers. Headquartered in Sydney, Australia.",
      "sourceUrl": "https://umbrex.com/resources/company-profiles/brambles-ltd/",
      "statedSourceType": "consulting company profile",
      "topic": "corporate_identity",
      "identityAttributes": {
        "statedName": "Brambles Ltd",
        "statedGeography": { "country": "Australia", "town": "Sydney" },
        "statedIndustry": "pallet pooling and supply chain logistics"
      },
      "extractionConfidence": 0.85,
      "verification": "search_snippet"
    }
  ]
}`,
    gold: {
      claimCount: { min: 1, max: 2 },
      allowedUrls: ['https://umbrex.com/resources/company-profiles/brambles-ltd/'],
      // The critical case: the extractor must report the company the SOURCE
      // describes, not the company it was asked about.
      expectedName: 'Brambles Ltd',
      expectedCountry: 'Australia',
      expectedTown: 'Sydney',
      expectedEventDates: [],
      expectedTopics: ['corporate_identity'],
      expectedPolarity: 'neutral',
      sourceFigures: ['60', 'CHEP'],
      notes:
        'A pass here means the extractor stayed an extractor: it reported Australia and pallet pooling, leaving the engine to reach the collision verdict.',
    },
  },

  {
    id: 'slackparr-contraction',
    target: 'Slack & Parr',
    targetDomain: 'slackandparr.com',
    results: [
      {
        query: 'Slack & Parr Kegworth news announcement expansion contract',
        title: 'Slack & Parr weighs up job losses at Kegworth facility',
        url: 'https://www.insidermedia.com/news/midlands/slack-parr-weighs-up-jobs-losses-at-kegworth-facility',
        snippet:
          'Slack & Parr is considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, the imposition of tariffs in new export markets, and significant increases in domestic business costs.',
        retrievedAt: RUN_DATE,
      },
    ],
    modelResponse: `{
  "trigger": "restructuring",
  "whatChanged": "Slack & Parr is consulting on the loss of up to 40 roles at its Kegworth facility, citing slowing Chinese and Far East investment, new export tariffs and rising domestic costs.",
  "polarity": "demand_reducing",
  "polarityRationale": "Falling overseas demand and an active headcount reduction mean fewer shipments, not more.",
  "claims": [
    {
      "id": "c1",
      "claimText": "Slack & Parr is considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, the imposition of tariffs in new export markets, and significant increases in domestic business costs.",
      "supportingPassage": "Slack & Parr is considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, the imposition of tariffs in new export markets, and significant increases in domestic business costs.",
      "sourceUrl": "https://www.insidermedia.com/news/midlands/slack-parr-weighs-up-jobs-losses-at-kegworth-facility",
      "statedSourceType": "regional business trade publication",
      "topic": "restructuring",
      "identityAttributes": {
        "statedName": "Slack & Parr",
        "statedGeography": { "country": "United Kingdom", "town": "Kegworth" },
        "statedIndustry": "manufacturing"
      },
      "extractionConfidence": 0.9,
      "verification": "search_snippet"
    }
  ]
}`,
    gold: {
      claimCount: { min: 1, max: 2 },
      allowedUrls: [
        'https://www.insidermedia.com/news/midlands/slack-parr-weighs-up-jobs-losses-at-kegworth-facility',
      ],
      expectedName: 'Slack & Parr',
      expectedCountry: 'United Kingdom',
      expectedTown: 'Kegworth',
      expectedEventDates: [],
      expectedTopics: ['restructuring'],
      expectedPolarity: 'demand_reducing',
      sourceFigures: ['40'],
      notes:
        'Polarity must follow the evidence. Reading a redundancy consultation as demand_increasing would be the contradiction the validator exists to catch.',
    },
  },

  {
    id: 'bramble-premises',
    target: 'Bramble Group',
    targetDomain: 'bramblefoods.co.uk',
    results: [
      {
        query: 'Bramble Group Market Harborough news announcement expansion contract',
        title: 'Family Food Business Opens Landmark Distribution Centre',
        url: 'https://www.ldc.co.uk/news/family-food-business-opens-landmark-distribution-centre/',
        snippet:
          'Bramble Foods of Market Harborough opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park on 31 July 2026.',
        retrievedAt: RUN_DATE,
      },
    ],
    modelResponse: `{
  "trigger": "new_premises",
  "whatChanged": "Bramble Foods opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park in Market Harborough.",
  "polarity": "demand_increasing",
  "polarityRationale": "A new national distribution hub changes the company's distribution footprint and the transport flows through it.",
  "claims": [
    {
      "id": "c1",
      "claimText": "Bramble Foods opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park.",
      "supportingPassage": "Bramble Foods of Market Harborough opened a 67,000 sq ft national distribution centre, Lancaster House, at Airfield Business Park on 31 July 2026.",
      "sourceUrl": "https://www.ldc.co.uk/news/family-food-business-opens-landmark-distribution-centre/",
      "statedSourceType": "private equity investor announcement",
      "topic": "premises",
      "eventDate": "2026-07-31",
      "identityAttributes": {
        "statedName": "Bramble Foods",
        "statedGeography": { "country": "United Kingdom", "town": "Market Harborough" },
        "statedIndustry": "food"
      },
      "extractionConfidence": 0.95,
      "verification": "search_snippet"
    }
  ]
}`,
    gold: {
      claimCount: { min: 1, max: 2 },
      allowedUrls: ['https://www.ldc.co.uk/news/family-food-business-opens-landmark-distribution-centre/'],
      expectedName: 'Bramble Foods',
      expectedCountry: 'United Kingdom',
      expectedTown: 'Market Harborough',
      // This snippet DOES state a date, so a correct extractor reports it.
      expectedEventDates: ['2026-07-31'],
      expectedTopics: ['premises'],
      expectedPolarity: 'demand_increasing',
      sourceFigures: ['67,000'],
    },
  },
];

/**
 * Replays a recorded model response as if it came from the API, so
 * `LlmClaimExtractor` parses, coerces and validates it unchanged.
 */
export function recordedTransport(responseText: string): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify({ content: [{ text: responseText }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof globalThis.fetch;
}
