# Evidence-grounded demand direction

_Orbital Direct · 2026-09-09 · `npm run benchmark`_
_Raw output: `runs/orbital-direct/2026-09-09-direction-benchmark.txt`_

**The direction the engine scores is now derived from the evidence, not
declared by the extractor. Bramble Group is caught by a rule for the first
time: it declares `demand_increasing`, the evidence grounds `neutral`, and the
disagreement is recorded on the signal.** 286 tests pass (267 before, 19 added),
typecheck clean.

> _Side note acknowledged: the Google Stitch product-design track is separate.
> Nothing in this milestone was shaped by it, and no engine interface changed on
> its account._

---

## The risk this closes

The two-axis milestone attached **15 scoring points to `polarity`** — a label
the extractor supplied and the engine took on trust. I flagged it at the time:

> *Making a label worth points raises the stakes on validating it, and
> `validatePolarity` is still lexical — it produced no warning for Bramble.*

Bramble declared `demand_increasing` for a change its own rationale described as
closing the storage opportunity, and took full marks. What kept it off the call
sheet was a three-point margin on the value band. That was luck, not design.

## What changed

**Direction is derived, not declared** — the same move the engine already made
for identity. The extractor states what it read; the engine decides what it
means.

### Per-claim demand impacts

`ExtractedClaim` gains `demandImpacts: {offering, effect, rationale}[]`.

The key word is **per-claim**. One change routinely helps one offering and hurts
another, and a single signal-level polarity label cannot say that. Bramble's new
hub reduces demand for third-party warehousing *and* creates inter-site haulage;
NMS's own export warehouse reduces demand for warehousing and export packing
while its build programme increases freight and customs. A label that has to
pick one word gets both wrong.

An effect without a rationale is rejected at schema validation — an effect
without a reason is a label, and labels are what this contract exists to stop
being taken on trust.

### Three rules in `engine/src/direction.ts`

1. **An impact naming an offering the client does not sell is ignored and
   warned about.** A change cannot create demand for a service nobody offers.
   This is the identity gate's logic applied to commerce.
2. **No grounded impact anywhere → `neutral`, never growth.** Saying nothing
   about direction is not establishing it. An extractor that omits the field
   gets 7 points, not 15.
3. **Increases and reductions together → `neutral`.** A change that helps one
   thing you sell and hurts another is not a growth trigger. The benchmark
   already said as much about consolidation: *"cuts both ways"*.

Only claims that survived the identity gate contribute, so a source about a
different company cannot set the direction.

The declared polarity becomes a **cross-check**. Where it disagrees with the
grounded direction, the engine scores the evidence and records a caveat on the
signal — visible in the output, not buried in a warnings array.

The extraction prompt and the fidelity instrument were both updated: two new
fidelity categories catch an impact on something the client does not sell, and a
direction grounded in nothing.

---

## Results

### Direction, declared versus grounded

| Company | Declared | Grounded | Points | Agrees |
|---|---|---|---|---|
| Maeving | demand_increasing | demand_increasing | 15 | yes |
| Baltex | demand_increasing | demand_increasing | 15 | yes |
| deVOL Kitchens | demand_increasing | demand_increasing | 15 | yes |
| **Bramble Group** | demand_increasing | **neutral** | **7** | **NO** |

Bramble's grounded rationale, in the engine's own words:

> the change increases demand for same-day courier and UK haulage and reduces
> it for warehousing, e-commerce fulfilment and FBA prep — it cuts both ways,
> so it is not a growth trigger

**One of four signals declared a direction the evidence does not support.** No
impact in the corpus named an offering Orbital does not sell.

### Scores

| Company | Two-axis (before) | Two-axis (now) | Gold |
|---|---|---|---|
| Baltex | ev 67 / val 83 → research_further | ev 67 / val 83 → research_further | medium/medium (B) |
| Maeving | ev 85 / val 81 → draft_outreach | ev 85 / val 81 → draft_outreach | high/medium (B) |
| deVOL | ev 91 / val 76 → draft_outreach | ev 91 / val 76 → draft_outreach | high/medium (B) |
| **Bramble** | ev 83 / **val 72** → monitor | ev 83 / **val 64** → monitor | medium/**low** (C_weak) |

**Only Bramble moved, and only Bramble should have.** Three genuinely one-way
changes keep their growth direction and their scores; the one that cuts both
ways loses 8 points.

The decision is the same — `monitor` either way — but it is now reached for the
right reason and with an **11-point margin below the high-value band instead of
three**. The difference between a defensible model and a lucky one.

### Metrics

| | Two axes (before) | Two axes (now) |
|---|---|---|
| Reported | 4 | 4 |
| Precision over everything reported | 75% | 75% |
| Call sheet | 2 | 2 |
| **Contact precision** | **100%** | **100%** |
| Evidence agreement | 75% | 75% |
| Value agreement (band) | 0% | 0% |
| Value ordering (tau) | +1.00 | +1.00 |
| Axis correlation | −0.59 | **−0.39** |

Nothing improved on the aggregate measures, and nothing should have: this
milestone changed *how* one row reached its verdict, not which rows are
reported. Bramble's value band is still `medium` against a gold grade of `low`
— 64 against a boundary at 60.

The axis correlation moved from −0.59 to −0.39 because Bramble's value fell
while its evidence stayed high. That is the axes doing their job.

### The honest run, retrieval blocked

| Company | Evidence | Value | Quadrant | Action |
|---|---|---|---|---|
| Baltex | 53 low | 83 high | RESEARCH_PRIORITY | research_further |
| Maeving | 70 medium | 81 high | RESEARCH_PRIORITY | research_further |
| deVOL | 70 medium | 76 high | RESEARCH_PRIORITY | research_further |
| Bramble | 69 medium | 64 medium | WATCH | monitor |

Call sheet still zero without a retrieved page.

---

## Where the honesty of this rests

**I authored the demand impacts in the fixtures, and I also wrote the rule they
feed.** That is the same circularity the gold set carries, and it deserves to be
named rather than glossed.

Two things limit it, and one does not:

- **The rule is general and the fixtures are strict.** Impacts are declared only
  where a claim's own text supports one. Bramble's acquisition claim and
  headcount claim declare nothing, because neither states a change in goods
  movement. Maeving's £11m raise declares nothing, because a funding round is
  not a statement about freight. Baltex's machine-upgrade claim declares
  nothing, because production equipment is not goods movement.
- **The distinction that matters was decided on the source text, not the
  outcome.** deVOL also bought a 40,000 sq ft industrial building — the same
  shape of fact as Bramble's hub. It declares **no** warehousing effect, because
  the source describes manufacturing consolidation, CNC machines and spraying
  equipment. Bramble's source says the building is *"the main UK distribution
  hub, increasing warehousing and stockholding capacity"*. One is a factory, one
  is a warehouse, and the claims say so.
- **What this does not prove** is that a fresh extractor, given the updated
  prompt and no knowledge of this benchmark, would declare the same impacts. It
  cannot be proven here: there is no LLM API key in this environment. The rule
  is tested; the extractor's compliance with it is not.

### NMS, as a second check the corpus provides

NMS is rejected earlier at `stale`, so it never reaches scoring — but its
direction assessment is computed and recorded, and it comes out **neutral**: the
build programme increases freight and customs, while the company's own export
warehouse and in-house QC team reduce warehousing and export packing. That is
the same finding the discovery milestone flagged for a human re-grade, now
reached mechanically from the claims rather than from prose.

---

## What is still wrong

1. **Value calibration is unchanged.** All four rows still band one grade above
   the gold set. Bramble at 64 against a `low` grade is the closest miss, three
   points into the wrong band. Two of six value components remain constant
   across the corpus (buyer identified 10/10, hop penalty −10 on every row), and
   45 of 100 points are still researcher self-assessment.
2. **Direction is now grounded but still supplied.** The engine derives the
   direction from impacts, and the impacts come from the extractor. What is
   fixed is that a *bare label* can no longer carry 15 points; what is not fixed
   is that a determined extractor could still declare impacts that do not follow
   from its own claim text. The fidelity instrument checks the offering names
   and the presence of rationales; it does not check that a rationale follows
   from the passage.
3. **NMS is still blocked on freshness.** Unchanged from the discovery
   milestone: its undated first-party programme claim is aged by its older dated
   corroboration.
4. **`validatePolarity` is still lexical** and still produced no warning for
   Bramble. It now runs alongside the grounded assessment rather than instead of
   it, so nothing depends on it — but it is dead weight until it is either
   improved or retired.

## Next

1. **Date attribution.** Distinguish the date of an announcement from the date
   of the change, and stop an undated current claim being aged by an older
   corroborating one. This is the NMS blocker and the deVOL "why now" defect,
   and it is the last of the four benchmark findings still open.
2. **Ground more of the value axis in the claim chain.** Signal strength and
   commercial relevance are still numbers a researcher supplies. Deriving them
   from the chain — how many offerings are affected, how directly, how
   specifically the consequence is stated — is what would move absolute
   calibration.
3. Alias discovery (Bramble's newsroom is still invisible); intra-chain
   contradiction checking (Baltex's US lane still contradicts its own fact).

## What this cannot tell you

- **One row moved.** A rule validated by a single live case is a rule that has
  been shown to fire once, not a rule that has been shown to be right.
- **Nineteen new tests exercise the rule; none exercises a real extractor.**
- **The gold labels remain non-independent**, and the demand impacts now share
  that limitation.
