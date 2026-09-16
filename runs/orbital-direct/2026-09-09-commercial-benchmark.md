# Commercial validation of the Signal loop

_Orbital Direct · 2026-09-09 · `npm run benchmark`_
_Raw output: `runs/orbital-direct/2026-09-09-benchmark.txt`_

The question this run answers is not "does the engine work" but **"does it find
commercially useful reasons to contact a company?"** Those are different
questions, and the engine passes the first more comfortably than the second.

**Headline: precision 75%, and the single strongest opportunity in the corpus
was never surfaced.** The engine reported four companies. Three are worth a
salesperson's time. None of them is the best one available.

---

## What was measured against what

| Deliverable | Artefact |
|---|---|
| A. Commercial benchmark | `docs/ORBITAL_COMMERCIAL_BENCHMARK.md` |
| B. Gold set | `engine/benchmark/gold-set.ts` — 10 entries |
| C–E. Evaluation | `engine/src/analysis/evaluation.ts`, `engine/scripts/benchmark.ts` |
| Reasoning tests | `engine/src/analysis/reasoning.ts` |
| Tests | `engine/test/evaluation.test.ts` — 20 new; **210 passing** |

**The gold labels were written from the sources, applying the benchmark
document, without reference to any engine score.** The label decides what is
correct; the engine's score never appears on the right-hand side of a
comparison.

**Stated limitation, first rather than last: the same agent built the engine
and wrote the labels.** Where a label disagrees with the engine — five of the
ten entries do — that is meaningful. Where it agrees, it is weak evidence and
should be re-graded by an Orbital salesperson before anyone trusts it.

Two runs are reported throughout, because the environment still blocks page
retrieval: **A (unverified)** is the honest state, **B (reconstructed)** exercises
the verification path against snippet-derived pages and is not live
verification. All figures below are run B unless stated.

---

## C. Engine versus gold

| | Count |
|---|---|
| Gold entries | 10 |
| Put to the engine | 9 |
| Reported as opportunities | 4 |
| True positives | 3 |
| False positives | 1 |
| False negatives (researched, missed) | 1 |
| True negatives | 4 |
| Genuine opportunities never researched | 1 |

| Rate | Value |
|---|---|
| **Precision** (TP / reported) | **75%** |
| **False-positive rate** (FP / reported) | **25%** |
| False-positive rate over negatives (FP / (FP+TN)) | 20% |
| Recall over all gold entries | 60% |
| Recall over companies actually researched | 75% |
| **Genuine opportunities missed** | **2** |

Per company:

| Company | Gold | Evidence | Value | Verdict | Engine |
|---|---|---|---|---|---|
| NMS International Group | A_strong | high | high | **false negative** | not reported — `no_trigger_found` |
| Maeving Ltd | B_potential | high | medium | true positive | #1 · 78 · High · draft_outreach |
| Baltex | B_potential | medium | medium | true positive | #2 · 77 · Medium · draft_outreach |
| deVOL Kitchens | B_potential | high | medium | true positive | #3 · 74 · Medium · call |
| Bramble Group | C_weak | medium | low | **false positive** | #4 · 69 · Medium · call |
| Slack & Parr | F_insufficient | high | low | true negative | `no_commercial_consequence` |
| Winbro Group | E_no_change | low | low | true negative | `no_trigger_found` |
| Bleckmann | C_weak | high | low | true negative | `icp` — no research spent |
| Aldi UK | C_weak | high | low | true negative | `icp` — no research spent |
| ADS Laser Cutting | B_potential | medium | medium | **never researched** | never put to the engine |

### Ranking quality

Kendall tau **+1.00** — no inversions. That number flatters the engine and
should not be quoted without its denominator: **of six ranked pairs, three are
tied on gold value and carry no information.** The engine got the one real
distinction right (it placed the low-value row last) and was never asked a
harder question. Ranking is *unfalsified*, not *validated*.

### Recommended-action mix

| | Run A (unverified) | Run B (reconstructed) |
|---|---|---|
| `research_further` | 4/4 (100%) | 0/4 (0%) |
| `draft_outreach` | 0/4 (0%) | 2/4 (50%) |
| `call` | 0 | 2/4 (50%) |

This is the verification cap moving, working exactly as designed: unverified
evidence forces `research_further`; page-level evidence releases outreach. It
also shows the risk that lifting the cap creates — **both `draft_outreach`
recommendations are on B_potential rows, not A_strong ones.** The engine is
recommending contact on companies where the gold set says a material unknown
(incumbent, volume, timing) is still outstanding. Not wrong, but the outreach
must be written as a question, and today nothing in the output enforces that.

### Error classes

| Class | Count | Where |
|---|---|---|
| Identity errors | **0** | the Brambles/CHEP source was correctly rejected at the identity gate |
| Stale-signal errors | **1** | deVOL — dated to the award, not the change |
| Contradiction errors | **1** | Baltex — US lane "does not exist yet" against a fact stating US agents |
| Reasoning-depth errors | **1** | Slack & Parr — contraction treated as terminal |
| Value-overstatement errors | **1** | Bramble — demand-reducing consequence seen and then not scored |
| Extraction failures | **0** | 11 claims, 0 discarded on schema |

Identity resolution, hardened in v2, is the one subsystem that produced **zero**
errors on this benchmark.

---

## D. Evidence quality

Engine confidence against the independent read of the sources:

| | Run A | Run B |
|---|---|---|
| Agreement | 2/4 (50%) | **3/4 (75%)** |
| Overstated | 0 | **0** |
| Understated | 2 (Maeving, deVOL) | 1 (deVOL) |

**Every disagreement is in the safe direction.** The engine has never claimed
better evidence than the sources support — in run A the verification cap held
it a full grade below the truth on two rows, and in run B only deVOL remains
understated. deVOL sits at Medium because its best source is tier 3; the gold
read is `high` because the claim is on deVOL's own journal and corroborated. A
defensible disagreement, and the conservative side of it.

Against the failure mode this project exists to prevent — a plausible-sounding
opportunity with evidence that does not carry it — **the evidence layer is the
part that is working.**

---

## E. Commercial value

Engine score band against the independent read of commercial value:

| | Run A | Run B |
|---|---|---|
| Agreement | 3/4 (75%) | **1/4 (25%)** |
| Overstated | 1 (Bramble) | **3 (Maeving, Baltex, Bramble)** |
| Understated | 0 | 0 |

This is the finding that matters, and it is the mirror image of the evidence
result. **Removing the verification ceiling improved evidence calibration and
broke value calibration.** Maeving and Baltex cross 75 into
`CONFIRMED_OPPORTUNITY` — a high-value band — on the strength of *better
evidence for a medium-value change*. Nothing about the commercial case moved.

Two axes, one number. The score is dominated by how well the change is
evidenced, and cannot say "well-proven, and worth little".

### The two-axis matrix

Rows are evidence, columns are commercial value; `*` marks reported.

| | **value high** | **value medium** | **value low** |
|---|---|---|---|
| **evidence high** | NMS | Maeving\*, deVOL\* | Slack & Parr, Bleckmann, Aldi |
| **evidence medium** | — | Baltex\*, ADS Laser | Bramble\* |
| **evidence low** | — | — | Winbro |

**The engine reported four rows and not one of them is in the high/high cell.
The only entry that is — NMS — it never surfaced.** Read as a sales list: the
engine returned the middle of the grid and missed the corner.

---

## F. Maeving — the strongest row, and it holds

**78/100, High confidence, draft_outreach. Gold: B_potential, evidence high,
value medium.**

The commercial chain is genuinely specific: US sales up fivefold year on year,
£3m of UKEF-backed finance committed in August 2026 to build capacity behind it,
and every unit carrying a lithium battery — UN3480/3481, Class 9 — so the
documentation burden scales with the volume. Two sources, one tier 2 (gov.uk),
dated, identity matched on three corroborating attributes.

**Where the engine overstates:** `CONFIRMED_OPPORTUNITY` at 78 reads as the
best thing on the list. It is not. Maeving has exported since 2023 and ships
roughly half its output, so an incumbent forwarder is near-certain — the engine
records this as a caveat and then scores as if it were a gap. **This is a
displacement sale**, which is a materially harder sale, and the score does not
know the difference.

**Verdict: correctly reported, correctly ranked first, over-classified.** The
sales angle is right — lead on Class 9, not on rate.

## G. Baltex — right answer, unflagged contradiction

**77/100, Medium confidence, draft_outreach. Gold: B_potential, evidence
medium, value medium.**

The hypothesis reads: *"A brand-new US aerospace lane needs freight and customs
arrangements that do not exist yet."* The fact it derives from reads: *"exports
are 60% of the business, with agents in Hong Kong, Italy, Finland **and the
USA**."*

**Those cannot both be true, and the engine did not notice.** The contradiction
checker compares claims across sources; this contradiction is *inside a single
claim chain*, between a fact and the hypothesis built on it. Nothing looks
there. The caveat the engine did record ("incumbent freight relationships
certainly exist; only the US aerospace lane is genuinely new") is the resolution
— but it sits alongside the contradiction instead of correcting it, and the
hypothesis a salesperson reads still says the lane does not exist.

Evidence is medium because every outlet traces to one HSBC release. The engine
holds Baltex at Medium confidence for exactly that reason even at 77, which is
the independence rule working.

**Verdict: defensible opportunity, defective reasoning.** The pitch as written
would be wrong on a call.

## H. deVOL — the "why now" is dated to the wrong event

**74/100, Medium confidence, call. Gold: B_potential, evidence high, value
medium.**

The change is real: new overseas markets in Thailand, China and Denmark, 31% of
sales exported, bulky fragile cabinetry where export packing decides whether it
arrives saleable, and Orbital is two miles away.

**The signal is dated 2026-05-06 — the date of the King's Award announcement.**
The award is not the change. It recognises six years of growth, and the source
does not date the market openings at all. The engine scored 10/15 for recency
against a date that describes the wrong event. Its own caveat says it: *"the
award itself is not a trigger"* — recorded, then not acted on.

If the market openings turn out to be two years old, the "why now" collapses
entirely and this row should not be on the list. **The engine has no way to
represent "this event is dated, but it is not the date of the change I care
about".**

**Verdict: correctly reported, timing unproven.** The unknown to resolve before
contact is *when*, and it is not currently visible as an unknown.

## I. Bramble — the false positive, and the reason is instructive

**69/100, Medium confidence, call. Gold: C_weak, evidence medium, value low.**

The one current, well-evidenced fact is that Bramble opened a 67,000 sq ft
purpose-built main distribution hub on 31 July 2026. **That reduces the primary
Orbital opportunity. They have just bought themselves out of third-party
storage.**

The engine knows this. Its polarity rationale says so in its own words — *"The
new hub closes the storage opportunity"* — and it carries a caveat saying the
signal "survives on peak overflow and outbound haulage". It then declares the
polarity `demand_increasing` and reports the row.

**Seeing a demand-reducing consequence and not letting it move the score is
worse than missing it.** The fallback case — Q4 overflow, outbound haulage
across three brands — is not evidenced anywhere; nothing in the sources says
Bramble was short of overflow last November or that haulage is contracted out.
The second-order reasoning is plausible, and plausible is the standard this
project exists to reject. The other supporting fact, the Whitakers acquisition,
is 20 months old.

**Verdict: this is the weakest of the four and should not have been reported.**
High ICP fit and a recent, well-sourced event mask a thin commercial
consequence — the textbook high-evidence / low-value cell.

---

## J. Missed opportunities

Two genuine opportunities did not reach the list, for two different reasons.

### NMS International Group — `source_discovery_failure`

In August 2024 NMS signed a **$427m contract with the Zambian Ministry of
Health** to design, build and equip five district hospitals and 120 rural health
centres; its Ghana district hospital at Fomena is now operational, so the
programme is actively delivering. A multi-year turnkey build programme across
Sub-Saharan Africa has to land building materials, plant, fit-out and medical
equipment on remote sites — continuous project cargo with export documentation,
which is the specialist end of what Orbital sells.

**The engine returned `no_trigger_found`.** It ran exactly two queries:

```
NMS International Group Market Harborough news announcement expansion contract
NMS International Group Market Harborough export growth or new overseas market entry
```

Both are the same fixed template applied to every target. The contract is
announced on NMS's own news pages. **No query in the run would ever reach a
company's own newsroom** — there is no first-party sweep, and no query shaped
around the change families the benchmark defines (contract win, project
activity, tender). The registry already knows how to classify a first-party
source authoritatively. Nothing ever asks it to.

This is the whole finding in one row: **the best opportunity in the corpus,
well-evidenced, high-value, and invisible to the engine for want of a query.**

### ADS Laser Cutting — `target_selection_failure`

First-half 2026 sales up 15%, headcount up 15%, an established Swedish and
Finnish customer base — road groupage and export documentation to the Nordics.
It was present in the v1 corpus, dropped from the target list in v2, and never
re-researched. **The engine did not fail to find it. Nobody asked.** There is no
persistence of targets between runs, so a company can silently leave the
universe.

### Slack & Parr — a missed *question*, not a missed opportunity

Correctly rejected: export volumes are falling, so there is no growth premise,
and the engine recorded it as a real current signal with negative polarity
rather than discarding it. That is the right outcome and the right bookkeeping.

But the rationale considers **volume only**. A cost-pressured manufacturer
consulting on 40 roles across Kegworth, Charlotte and Shanghai is precisely the
profile that reviews suppliers — and supplier review is a valid change family in
the benchmark. Nothing in the evidence says a review is happening, so the gold
label is `F_insufficient_evidence`, not an opportunity. **The engine's answer is
right; it reached it without asking the question.** Contraction is treated as
terminal rather than as a change with consequences of its own.

---

## K. False positives

**One, out of four reported: Bramble Group.** Anatomy, because the shape
generalises:

1. **High ICP fit** (20/25) — Leicestershire food manufacturer, physical goods,
   exactly the client's profile.
2. **A recent, well-sourced, correctly-dated event** — 31 July 2026, 40 days old,
   13/15 recency.
3. **A commercial consequence that runs the wrong way**, recognised in prose and
   ignored in scoring.
4. **A fallback consequence that is plausible and unevidenced** — Q4 overflow.

Steps 1, 2 and 4 are all scored. Step 3 is not scoreable at all: `polarity` is a
label on the signal, and there is no component that asks *does this change
increase or decrease demand for this client, and by how much?* The reasoning-hop
penalty is −10 on all four rows identically, so it discriminates nothing.

**The false-positive mechanism is not bad evidence and not bad identity. It is
that commercial value is inferred from the quality and recency of the event
rather than measured.**

---

## Commercial reasoning, tested separately from evidence

`engine/src/analysis/reasoning.ts` searches eight generic constructions — "may
need logistics", "logistics opportunities", "could benefit from freight",
"increased shipping needs", "supply chain challenges", and so on — and separately
counts specificity anchors: named geography, named quantity, named cargo regime,
named service, named timing.

The instrument was validated adversarially, and **caught a real bug in itself**:
the first version failed to match "logistics opportunities" (the regex handled
`opportunit` + `s` but not `opportunities`). Fixed before it was used.

| Company | hypothesis | angle | why now | consequence | levels |
|---|---|---|---|---|---|
| Maeving | specific | specific | specific | thin | 3/3 |
| Baltex | specific | specific | specific | thin | 3/3 |
| deVOL | specific | specific | specific | thin | 3/3 |
| Bramble | specific | specific | specific | specific | 3/3 |

**Generic-logistics hallucinations: 0.** Not one of the four asserts a logistics
need without naming what creates it. Every hypothesis, sales angle and "why now"
names at least two of: a lane, a figure, a regulatory regime, a specific service,
a date.

**Second-order reasoning: 4/4 reach all three levels**, and **0/4 answer their
own third-order question** — every hypothesis carries a test phrased as something
to ask, not something concluded. "Ask whether their current US arrangement was
priced before the fivefold increase." "Ask what they did for overflow last
November."

The three `thin` consequence lines are largely an instrument artefact: the
`consequence.rationale` field is a single clause ("More cross-border consignments
and more Class 9 documentation to produce") and a one-liner rarely carries two
anchors. Not a hallucination, and not counted as one.

**On the specific failure the brief asked about — inventing a generic logistics
need — the engine is clean.** Where the reasoning fails, it fails by being
*wrong about direction* (Bramble), *internally contradictory* (Baltex), *dated to
the wrong event* (deVOL), or *not asked* (Slack & Parr). Those are all different
defects from hand-waving, and all of them are harder to detect.

---

## L. The main bottleneck

**Discovery. Specifically, query construction and target persistence.**

The evidence, in order of weight:

1. **The best opportunity in the corpus was never seen.** NMS's $427m programme
   is high evidence and high value and lives on the company's own news pages.
   Two template queries per company, neither shaped around a change family,
   neither touching first-party sources.
2. **A known opportunity fell out of the universe.** ADS Laser was researched in
   v1 and silently dropped. Targets do not persist.
3. **Everything downstream of discovery performed.** Extraction: 11 claims, 0
   schema failures, 0 fidelity findings. Identity: 0 errors, 1 collision caught.
   Verification: the mechanism works and its cap behaves correctly in both
   directions. Ranking: no inversions.
4. **A true negative took three query patterns to establish.** Winbro is
   genuinely quiet — but confirming that required more searching than the engine
   itself performs, which means `no_trigger_found` at two queries is not yet a
   trustworthy statement.

The engine is a good reasoner reading a corpus that is too small and too
uniformly gathered. Improving scoring, thresholds or extraction would move
nothing: **you cannot score a source you never fetched.**

The second bottleneck, well behind the first, is **value calibration** — one
number carrying two axes, so better evidence for a medium-value change reads as
a high-value opportunity (E), and a demand-reducing consequence cannot lower a
score (I, K).

Explicitly **not** bottlenecks on this evidence: identity resolution, claim
extraction, source classification, the verification mechanism, freshness
bands, hallucination control.

---

## M. Recommended next engineering milestone

**Discovery breadth — make the engine look where the changes actually are.**
Not scoring, not thresholds, not features to patch the four defects above.

Three parts, in dependency order:

1. **First-party source sweep.** For every target, retrieve the company's own
   news, press and blog pages before running general queries. This is where the
   NMS contract lives, it is the most authoritative source for a change at that
   company, and `research/registry.ts` already classifies first-party sources
   correctly for the relevant topic. The gap is that nothing generates the
   request.
2. **Change-family query generation.** Replace the two fixed templates with
   queries derived from the change families in
   `docs/ORBITAL_COMMERCIAL_BENCHMARK.md` — contract win, project and tender
   activity, relocation, market entry, acquisition, capacity expansion. Query
   count per company becomes a cost decision routed through the existing
   provider ledger, not a constant.
3. **Target persistence.** A researched company keeps its place in the universe
   across runs, with its last outcome, so ADS Laser cannot silently disappear
   and `no_trigger_found` accumulates into a monitoring position rather than
   being re-derived each time.

The measurable exit criterion is already built: **rerun `npm run benchmark` and
require NMS to move from `no_trigger_found` to reported, without precision
falling below 75%.** That is a discovery test the current engine fails on a
corpus it has already seen.

Deferred, in this order, and deliberately not started:

- **Two-axis scoring** — separate the evidence score from the commercial-value
  score instead of collapsing both into one number. Fixes E, I and K together.
  This is the right second milestone and the wrong first one.
- **Date attribution** — distinguish "the date of the announcement" from "the
  date of the change", so deVOL's recency is scored against the right event or
  flagged as undated.
- **Intra-chain contradiction checking** — compare a hypothesis against the
  facts it derives from, not only facts against each other. Catches Baltex.
- **Contraction consequence testing** — ask what a demand-reducing change
  creates before closing it. Catches the Slack & Parr question.

**Nothing was tuned to this benchmark.** No threshold, weight, cap or query was
changed as a result of running it. Two files were added — an evaluation module
and a reasoning-measurement module — plus 20 tests; the engine itself is
byte-identical to the v4 run.

---

## What this measurement cannot tell you

- **The labels are not independent.** Same agent, engine and gold set. Five
  disagreements carry weight; five agreements do not. An Orbital salesperson
  re-grading these ten entries is worth more than any further engineering here.
- **n = 10, one client, one county, one week.** Precision of 75% is three
  companies out of four. A single reclassification moves it 25 points.
- **Ranking tau of +1.00 rests on three comparable pairs.** It means "not yet
  wrong", not "right".
- **Verification is still fixture-based.** Run B's page-level evidence comes
  from snippet-derived reconstructions, and a passage match against them is
  close to circular. The action mix in run B — half the list cleared for
  outreach — is what *would* happen with real retrieval, not what has been
  shown to happen.
- **The value axis of the gold set is judgement, not outcome.** No one has
  called these companies. Until someone does, "commercially useful" is an
  informed opinion about a sale that has not been attempted.
