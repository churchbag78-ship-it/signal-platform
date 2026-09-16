# Pilot A — scorecard

Graded against `docs/VALIDATION_PROTOCOL.md`. Sample = all 7 reported
rows (fewer than the protocol's 10, because only 7 were reported).

**Caveat on this grading:** it was performed by the same agent that
produced the run. The protocol requires an independent human read, which
has not happened. Treat these marks as a self-assessment, not a
validation.

## Row-level checks

| # | Check | Result |
|---|---|---|
| 1 | Evidence exists — reachable source URL | **Cannot assess (0/7).** Egress blocked; no URL was opened to confirm it resolves or supports the claim |
| 2 | Source accurately represented | **Cannot assess (0/7).** Every claim came from a search-engine summary of the page, not the page |
| 3 | Date is real | **Cannot assess (0/7).** Dates are as reported by search summaries. One row (ADS Laser) has an explicitly estimated date |
| 4 | Signal is a signal | 4/7 clear (Maeving, Baltex, Bramble, ADS). 3/7 marginal — the King's Award rows describe recognition of existing performance, not a change |
| 5 | Why now is specific | 5/7 pass. The two weakest (CMS Cepcor, Zeeko) are specific about cargo type but thin on what changed, and say so |
| 6 | ICP fit is real | 7/7 pass. NMS International was excluded pre-scoring precisely because fit could not be established |
| 7 | Decision maker is right | **0/7.** No decision maker was identified for any row |
| 8 | Sales angle is usable | 7/7 — each opens on the specific event or cargo rather than generic capability |
| 9 | Score is justified | 7/7 — breakdowns shown, caps applied and visible (Baltex 80→75, ADS 69→65) |
| 10 | No fabrication | No company, person, figure or URL was knowingly invented, and one row deliberately withholds reported director names that could not be verified. **But this cannot be positively confirmed** without opening the sources |

## Run-level thresholds

| Metric | Target | Actual | Result |
|---|---|---|---|
| Rows passing (checks 1–5 and 10) | ≥ 80% | 0% — checks 1–3 unassessable | **FAIL** |
| Fabrications | Zero | None knowingly introduced; unconfirmable | **Indeterminate** |
| Candidate pool | ≥ 5× returned | ~25 for 7 = 3.6× | **FAIL** |
| Duplicate leakage | Zero | n/a — first run | — |
| Distinct signal models | Visibly different per pilot | n/a — single pilot | — |
| Honest shortfall | No padding | 7 of 20 returned, with stated reasons | **PASS** |

## Verdict

**The run fails the protocol, on environment grounds rather than
methodology grounds.** Without page-level access the three checks that
matter most — evidence exists, source says what we claim, date is real —
cannot be performed at all, and a research product whose entire value is
verified evidence cannot be validated in an environment that forbids
opening sources.

What the run *does* establish is that the funnel logic, the contradiction
pass and the scoring rubric behave sensibly when applied honestly. Three
of the eight exclusions came from rules doing real work: Slack & Parr on
recency, NMS International on unestablished ICP fit, Bleckmann as a
competitor rather than a prospect.

## Findings — what this run changes

1. **The methodology has no verification-status concept, and needs one.**
   There is currently no rule for evidence that was found but not opened.
   Proposed: a required `VERIFICATION` field per row, and a cap of 70 plus
   a maximum confidence of Medium for any row whose sources were not
   opened. Without this, a degraded run looks identical to a good one.

2. **Decision-maker discovery failed completely — 0 of 7.** This is the
   most important product finding of the run. The methodology assumes the
   right person is publicly discoverable; in practice, for £5m–£50m
   manufacturers, press coverage names founders and managing directors,
   never the operations or supply-chain lead who actually owns freight.
   Search cannot solve this. Either the field is redefined as a research
   task handed to the salesperson, or the eventual product needs a
   people-data provider — which is a cost, coverage and GDPR decision, not
   a prompt-engineering one. This should be settled before any contact
   discovery is designed into the platform.

3. **Trade finance announcements are the highest-yield signal source for
   this client type.** Both top-scoring rows came from export finance
   news — UKEF and bank facilities taken out specifically to fund export
   growth, usually naming the destination markets and the timetable. Add
   UKEF, the major banks' trade finance releases, Innovate UK and regional
   growth funds to the standing source list for logistics clients.

4. **Awards are over-represented and under-powered.** Four of seven rows
   are King's Award winners, which the taxonomy correctly rates as
   low-strength. Their dominance is a discovery failure, not a scoring
   failure — the search stage found award lists more easily than it found
   change events. Future runs need more query patterns aimed at events
   (contract wins, market entries, relocations, funding) and fewer that
   surface directories and lists.

5. **Search summaries flatten dates, and the recency rule is what caught
   it.** Slack & Parr surfaced as a current relocation story; the move was
   2020 and the company went through administration in 2023. Rule to add:
   a date from a search summary is never sufficient — the date must come
   from the source page, or the row takes the no-firm-date cap.

6. **Exclude enterprise-scale logistics news at the query stage.** Aldi,
   Tesco, Waitrose and Bleckmann consumed a meaningful share of the
   discoverable results and were never plausible prospects for an SME
   forwarder. Filtering them after the fact wastes the pool.

7. **The scoring rubric behaved well.** Caps changed two scores, the
   bands matched intuition, and separating confidence from score stopped
   the well-evidenced Maeving row and the thin ADS row from looking alike.
   No change proposed.

8. **Self-grading is not validation.** The protocol already requires a
   human read; this run underlines that the agent that wrote the rows
   should not be the only thing marking them.

## Next action

Re-run Pilot A in an environment with page-fetch access before drawing
any conclusion about whether the methodology works. Until then Phase 0 is
not advanced — the exit criteria in `docs/VALIDATION_PROTOCOL.md` require
two consecutive passing runs and this run cannot pass.
