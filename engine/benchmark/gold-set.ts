/**
 * Orbital Direct commercial gold set.
 *
 * Independent commercial judgement against which the engine is measured. The
 * labels here were reached by reading the sources and applying
 * `docs/ORBITAL_COMMERCIAL_BENCHMARK.md` — deliberately WITHOUT reference to
 * the engine's scores, so that agreement means something.
 *
 * KNOWN LIMITATION, stated up front: the same agent that built the engine
 * produced these labels. That is not an independent human review, and it
 * inherits every blind spot the engine has. Where a label disagrees with the
 * engine it is meaningful evidence; where it agrees it is weak evidence, and
 * should be re-graded by an Orbital salesperson before being trusted.
 */

export type GoldLabel =
  | 'A_strong'
  | 'B_potential'
  | 'C_weak'
  | 'D_false_positive'
  | 'E_no_change'
  | 'F_insufficient_evidence';

export type EvidenceGrade = 'high' | 'medium' | 'low';
export type ValueGrade = 'high' | 'medium' | 'low';

export type MissReason =
  | 'search_failure'
  | 'source_discovery_failure'
  | 'source_classification_failure'
  | 'extraction_failure'
  | 'identity_failure'
  | 'freshness_failure'
  | 'reasoning_failure'
  | 'client_relevance_failure'
  | 'scoring_failure'
  | 'target_selection_failure'
  | 'other';

/**
 * Errors observed in the engine's own output for this company — recorded
 * separately from the label, because an engine can reach a defensible verdict
 * through faulty reasoning and that is still a defect worth counting.
 */
export type EngineErrorKind =
  | 'identity'
  | 'stale_signal'
  | 'contradiction'
  | 'reasoning_depth'
  | 'value_overstated'
  | 'value_understated';

export interface EngineError {
  kind: EngineErrorKind;
  detail: string;
}

export interface GoldEntry {
  company: string;
  domain: string;
  label: GoldLabel;
  /** Independent read of how well the change is evidenced. */
  evidence: EvidenceGrade;
  /** Independent read of how much a sale here is worth pursuing. */
  value: ValueGrade;
  whatChanged: string;
  /** Present for A and B: the commercial case. */
  whyDemand?: string;
  whyOrbital?: string;
  salesAction?: string;
  /** Present for C, D, E, F: why not. */
  whyNot?: string;
  /** What we would have to find out before contacting them. */
  unknowns?: string[];
  /** True when the engine reported this as an opportunity. */
  engineReported: boolean;
  /** Set when the engine should have reported it and did not. */
  missReason?: MissReason;
  /** Defects in the engine's output for this company, independent of the label. */
  engineErrors?: EngineError[];
  /**
   * Evidence found AFTER this entry was labelled that bears on the label.
   * Recorded rather than acted on: a label re-graded because the engine found
   * something is no longer independent of the engine.
   */
  regradeFlag?: string;
  notes?: string;
}

export const orbitalGoldSet: GoldEntry[] = [
  {
    company: 'NMS International Group',
    domain: 'nmsinfrastructure.com',
    label: 'A_strong',
    evidence: 'high',
    value: 'high',
    whatChanged:
      'Signed a $427m contract with the Zambian Ministry of Health in August 2024 to design, build and equip five district hospitals and 120 rural health centres; the Ghana district hospital at Fomena is now operational, so the programme is actively delivering.',
    whyDemand:
      'A multi-year turnkey build programme across Sub-Saharan Africa has to land building materials, plant, fit-out and medical equipment on remote sites. That is continuous project cargo with export documentation, not a one-off shipment.',
    whyOrbital:
      'Project freight to Africa is specialist work: oversized and mixed loads, export packing, and documentation for destinations with awkward customs regimes. It plays directly to what Orbital sells and away from commodity pallet freight.',
    salesAction:
      'Approach on the delivery programme, not the contract award. Ask who consolidates and ships the equipment for each site, whether that is handled in-house or per project, and when the next tranche of health centres begins.',
    unknowns: [
      'Whether project logistics is handled in-house — the company lists logistics among its own capabilities',
      'Whether freight is bundled into the EPCF financing and therefore already committed',
      'Current tranche status: how many of the 120 centres remain to be delivered',
    ],
    engineReported: false,
    missReason: 'source_discovery_failure',
    notes:
      'The strongest commercial opportunity in the corpus and the engine reported "no trigger found". The contract is announced on the company\'s own news blog, which no query reached.',
    // 2026-09-09, discovery milestone. The first-party sweep reached the
    // company's own site and found the answer to unknown #1: NMSI runs its own
    // UK export warehouse with an NMSI Logistics team doing pre-shipment
    // testing, QC and containerisation. Project logistics is largely in-house,
    // and only the international leg is still bought.
    //
    // The LABEL IS DELIBERATELY UNCHANGED. Re-grading because the engine found
    // evidence is the circularity this gold set exists to avoid. Recording it
    // instead: on this evidence the value grade looks like `medium`, not
    // `high`, and the label like B rather than A. An Orbital salesperson should
    // settle it.
    regradeFlag:
      'In-house project logistics evidenced 2026-09-09 — value grade and label both likely too generous.',
  },

  {
    company: 'Maeving Ltd',
    domain: 'maeving.com',
    label: 'B_potential',
    evidence: 'high',
    value: 'medium',
    whatChanged:
      '£3m UKEF-backed trade finance facility in August 2026 to build production capacity for the US, Germany and France, with US sales already up fivefold year on year.',
    whyDemand:
      'Funded capacity expansion against a fivefold volume increase means materially more cross-border consignments on lanes that were sized for much smaller flows.',
    whyOrbital:
      'Electric motorcycles carry lithium-ion batteries — UN3480/3481, Class 9 dangerous goods. Every cross-border unit needs DG documentation and compliant packing, which is a named Orbital capability and not something a general haulier absorbs comfortably.',
    salesAction:
      'Lead on the Class 9 documentation and packing, not on rate. Ask whether the current US arrangement was priced before the fivefold increase.',
    unknowns: [
      'Who handles their DG documentation now — they have exported since 2023, so someone does',
      'Whether volumes have outgrown what an SME forwarder can serve',
      'Whether the US flow is containerised or consolidated through a specialist',
    ],
    engineReported: true,
    notes:
      'Value is medium rather than high because this is a displacement sale against a functioning incumbent, not a gap.',
  },

  {
    company: 'deVOL Kitchens',
    domain: 'devolkitchens.com',
    label: 'B_potential',
    evidence: 'high',
    value: 'medium',
    whatChanged:
      'Reported new overseas markets in Thailand, China and Denmark, with 31% of sales exported and overseas revenue up 2,300% over six years.',
    whyDemand:
      'New destinations mean routing, consolidation and customs decisions that the existing US-focused arrangement was not built for.',
    whyOrbital:
      'Bulky, fragile, high-value cabinetry where export packing decides whether it arrives saleable — a named Orbital service — and the company is two miles from Orbital, which matters for pre-shipment inspection.',
    salesAction:
      'Offer to look at a load before it crates. Ask who handles the Thailand and China consignments and whether that is the same arrangement as the US.',
    unknowns: [
      'WHEN the Thailand, China and Denmark markets actually opened — the source describes six years of growth, not a recent event',
      'Whether those markets are material volume or a handful of prestige orders',
      'Who currently crates for export',
    ],
    engineErrors: [
      {
        kind: 'stale_signal',
        detail:
          'Signal dated 2026-05-06, the King\'s Award announcement. The award is not the change; the market openings it recognises are undated and span six years. The recency component is therefore scored against the wrong date.',
      },
    ],
    engineReported: true,
    notes:
      'The engine dated this signal to the King\'s Award announcement (2026-05-06). That is the date of the AWARD, not of the market openings. The "why now" is therefore weaker than the score suggests — a date-attribution problem, not an evidence problem.',
  },

  {
    company: 'Baltex',
    domain: 'baltex.co.uk',
    label: 'B_potential',
    evidence: 'medium',
    value: 'medium',
    whatChanged:
      'Boeing approval opening a US aerospace market, alongside a seven-figure HSBC package funding EU trade flows and a stated 20% export growth target.',
    whyDemand:
      'Aerospace qualification opens a supply chain with traceability and documentation requirements beyond ordinary export paperwork, and 20% more volume across existing EU and UK–Poland routes.',
    whyOrbital:
      'Customs and documentation complexity on a regulated destination sector, plus recurring UK–Poland movements.',
    salesAction:
      'Ask whether US shipments have started and who handled the first ones.',
    unknowns: [
      'The same source says Baltex already has agents in the USA — so the "lane that does not exist yet" framing is questionable',
      'Aerospace technical textiles are low-volume, high-value; the freight spend may be small',
      'Whether the Polish site ships direct to customers or via Ilkeston',
    ],
    engineErrors: [
      {
        kind: 'contradiction',
        detail:
          'The hypothesis asserts a US lane that "does not exist yet" while the fact it rests on states Baltex already has agents in the USA. Same claim, opposite premises, no contradiction recorded.',
      },
    ],
    engineReported: true,
    notes:
      'The engine\'s hypothesis says the US lane "does not exist yet" while the SAME claim states agents in the USA. That internal contradiction was not flagged — a reasoning failure, not an evidence failure. Evidence is medium because all coverage traces to one HSBC release.',
  },

  {
    company: 'Bramble Group',
    domain: 'bramblefoods.co.uk',
    label: 'C_weak',
    evidence: 'medium',
    value: 'low',
    whatChanged:
      'Opened a 67,000 sq ft main UK distribution hub on 31 July 2026; separately acquired Whitakers Chocolates in January 2025.',
    whyNot:
      'The one current, well-evidenced fact — a purpose-built main distribution hub — REDUCES the primary opportunity rather than creating it. They have just bought themselves out of third-party storage. What the engine falls back on is Q4 overflow and outbound haulage, and nothing in the evidence says they will be short of either. The acquisition claim that might imply integration work is 20 months old.',
    unknowns: [
      'Whether they were short of overflow capacity last November',
      'Whether outbound haulage is contracted or in-house',
    ],
    engineErrors: [
      {
        kind: 'value_overstated',
        detail:
          'The engine SAW that the hub closes the storage opportunity — it is stated in its own polarity rationale and carried as a caveat — then declared the polarity demand_increasing anyway and reported the row at 69. Noticing a demand-reducing consequence and not letting it move the score is worse than missing it.',
      },
    ],
    engineReported: true,
    notes:
      'This is the weakest of the four reported. High ICP fit and a recent, well-sourced event mask a thin commercial consequence. Textbook high-evidence / low-value.',
  },

  {
    company: 'Slack & Parr',
    domain: 'slackandparr.com',
    label: 'F_insufficient_evidence',
    evidence: 'high',
    value: 'low',
    whatChanged:
      'Consulting on the loss of up to 40 roles at Kegworth, citing slowing Chinese and Far East investment, tariffs in new export markets and rising domestic costs.',
    whyNot:
      'Correctly rejected as a growth premise — export volumes are falling. But the engine\'s rationale considered volume ONLY. A cost-pressured manufacturer with sites in Kegworth, Charlotte and Shanghai is exactly the profile that reviews suppliers, and supplier review is a valid change family. Nothing in the evidence states a supplier review is happening, so the label is insufficient evidence rather than an opportunity — but the engine never considered the possibility.',
    unknowns: [
      'Whether the restructuring includes a logistics or supplier review',
      'Whether any site consolidation is planned between Kegworth, Charlotte and Shanghai',
    ],
    engineErrors: [
      {
        kind: 'reasoning_depth',
        detail:
          'Rejected at no_commercial_consequence on volume alone. Contraction was treated as terminal; the supplier-review and site-consolidation consequences were never considered.',
      },
    ],
    engineReported: false,
    missReason: 'reasoning_failure',
    notes:
      'Not a missed opportunity — a missed QUESTION. The engine treated demand_reducing as terminal rather than asking what contraction itself might create.',
  },

  {
    company: 'Winbro Group Technologies',
    domain: 'winbrogroup.com',
    label: 'E_no_change',
    evidence: 'low',
    value: 'low',
    whatChanged:
      'Nothing current. The Shepshed advanced machining facility opened in 2015, the Quaser acquisition was 2020, and the Technology Centre plan dates from 2023.',
    whyNot:
      'Researched across three separate query patterns including a contract- and order-specific one. No current commercial change surfaced. A genuine true negative.',
    engineReported: false,
    notes:
      'Validates the no_trigger_found outcome. Good ICP fit — aerospace machinery exporter with US and Taiwan sites — so worth monitoring, not contacting.',
  },

  {
    company: 'Bleckmann',
    domain: 'bleckmann.com',
    label: 'C_weak',
    evidence: 'high',
    value: 'low',
    whatChanged: 'Opening a mega distribution centre in Lutterworth.',
    whyNot:
      'A third-party logistics provider. A competitor expanding, not a prospect. Correctly excluded before any research was spent.',
    engineReported: false,
  },

  {
    company: 'Aldi UK',
    domain: 'aldi.co.uk',
    label: 'C_weak',
    evidence: 'high',
    value: 'low',
    whatChanged: 'Opened a £500m, 1.3m sq ft distribution centre at Bardon.',
    whyNot:
      'Enterprise retailer running its own national distribution network. Unreachable for an SME forwarder regardless of proximity. Correctly excluded before research.',
    engineReported: false,
  },

  {
    company: 'ADS Laser Cutting Ltd',
    domain: 'adslaser.co.uk',
    label: 'B_potential',
    evidence: 'medium',
    value: 'medium',
    whatChanged:
      'First-half 2026 sales up 15% and headcount up 15%, supplying an established Scandinavian customer base including Swedish and Finnish manufacturers.',
    whyDemand:
      'Double-digit growth in a subcontract metalwork business means more outbound consignments to the Nordics, where groupage economics matter.',
    whyOrbital: 'Road groupage and export documentation to Sweden, Finland and Denmark.',
    salesAction:
      'Ask about incoterms first — if they ship ex-works with the customer arranging freight, there is no decision to win.',
    unknowns: [
      'Incoterms — potentially fatal to the whole case',
      'The exact date of the H1 results reporting',
    ],
    engineReported: false,
    missReason: 'target_selection_failure',
    notes:
      'Present in the v1 corpus, then dropped from the target list in v2/v3. Never re-researched. The engine did not fail to find it — nobody asked.',
  },
];

export const goldStats = {
  total: orbitalGoldSet.length,
  byLabel: orbitalGoldSet.reduce<Record<string, number>>((acc, e) => {
    acc[e.label] = (acc[e.label] ?? 0) + 1;
    return acc;
  }, {}),
};
