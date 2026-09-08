# Signal — Research Methodology (v0.1)

This is the intelligence logic behind Signal, written to be executed by a
human + AI researcher today and turned into software later. It is
deliberately independent of any application, database or UI.

The executable form of this document is
[`prompts/signal-master-prompt.md`](../prompts/signal-master-prompt.md).
This file explains *why* each step exists and defines the fixed rules
(scoring weights, recency bands, source tiers) the prompt refers to.

---

## 1. The pipeline

```
CLIENT WEBSITE
   → ICP & Offer Model        (what the client sells, to whom, and when demand appears)
   → Signal Model             (which events create a reason to buy, for THIS client)
   → Broad Search             (100–200+ candidates)
   → Evidence Gathering       (source, date, claim, URL)
   → Contradiction Pass       (try to kill each candidate)
   → De-duplication           (against the run ledger)
   → Scoring & Ranking        (fixed rubric, section 5)
   → REPORT                   (top N, or fewer)
```

Every stage narrows the pool. The funnel is the product — a run that
searches for 50 companies and returns 50 companies has skipped the
method.

**Target funnel shape for a 50-opportunity run:**

| Stage | Expected count |
|---|---|
| Raw candidates identified | 120–200 |
| Survive ICP screen | 70–120 |
| Have a locatable, dated signal | 50–90 |
| Survive contradiction pass | 40–70 |
| Survive de-duplication | 35–65 |
| Scored ≥ 45 (reportable) | whatever remains |

If the reportable count is 31, report 31. Padding is a methodology
failure, not a presentation problem.

---

## 2. Stage 1 — ICP & Offer Model

Derived from the client website alone (plus their own published case
studies, careers page and pricing where available). Produce:

- What they sell, in concrete deliverables — not marketing language.
- The problem each offering solves, stated as a business pain.
- Who buys (industry, size, geography, structure).
- **The demand trigger question:** what has to happen inside a company
  before it needs this? This is the single most important output of
  this stage — it defines the signal model.
- Who owns the problem (function, not seniority — see section 6).
- Obvious alternatives/incumbents a prospect might already use.
- Disqualifiers: company types that look like a fit but aren't.

Write these down before searching. An unwritten ICP produces a
retrofitted one that justifies whatever the search happened to find.

---

## 3. Stage 2 — Signal Model

For each ICP, list the events that would create a genuine reason to
contact a company *now*, ranked by how directly they imply demand for
this client's offering.

The taxonomy below is the starting library. **Strength is not fixed by
signal type — it is fixed by the link between the signal and the
client's offer.** A leadership change is a strong signal for a
consultancy selling to a new CTO and a weak one for a pallet supplier.

| Signal type | Typical strength | Strong when |
|---|---|---|
| Contract / tender win | High | Delivery capacity must scale |
| New premises, site or facility | High | Fit-out, logistics, services follow |
| Funding round / investment | High | Budget is released and being spent |
| Acquisition / merger | High | Systems, suppliers, teams get consolidated |
| Rapid or role-specific hiring | Medium–High | Roles map to the client's offer |
| Geographic / market expansion | Medium–High | New operational requirements appear |
| New product or service launch | Medium | Launch creates a supporting need |
| Senior leadership change | Medium | The new hire owns the client's problem |
| Regulatory / compliance change | Medium | Deadline forces action |
| Technology or system change | Medium | Migration creates adjacent needs |
| Partnership / distribution deal | Medium | Volume or footprint changes |
| Relocation | Medium | Everything gets re-procured |
| Supply-chain disruption | Medium | Existing arrangement is under strain |
| Award / listing / PR piece | Low | Rarely a reason to buy on its own |

Add client-specific signal types freely. The taxonomy is extensible by
design; the rules in sections 4–5 are not.

**Signal date** is the date of the *event or announcement*, not the date
the page was crawled or last modified.

---

## 4. Evidence rules

Every opportunity must carry at least one piece of dated, sourced
evidence. No exceptions, and these three failures are the common ones:

- ❌ Fit stated as a signal: "large logistics firm in the region."
- ❌ Inference stated as fact: "they must be expanding."
- ❌ Undated evidence treated as current.

**Source tiers:**

| Tier | Source | Use |
|---|---|---|
| 1 | First-party: company announcement, filing, careers page, investor update | Can carry an opportunity alone |
| 2 | Public records: Companies House, planning applications, tender portals, regulators | Can carry an opportunity alone |
| 3 | Established trade press, reputable news | Strong support; alone caps score at 75 |
| 4 | Aggregators, directories, syndicated reposts | Support only; never sole basis |
| 5 | Social posts, forums, unattributed blogs | Lead generation for further research only |

**Independence:** three outlets running the same press release are one
source, not three. Only count sources that could have failed
independently. Syndication is the most common way a run inflates its own
confidence.

**Recency bands** (applied in scoring, section 5):

| Age of signal | Treatment |
|---|---|
| ≤ 30 days | Full marks |
| 31–90 days | Minor penalty |
| 91–180 days | Significant penalty |
| 181–365 days | Heavy penalty; needs a reason it's still live |
| > 365 days | Excluded, unless structural and ongoing (e.g. a facility still being built) |

---

## 5. Contradiction pass

Before scoring, actively attempt to disprove each surviving candidate.
Anything that survives only because nobody looked is not intelligence.

Ask, and record the answer:

1. Is the signal real, or an announcement of an intention?
2. Has it since been cancelled, delayed, or reversed?
3. Is the source current, or an old page that reads as new?
4. Does the company genuinely fit the ICP, or only superficially?
5. Is the need already met — an incumbent supplier, an in-house team, a
   recent competing purchase?
6. Is the named decision maker still there and still responsible?
7. Is the commercial link real, or a chain of two or more inferences?
8. Is this stronger than the candidates ranked below it?

**When evidence conflicts, surface it — never average it away.** A
contradiction found and stated is a feature; a contradiction smoothed
over destroys trust in every other row in the report.

Outcomes: `clear` · `caveat` (note it in the row) · `conflicting —
review required` (score capped, see below) · `killed`.

---

## 6. Scoring

Score 0–100, from six components. The breakdown must be shown, not just
the total.

| Component | Max | What earns full marks |
|---|---|---|
| ICP fit | 25 | Matches industry, size, geography and buying structure |
| Signal strength | 20 | Signal directly implies demand for this client's offer |
| Signal recency | 15 | ≤30 days (see bands, section 4) |
| Evidence quality | 15 | Tier 1–2, or 2+ genuinely independent sources |
| Commercial relevance | 15 | A specific, articulable "why now" with a plausible deal |
| Decision-maker clarity | 10 | Named, current, owns this problem |

**Caps and penalties, applied after the components:**

- Single tier-3 source only → cap 75
- No date established for the signal → cap 65
- Tier 4–5 sources only → cap 50 (and classify as hypothesis at best)
- `conflicting — review required` → cap 60, and never auto-promote
- Each additional inference step between signal and need → −10

**Bands:**

| Score | Classification |
|---|---|
| 75–100 | Confirmed opportunity |
| 60–74 | Probable opportunity |
| 45–59 | Hypothesis — validation required |
| < 45 | Insufficient evidence — excluded from the report |

**Confidence** is reported separately from score, because a
well-evidenced small opportunity and a thinly-evidenced large one must
not collapse into the same number:

- **High** — tier 1–2 evidence, dated, no contradictions.
- **Medium** — good evidence with a gap (date approximate, one source,
  or an unresolved minor caveat).
- **Low** — inference-heavy, weak sourcing, or an open contradiction.

Do not inflate. A run of 30 honest scores is worth more than 50
flattering ones, because the client discovers the difference on their
first ten calls.

---

## 7. De-duplication and freshness

Each client keeps a **run ledger** — one row per opportunity ever
reported: run date, company, domain, signal type, signal date, score,
outcome if known. Before a candidate enters the report, check it.

- Same company, same signal → exclude.
- Same company, materially different and newer signal → may be
  included, with an explicit note on what changed.
- Same company, no new signal, just a different framing → exclude. This
  is the main way a daily run degrades into recycling.

Domain is the identity key, not company name. Name matching alone
merges distinct companies and splits single ones.

---

## 8. Output

Report header, then executive summary, then ranked rows.

```
SIGNAL COMMERCIAL INTELLIGENCE REPORT
CLIENT / WEBSITE / DATE / TARGET MARKET / TARGET INDUSTRIES / NUMBER REQUESTED
```

Executive summary covers: market observations, which signal types were
most productive this run, patterns worth noting, the standout
opportunities, and — required — the limitations of the research
(what couldn't be verified, where coverage was thin, why the count is
what it is).

Per opportunity: `RANK · COMPANY · WEBSITE · LOCATION · INDUSTRY · ICP
FIT · SIGNAL · SIGNAL DATE · EVIDENCE · SOURCE · DECISION MAKER · ROLE ·
WHY NOW · COMMERCIAL OPPORTUNITY · RECOMMENDED SALES ANGLE · SCORE (with
breakdown) · CONFIDENCE · CONTRADICTIONS`.

**Why now** must name what happened, when, and what it implies:

- ❌ "They may need logistics support."
- ✅ "Announced a 40,000 sq ft Leicester facility in June and is
  recruiting warehouse and transport roles, so outbound distribution
  volume is about to rise faster than their current fleet covers."

**Sales angle** must connect signal → business problem → client
solution, in language a salesperson can use on a call without
rewriting it.

---

## 9. Decision makers

Choose the person who owns the problem the signal creates, not the most
senior person available. CEO is the right answer mainly at small
companies where they own everything.

Use only publicly available professional information — role, employer,
public profile. Do not compile or infer personal contact details;
UK/EU data protection applies to this work from the first run, not from
the first paying customer.

---

## 10. Client adaptation

The framework is fixed. The content of the ICP, the signal model, the
sources searched and the weighting of signal strength are rebuilt per
client, every time. A logistics client and an IT services client run the
same method over completely different signals — if two clients produce
similar-looking signal models, the ICP stage was done poorly.
