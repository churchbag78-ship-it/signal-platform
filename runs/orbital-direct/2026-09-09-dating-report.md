# Date attribution — which date dates the change

_Orbital Direct · 2026-09-09 · `npm run benchmark`_
_Raw output: `runs/orbital-direct/2026-09-09-dating-benchmark.txt`_

**Precision rose from 75% to 80%. NMS is reported for the first time, and deVOL
lost the "why now" it never earned. Two of five signals are now correctly
marked as carrying no date for the change at all — a state the engine could not
previously express.**

The cost is a ranking inversion, and it is worth more than the headline: **the
engine now places NMS last on commercial value, where the gold set places it
first.** That disagreement is the most useful thing in this run and most of
this report is about it.

305 tests pass (286 before, 19 added), typecheck clean.

---

## The two defects

Both were dating errors, and the last of the four original benchmark findings.

- **deVOL** was dated 2026-05-06 — the day its King's Award was announced. The
  award is not the change; it recognises six years of growth the source does not
  date at all. The engine scored a "why now" against the wrong event, and its
  own caveat said *"the award itself is not a trigger"* — recorded, then not
  acted on.
- **NMS** states on its own site that twelve hospital sites are under
  construction, with no date. Its corroborating facts carried dates, so the
  signal took the most recent of *those* — 27 months old — and was excluded as
  `stale`. **Adding a corroborating source made a current claim look older.**

## What was built

`engine/src/dating.ts`, plus contract and scoring changes.

### A date is not a date

`ExtractedClaim` and `Fact` gain `dateBasis`:

| Basis | Dates the change? |
|---|---|
| `change_occurred` — the source dates the change itself | yes |
| `announced` — dates the announcement; the change may predate it | yes, with a recorded note |
| `recognition` — an award, listing or ranking | **no** |
| `reported_period` — a results period, not a point event | **no** |

Absent is read as `change_occurred` — the permissive default — and the
assumption is recorded rather than hidden.

### Corroboration cannot age a signal

`ExtractionOutput` gains `triggerClaimIds`: the claims that *establish* the
change, as opposed to those that corroborate or contextualise it. The engine
dates the signal from those alone. Without it, a fact about an older, different
change ages a current one.

Absent, every fact may date the signal — the pre-attribution behaviour, which
errs towards dating rather than not, and is recorded as a note.

### Undated is not old

`Signal.changeDate` is now three-valued: a date, `null` (attribution ran and
found none), or `undefined` (no attribution). `null` means **undated**, which
scores no recency and caps evidence, but is **not excluded**. "We do not know
when" is a research question; "it happened three years ago" is a rejection. The
engine could not tell those apart before.

One consequence had to be chased down: `hasDate` on the evidence assessment
asks whether a *source* carries a date, and after attribution that comes apart
from whether the *change* is dated. deVOL's evidence is dated and its change is
not. Everything that penalises an undated signal now asks the second question.

Extraction prompt and fidelity instrument updated; a new fidelity category
catches a date supplied with no statement of what it dates.

---

## Results

### Date attribution across the corpus

| Company | Change date | Basis | Recency | Dates rejected |
|---|---|---|---|---|
| Maeving | 2026-08-15 | announced | 15 | 0 |
| Baltex | 2026-07-20 | announced | 13 | 1 (corroboration) |
| Bramble | 2026-07-31 | change_occurred | 13 | 0 |
| **deVOL** | **undated** | — | **0** | 1 — *the date belongs to a recognition of the change* |
| **NMS** | **undated** | — | **0** | 2 — *a recognition, and a corroborating older change* |

**Two of five signals carry no date for the change.** Both are reported, capped
on evidence, and given no recency.

### Scores

| Company | Before | After | Gold |
|---|---|---|---|
| Maeving | ev 85 / val 81 → draft_outreach | ev 85 / val 81 → **draft_outreach** | high/medium (B) |
| Baltex | ev 67 / val 83 → research_further | ev 67 / val 83 → research_further | medium/medium (B) |
| **deVOL** | ev 91 / val 76 → **draft_outreach** | ev 65 / val 66 → **monitor** | high/medium (B) |
| Bramble | ev 83 / val 64 → monitor | ev 83 / val 64 → monitor | medium/low (C) |
| **NMS** | **excluded — stale** | ev 65 / val 62 → **monitor** | high/high (A, *flagged*) |

### Metrics

| | Before | After |
|---|---|---|
| Reported | 4 | **5** |
| **Precision over everything reported** | 75% | **80%** |
| Call sheet | 2 | **1** |
| Contact precision | 100% | **100%** |
| Evidence agreement | 75% | **40%** |
| Value agreement | 0% | 20% |
| **Value ordering (tau)** | **+1.00** | **−0.14** |
| — excluding the row the gold set flags for re-grade | +1.00 | **+1.00** |
| Axis correlation | −0.39 | +0.22 |

---

## The disagreement about NMS

All four ranking inversions are the same row. The gold set grades NMS
`A_strong`, evidence `high`, value `high`. The engine now ranks it **last of
five on commercial value** at 62.

The engine's case, reached by three independent mechanisms built in three
separate milestones:

1. **Discovery** found NMSI's own announcement that it runs an export warehouse
   next to its headquarters with an in-house logistics team doing pre-shipment
   QC and containerisation. That answered the gold entry's own first unknown —
   *"whether project logistics is handled in-house"* — and it is why the entry
   already carries a `regradeFlag`.
2. **Demand direction** grounded NMS as `neutral`, not growth: the build
   programme increases freight and customs while the in-house warehouse reduces
   warehousing and export packing. It cuts both ways.
3. **Date attribution** finds no date for the change at all. The programme
   statement is undated; the only dates available belong to a 2024 listing and a
   2022 warehouse.

So the engine says: real, specific, well-sourced, in-house-served, and undated.
The gold set says: strongest opportunity in the corpus.

**I have not changed the label.** Re-grading because the engine disagrees is the
circularity this benchmark exists to prevent, and the flag has been on the entry
since the discovery milestone. Both tau figures are reported, full number first;
dropping a row that disagrees with the engine is exactly the move that would let
a benchmark flatter itself.

My own read, for whatever it is worth against a label I also wrote: NMS is a B
at medium value, and the engine is closer to right than the gold set is. **An
Orbital salesperson should settle it.** Until they do, this row is the single
biggest source of uncertainty in every metric on this page.

## The deVOL move, which is unambiguous

deVOL went from `draft_outreach` at 91/76 to `monitor` at 65/66, because the
only date in its evidence belongs to an award. The gold entry says exactly this:

> *WHEN the Thailand, China and Denmark markets actually opened — the source
> describes six years of growth, not a recent event.*

and records the engine error as `stale_signal`. That defect is now closed. It
cost the call sheet its second row, correctly: nothing establishes that deVOL's
change is recent.

## Evidence agreement fell, and I think the model is over-penalising

Evidence agreement dropped from 75% to 40% because deVOL and NMS are now
**understated** — engine `medium` (65) against gold `high`.

There is a real definitional tension here. The gold `evidence` grade asks how
well the *claim* is sourced, and both are well sourced. The engine's evidence
axis now also asks whether the change is dated. A well-sourced undated change is
somewhere between the two, and reasonable people would grade it differently.

But there is also a defect, and it is mine: **an undated change is now penalised
three times for one absence.**

1. the `dating` component scores 0 of 15
2. the no-date cap pulls evidence to 65
3. the `timing` component on the value axis scores 0 of 15

(1) and (2) both live on the evidence axis and both fire on the same fact. The
cap predates the two-axis model, where it was the only thing standing between an
undated signal and a high score; with an explicit dating component it is
redundant. deVOL's raw evidence is 76 and the cap takes it to 65 on top of the
15 it has already lost.

I have not removed it. Changing a scoring rule is its own milestone with its own
measurement, and I have held that line through the last three. It is the first
recommendation below.

---

## What is still wrong

1. **The no-date cap double-counts**, as above. Removing it would raise deVOL
   and NMS to evidence 76 — `high` band, matching the gold grades — without
   touching the value axis or the call sheet.
2. **Value calibration is still poor**, now 20% rather than 0%. Two of six value
   components remain constant across the corpus and 45 of 100 points are
   researcher self-assessment.
3. **`announced` is doing a lot of quiet work.** Three of five signals are dated
   by an announcement rather than by the change, which is honest but weak: a
   press release published in August about a facility agreed in June is dated
   August. The note is recorded and nothing acts on it.
4. **`validatePolarity` is still lexical and still dead weight.**
5. **`triggerClaimIds` is a lever.** An extractor could widen or narrow the
   trigger set to move a signal's date. The engine validates that the ids exist
   and survived the identity gate, and records when they did not; it cannot
   check that the named claims are the ones that establish the change.

## Next

1. **Retire the no-date cap** now that dating is an explicit component, and
   re-measure. Small, contained, and it is the clearest miscalibration on the
   board.
2. **Get the NMS label re-graded by a human.** Every headline metric depends on
   one disputed row, and no amount of engineering resolves it.
3. **Ground more of the value axis in the claim chain** — the long-standing
   recommendation, unchanged.
4. Alias discovery; intra-chain contradiction checking.

## What this cannot tell you

- **Five reported rows and one on the call sheet.** Contact precision of 100% is
  a single company.
- **The four inversions are one row.** Tau is +1.00 without it and −0.14 with
  it; nothing else about the ordering changed.
- **The demand impacts and date bases in the fixtures are mine**, as are the
  gold labels. The rules are tested; no real extractor has been asked to comply
  with them, because there is no LLM API key in this environment.
- **Verification remains fixture-based.**
