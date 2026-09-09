# Two-axis scoring — evidence and commercial value, separately

_Orbital Direct · 2026-09-09 · `npm run benchmark`_
_Raw output: `runs/orbital-direct/2026-09-09-two-axis-benchmark.txt`_

**The axes are now genuinely independent — correlation −0.59, where one score
made it 1 by construction. Contact precision is 100%: the false positive is off
the call sheet, and so is the row that needs verifying first. Absolute value
calibration did not improve: all four rows still band one grade high.**

Same corpus, same discovery, same researcher judgements as the last milestone.
Only the scoring model differs. **267 tests pass** (242 before, 25 added),
typecheck clean.

---

## The defect this fixes

From the discovery report: deVOL crossed the 75-point `CONFIRMED_OPPORTUNITY`
threshold on the strength of gaining a fourth independent source, with nothing
about its commercial case changed. Improving discovery moved value agreement
from 25% to **0%**. A score that gets less truthful as the evidence improves is
the wrong shape.

`docs/ORBITAL_COMMERCIAL_BENCHMARK.md` had already stated the principle:
*"Evidence quality and commercial value are independent, and conflating them is
how a well-sourced irrelevance gets sold as an opportunity."*

## What was built

`engine/src/two-axis.ts`, plus pipeline wiring and `engine/test/two-axis.test.ts`.

**EVIDENCE (0–100) — how well established is it that this change happened?
Entirely deterministic; no researcher judgement enters it.**

| Component | Max | From |
|---|---|---|
| Source authority | 40 | best tier present, contextual to the claim's topic |
| Independence | 25 | distinct origins — syndicated copies count once |
| Verification | 20 | page retrieved and passage matched, vs snippet |
| Dating | 15 | whether the change has an established date at all |

**VALUE (0–100) — how much is a sale here worth pursuing, given the change?**

| Component | Max | From |
|---|---|---|
| ICP fit | 25 | researcher judgement (unchanged weight) |
| Signal strength | 20 | researcher judgement (unchanged weight) |
| Commercial relevance | 15 | researcher judgement (unchanged weight) |
| **Demand direction** | **15** | **NEW — deterministic, from polarity + actionability** |
| Timing | 15 | freshness (unchanged weight) |
| Buyer identified | 10 | owning function identified (unchanged weight) |

Evidence caps bite the evidence axis only. The reasoning-hop penalty bites
value only — the sources may be impeccable and the link to a sale still
speculative. Confidence is read from the evidence axis alone: a confident
belief in a commercially uninteresting change is still a confident belief.

**No new thresholds were invented.** Band boundaries (75 / 60 / 45) and the
reportable floor (60) are the single-axis model's own numbers, applied per
axis. Every pre-existing weight is carried across unchanged. The only addition
is demand direction — the component every previous report found missing.

### Demand direction

| Polarity | Points | Why |
|---|---|---|
| `demand_increasing` | 15 | the change increases demand for this client's offer |
| `neutral` | 7 | demand-neutral |
| **absent / unestablished** | **7** | *not establishing a direction is not establishing growth* |
| `demand_reducing` | 0 | real change, wrong way |
| consequence not actionable | 0 | whatever the polarity |

Under the old model a demand-increasing and a demand-reducing candidate scored
**identically** — polarity carried no weight at all. There is a test asserting
exactly that, so the gap cannot quietly reopen.

### Quadrants

| | High value (≥75) | Value below 75 |
|---|---|---|
| **High evidence (≥75)** | `ACT_NOW` → draft_outreach | `LOW_VALUE` → **monitor** |
| **Evidence below 75** | `RESEARCH_PRIORITY` → research_further | `WATCH` → monitor |

Rejected only when **neither** axis clears 60.

**A rule I changed after seeing the first result, and why.** I first wrote
reportability as "both axes must clear the floor". The first run dropped Baltex
entirely — strong commercial case, one syndicated source. But the benchmark
document, written before this milestone, names that cell *"Research priority —
verify before contact"* and reserves *"Reject"* for the low/low cell. A row
worth verifying is not a row to throw away. The rule now follows the document.
The reasoning is in the code, at `quadrantOf`.

**Reporting a row and putting it on a call sheet are now different acts.**
`LOW_VALUE` is reported and not recommended for contact, because the benchmark
calls that cell "interesting, not worth sales time". Both precision numbers are
reported below so the separation cannot be used to flatter the engine.

---

## Results

### The same run, scored both ways

| Company | Single axis | Two axes | Gold (ev/val) |
|---|---|---|---|
| Baltex | 77 → **draft_outreach** | ev 67 / val 83 → **research_further** | medium/medium (B) |
| Maeving | 79 → draft_outreach | ev 85 / val 81 → draft_outreach | high/medium (B) |
| deVOL Kitchens | 75 → draft_outreach | ev 91 / val 76 → draft_outreach | high/medium (B) |
| Bramble Group | 68 → **call** | ev 83 / val 72 → **monitor** | medium/low (**C_weak**) |

Two decisions changed, both toward the gold set:

- **Bramble comes off the call sheet.** Not by lowering its value — its value is
  still 72 — but by refusing to let evidence of 83 rescue it. The single-axis
  model gave it 68 and said `call`.
- **Baltex moves from outreach to verification.** Its gold evidence grade is
  `medium`, and its gold `salesAction` is *"Ask whether US shipments have
  started and who handled the first ones"* — a qualification question, not a
  pitch. The two-axis model reaches the same conclusion the human read did.

### Metrics

| | Single axis (v5) | Two axes (v5) |
|---|---|---|
| Reported | 4 | 4 |
| Precision over everything reported | 75% | 75% |
| **Call sheet** | **4** | **2** |
| **Contact precision** | 75% | **100%** |
| Evidence agreement | 100%¹ | 75% |
| Value agreement (band) | 0% | **0%** |
| Value ordering (tau over gold value) | +1.00 | **+1.00** |
| **Axis correlation** | **1 by construction** | **−0.59** |

¹ The single-axis figure compares the engine's *confidence* to the gold
evidence grade; the two-axis figure compares an actual evidence score. They are
not the same measurement, and the two-axis one is the more demanding.

### The honest run — page retrieval blocked

| Company | Evidence | Value | Quadrant | Action |
|---|---|---|---|---|
| Baltex | 53 low | 83 high | RESEARCH_PRIORITY | research_further |
| Maeving | 70 medium | 81 high | RESEARCH_PRIORITY | research_further |
| deVOL | 70 medium | 76 high | RESEARCH_PRIORITY | research_further |
| Bramble | 69 medium | 72 medium | WATCH | monitor |

**Call sheet: zero.** With no page retrieved, nothing is contact-ready, and the
engine says so on the evidence axis rather than by capping a fused number. Every
genuine opportunity is still reported — as a research priority, which is what it
is. That is the behaviour I would want in production on a day the retriever is
down.

---

## What did not improve

**Value agreement is still 0% by band. All four rows read one grade high.**

The value axis is 60 of its 100 points of researcher judgement (ICP fit, signal
strength, commercial relevance), and three of its six components are effectively
constant across this corpus:

- `demandDirection` — 15/15 on all four rows
- `buyerIdentified` — 10/10 on all four rows
- the hop penalty — −10 on all four rows

So the spread comes from three components and lands in a 72–83 band. The model
**orders** correctly — value ordering tau is +1.00, with every gold-medium row
above the gold-low one — and is **miscalibrated in absolute terms**.

Band agreement and ordering are different questions and I report both. Band
agreement assumes a calibration nobody has established; ordering asks the
weaker, fairer question of whether the engine puts the more valuable company
first. On the evidence here: the ordering is right, the numbers are too high.

**The demand-direction component is untested by live data.** Every signal that
survived to scoring declared `demand_increasing`. The one demand-reducing signal
in the corpus — Slack & Parr — is rejected earlier, at
`no_commercial_consequence`, and never reaches the scorer. The component's
discriminating power is proven only by unit test.

**Bramble is still not caught for the right reason.** Its declared polarity is
`demand_increasing`, so it takes the full 15 direction points, while its own
polarity rationale says the new hub *"closes the storage opportunity"*. What
keeps it off the call sheet is the structural refusal to let evidence rescue
value — and the margin is three points. That is thin, and it is luck as much as
design. The underlying defect is a mis-declared polarity, unchanged since v4.

**A risk this milestone creates.** Direction is now worth 15 points and comes
from a label the extractor supplies. Making a label worth points raises the
stakes on validating it, and `validatePolarity` is still lexical — it produced
no warning for Bramble. The next milestone should close that.

---

## Next

1. **Evidence-grounded polarity.** Make `demandDirection` deterministic rather
   than trusting the declared label: check the direction against the facts the
   hypothesis rests on, and treat an unsupported direction as `neutral`. This is
   now the highest-value fix — it is the Bramble defect, and this milestone just
   attached 15 points to the thing that is wrong.
2. **Date attribution** — distinguish the date of an announcement from the date
   of the change, and stop an undated current claim being aged by an older
   corroborating one. Still the NMS blocker.
3. **Ground more of the value axis in evidence.** Three of six components are
   constant and 60 points are researcher self-assessment. Deriving signal
   strength and commercial relevance from the claim chain rather than from a
   supplied number is what would move absolute calibration.
4. Alias discovery; intra-chain contradiction checking.

---

## What this cannot tell you

- **Four reported rows.** Contact precision of 100% is two companies out of
  two. One reclassification changes everything.
- **The gold labels are still not independent** — same agent built the engine
  and wrote them.
- **Two decisions changed and both went the right way. That is not a trend.**
  A model that moved two of four rows on a ten-entry benchmark has been shown
  to be *differently* wrong, not shown to be right.
- **Verification remains fixture-based.** The reconstructed run's page-level
  evidence is snippet-derived; the honest run has none, and its call sheet is
  empty for that reason.
