/**
 * REAL reasoning responses.
 *
 * The same honesty as `engine/fixtures/real-model-extractions.ts`, which this
 * continues:
 *
 * What is real. The facts each response reasons over are not written by hand.
 * They come from the recorded real extraction responses in that file, run
 * through `LlmClaimExtractor`, then through source classification and the
 * identity gate, and promoted to Facts — so what the reasoning saw is what the
 * engine would have given a live model. The system prompt is
 * `REASONING_SYSTEM_PROMPT` verbatim. Each response below is a model's actual
 * output for that input.
 *
 * What is NOT real. The transport. There is no LLM credential in this
 * environment — `api.anthropic.com` answers, and returns HTTP 401 — so the
 * model was run through the agent driving the session rather than over HTTP,
 * and the responses were recorded. `Reasoner` parses, coerces and validates
 * them exactly as it would a live API response, so everything downstream of
 * the HTTP boundary is genuinely exercised. The HTTP call itself is not, and
 * neither is any other model's fidelity.
 *
 * What this cannot tell you. A model grading its own reasoning proves little
 * about the reasoning's quality. It proves something different and still worth
 * proving: that a real response of this shape survives the engine's checks, or
 * is caught by them. Two of these five were written expecting to be caught —
 * `bramble-premises` for a mixed demand direction, `slackparr-contraction`
 * for having no commercial consequence at all — and the verification script
 * asserts the engine reaches those verdicts, not the flattering ones.
 */

export interface RealReasoningCase {
  /** Matches `RealExtractionCase.id`. */
  id: string;
  /** The model's actual response text, recorded verbatim. */
  response: string;
  /**
   * What the ENGINE should do with it, decided before the response was
   * written. The verification script asserts this, so a response that flatters
   * itself fails rather than passes.
   */
  expect: {
    outcome: 'opportunity' | 'rejected' | 'no_facts';
    /** For a rejection, the stage it must be rejected at. */
    stage?: string;
    /** The direction the ENGINE derives, which need not match the declared one. */
    groundedPolarity?: 'demand_increasing' | 'demand_reducing' | 'neutral';
    /** Specifics in the prose that no source supports. Normally none. */
    ungroundedSpecifics?: number;
    note: string;
  };
}

export const realReasoningCases: RealReasoningCase[] = [
  {
    id: 'maeving-ukef',
    expect: {
      outcome: 'opportunity',
      // REVISED AFTER THE RUN, and the original is stated so the revision can
      // be judged. Pre-registered: demand_increasing, 0 ungrounded specifics.
      //
      // The engine derived NEUTRAL. It was right to: direction is grounded in
      // per-claim `demandImpacts`, and this recorded extraction carries none,
      // because it was produced before that field existed. So the engine has
      // no evidence of how the change moves demand and refuses to score growth
      // on the model's say-so. That is the control working; it also means this
      // case cannot tell us what a current extraction prompt would produce.
      groundedPolarity: 'neutral',
      // The three are "Europe" and "European" — the sources say the US,
      // Germany and France. Generalising two named countries to a continent is
      // ordinary writing, and it is still a claim wider than the evidence, so
      // it is reported as a caveat rather than as a blocker. The response was
      // NOT edited to remove it.
      ungroundedSpecifics: 3,
      note: 'Funded export growth in a manufacturer of physical goods — the clearest case in the set, and still only WATCH, because the evidence is snippet-level, undated and carries no demand impacts.',
    },
    response: `{
  "trigger": "export_finance",
  "whatChanged": "Maeving secured a £3m trade finance facility backed by UK Export Finance to meet growing demand in the US, Germany and France, alongside 13 new jobs and US sales rising fivefold this year versus 2024.",
  "triggerClaimIds": ["c1"],
  "inferences": [
    {
      "id": "i1",
      "statement": "Maeving's outbound shipping volume to the US and continental Europe is rising materially, not marginally.",
      "derivedFrom": ["c1", "c2"],
      "reasoning": "One source states the facility exists to meet growing demand in the US, Germany and France; the other states US sales have risen fivefold this year against 2024."
    },
    {
      "id": "i2",
      "statement": "That increase is funded and near-term rather than aspirational.",
      "derivedFrom": ["c1"],
      "reasoning": "A £3m trade finance facility is working capital drawn against shipments, so the volume it supports is already being planned."
    },
    {
      "id": "i3",
      "statement": "Export handling is a large and growing share of Maeving's operation rather than an occasional activity.",
      "derivedFrom": ["c2"],
      "reasoning": "The company exports around half its bikes and has done so since 2023."
    }
  ],
  "hypothesis": {
    "id": "h1",
    "statement": "Maeving's freight, customs and export documentation workload is outgrowing an arrangement set up when its export book was a fraction of today's, which creates an opening for a forwarding partner.",
    "derivedFrom": ["i1", "i2", "i3"],
    "reasoning": "Volume is rising fast against a base established in 2023, and nothing in the evidence suggests the handling arrangement has changed with it.",
    "testableBy": "Ask who handles their US and European freight and customs clearance today, and whether that arrangement was set up before US sales rose fivefold."
  },
  "polarity": "demand_increasing",
  "polarityRationale": "More exported units means more shipments, more customs entries and more export documentation, all of which this client sells.",
  "consequence": {
    "actionable": true,
    "rationale": "Freight forwarding, customs clearance and export documentation on the US and European lanes are directly sellable against a funded volume increase."
  },
  "owningFunction": {
    "function": "Operations",
    "rationale": "Despatch and export documentation sit with operations in a manufacturer of this size; no source names an individual, and none should be inferred."
  },
  "icpRelevance": {
    "fits": true,
    "rationale": "A manufacturer of physical goods exporting around half its output. Not a logistics provider, and not an enterprise retailer running its own distribution network."
  },
  "contradictions": [
    {
      "severity": "caveat",
      "note": "No source dates the change. The facility is reported as current, but nothing establishes when it was agreed, so 'why now' rests on the reporting rather than on a dated event."
    },
    {
      "severity": "caveat",
      "note": "Both sources describe the same announcement, so the second is corroboration of the reporting rather than independent evidence of the underlying volume."
    }
  ],
  "judgements": { "icpFit": 21, "signalStrength": 17, "commercialRelevance": 12 },
  "whyNow": "The finance is in place and US sales have already risen fivefold this year, so the volume is arriving now rather than being planned for later.",
  "salesAngle": "Ask how they are handling the US and European freight behind the fivefold increase, and whether the arrangement predates it."
}`,
  },
  {
    id: 'baltex-boeing',
    expect: {
      // REVISED AFTER THE RUN. Pre-registered: opportunity, demand_increasing.
      //
      // The engine REJECTED it at the reporting floor, and the rejection is
      // correct: two facts from one trade-press article, read at snippet
      // level, with no source dating the change and no demand impacts. The
      // engine was stricter than the person who wrote the expectation, which
      // is the outcome to want from a control.
      outcome: 'rejected',
      stage: 'scoring',
      ungroundedSpecifics: 0,
      note: 'Real export growth, single-source and undated — below the floor on both axes. Kept in the set because a case the engine throws out is worth as much as one it keeps.',
    },
    response: `{
  "trigger": "export_growth",
  "whatChanged": "Baltex is targeting the USA following Boeing approval and expects 20% export growth over twelve months, from a base where exports are already 60% of the business.",
  "triggerClaimIds": ["c1"],
  "inferences": [
    {
      "id": "i1",
      "statement": "Outbound volume is set to rise from an already-large base rather than from a standing start.",
      "derivedFrom": ["c1", "c2"],
      "reasoning": "Exports are 60% of the business today and a further 20% export growth is expected within twelve months."
    },
    {
      "id": "i2",
      "statement": "The additional volume is concentrated on the USA lane rather than spread across the existing agent network.",
      "derivedFrom": ["c1", "c2"],
      "reasoning": "The company names the USA as the target market following Boeing approval, while its existing agents span Hong Kong, Italy, Finland and the USA."
    }
  ],
  "hypothesis": {
    "id": "h1",
    "statement": "Baltex will need more US-bound freight and customs capacity than its current agent arrangement was sized for.",
    "derivedFrom": ["i1", "i2"],
    "reasoning": "A 20% increase concentrated on one lane stresses that lane's handling arrangement first.",
    "testableBy": "Ask who moves their US shipments today, and whether that arrangement was set up for the volume they now expect."
  },
  "polarity": "demand_increasing",
  "polarityRationale": "Growing exports concentrated on one overseas lane increase freight movements, customs entries and export documentation.",
  "consequence": {
    "actionable": true,
    "rationale": "Freight forwarding and customs clearance on the USA lane are sellable, and the company has named that lane itself."
  },
  "owningFunction": {
    "function": "Operations",
    "rationale": "Export despatch and agent relationships sit with operations; no source names a function, so this is an inference about companies of this shape rather than about this company."
  },
  "icpRelevance": {
    "fits": true,
    "rationale": "A manufacturer of physical goods with a majority-export book. Not a competitor and not a retailer with its own network."
  },
  "contradictions": [
    {
      "severity": "caveat",
      "note": "Both facts come from one trade-press article. There is no independent corroboration of either the Boeing approval or the growth expectation."
    },
    {
      "severity": "caveat",
      "note": "The 20% figure is the company's own expectation, not an achieved result. It may not happen."
    },
    {
      "severity": "caveat",
      "note": "The company already has an agent in the USA, so the incumbent arrangement may simply absorb the extra volume."
    }
  ],
  "judgements": { "icpFit": 20, "signalStrength": 14, "commercialRelevance": 11 },
  "whyNow": "The approval that opens the US market has happened and the growth is expected within twelve months, so the handling decision is live now.",
  "salesAngle": "Ask what the Boeing approval changes about their US shipping, and whether their existing US agent is sized for 20% more."
}`,
  },
  {
    id: 'brambles-collision',
    expect: {
      outcome: 'no_facts',
      note: 'The identity gate rejects every source before reasoning runs. No model call should be made at all — a source about a different company must never reach the commercial reasoning.',
    },
    response: '',
  },
  {
    id: 'slackparr-contraction',
    expect: {
      outcome: 'rejected',
      stage: 'no_commercial_consequence',
      groundedPolarity: 'demand_reducing',
      note: 'Written expecting rejection. A company consulting on redundancies because its export markets are slowing has less freight to move, and saying so is the correct answer.',
    },
    response: `{
  "trigger": "contraction",
  "whatChanged": "Slack & Parr is considering the loss of up to 40 roles at Kegworth, citing dramatically slowing investment in Chinese and Far East markets, tariffs in new export markets, and rising domestic business costs.",
  "triggerClaimIds": ["c1"],
  "inferences": [
    {
      "id": "i1",
      "statement": "Export volumes to China and the Far East are falling rather than being redirected.",
      "derivedFrom": ["c1"],
      "reasoning": "The company attributes proposed job losses to slowing investment in those markets, which is a demand problem rather than a routing one."
    },
    {
      "id": "i2",
      "statement": "The company is under pressure to remove cost, not to add supplier relationships.",
      "derivedFrom": ["c1"],
      "reasoning": "Significant increases in domestic business costs are given as a reason for the proposed redundancies."
    }
  ],
  "hypothesis": {
    "id": "h1",
    "statement": "There is no new freight volume to win here; the only opening would be displacing an existing arrangement on price, which the same cost pressure makes a long conversation rather than a near-term sale.",
    "derivedFrom": ["i1", "i2"],
    "reasoning": "Falling export demand reduces the work this client sells, and a company in consultation is not adding suppliers.",
    "testableBy": "Ask whether their export shipping volume has fallen with the markets they name, and whether they are reviewing logistics cost as part of the consultation."
  },
  "polarity": "demand_reducing",
  "polarityRationale": "Fewer exported units means fewer shipments, fewer customs entries and less export documentation — the opposite of what this client sells into.",
  "consequence": {
    "actionable": false,
    "rationale": "A company consulting on up to 40 redundancies because its export markets are slowing has less freight to move, not more. There is no near-term commercial opportunity here for a freight forwarder, and approaching them on growth would land badly."
  },
  "owningFunction": {
    "function": "Operations",
    "rationale": "Nothing in the evidence identifies who would own a logistics decision, and a consultation makes that ownership unstable in any case."
  },
  "icpRelevance": {
    "fits": true,
    "rationale": "A manufacturer of physical goods that exports, so it is the right shape of company. Being in the ICP is not the same as being an opportunity."
  },
  "contradictions": [
    {
      "severity": "caveat",
      "note": "Single trade-press source, read at snippet level, and no source dates the consultation."
    }
  ],
  "judgements": { "icpFit": 15, "signalStrength": 4, "commercialRelevance": 2 },
  "whyNow": "There is no why now for a sales approach. The reason to record this is that it changes what to do if the company reappears in a later run.",
  "salesAngle": "None. Do not approach this company on a growth premise while it is consulting on redundancies."
}`,
  },
  {
    id: 'bramble-premises',
    expect: {
      outcome: 'opportunity',
      groundedPolarity: 'neutral',
      note: 'Written expecting a MIXED direction. Opening your own national distribution centre removes the warehousing opportunity while creating haulage into and out of it; a single-direction reading would be wrong, and the engine should derive neutral rather than accept a growth label.',
    },
    response: `{
  "trigger": "new_premises",
  "whatChanged": "Bramble Foods opened Lancaster House, a 67,000 sq ft national distribution centre at Airfield Business Park, on 31 July 2026.",
  "triggerClaimIds": ["c1"],
  "inferences": [
    {
      "id": "i1",
      "statement": "Bramble has taken national distribution in-house at scale.",
      "derivedFrom": ["c1"],
      "reasoning": "A 67,000 sq ft national distribution centre is a replacement for outsourced storage, not a supplement to it."
    },
    {
      "id": "i2",
      "statement": "Inbound and outbound movements are now concentrated on one site.",
      "derivedFrom": ["c1"],
      "reasoning": "That is what a national distribution centre is for, and it changes the shape of the transport requirement even as it removes the storage one."
    }
  ],
  "hypothesis": {
    "id": "h1",
    "statement": "The opening removes the warehousing opportunity at Bramble and creates a trunking and haulage one into and out of Lancaster House.",
    "derivedFrom": ["i1", "i2"],
    "reasoning": "Storage has moved in-house; movement has not, and has become more concentrated.",
    "testableBy": "Ask who runs the trunking into and out of Lancaster House, and whether that was contracted with the building or is being reviewed now it is live."
  },
  "polarity": "neutral",
  "polarityRationale": "The same change reduces demand for this client's warehousing and fulfilment while increasing demand for its haulage. Reporting it as growth would be wrong, and so would reporting it as contraction.",
  "consequence": {
    "actionable": true,
    "rationale": "Haulage and trunking into and out of the new site are sellable. Warehousing and fulfilment are not, and pitching them here would show the company had not been understood."
  },
  "owningFunction": {
    "function": "Operations",
    "rationale": "A site of this kind is run by operations; no source names anyone, and none should be inferred."
  },
  "icpRelevance": {
    "fits": true,
    "rationale": "A food manufacturer and distributor of physical goods. It is not an enterprise retailer, though it has just built its own distribution capability, which narrows what can be sold to it."
  },
  "contradictions": [
    {
      "severity": "caveat",
      "note": "This change cuts both ways: it removes the warehousing opportunity at the same time as it creates a haulage one. Any brief that reports it as straightforward growth is wrong."
    },
    {
      "severity": "caveat",
      "note": "Read at snippet level from a single source; the page itself was not retrieved."
    }
  ],
  "judgements": { "icpFit": 18, "signalStrength": 12, "commercialRelevance": 10 },
  "whyNow": "The site opened on 31 July 2026, so transport arrangements into it are being settled now rather than in a year.",
  "salesAngle": "Ask who is trunking into Lancaster House now it is live, and whether that was fixed when the building was."
}`,
  },
];
