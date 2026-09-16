# Signal — Validation Protocol (Phase 0)

How we decide whether the Signal methodology actually works, before any
of it gets built into software. The point of Phase 0 is to find out
whether the method produces opportunities a salesperson would genuinely
act on — and to find that out cheaply, on paper, rather than after
building a platform around it.

## Pilot design

Run [`prompts/signal-master-prompt.md`](../prompts/signal-master-prompt.md)
against **three real client websites** chosen to stress different parts
of the method:

| Pilot | Client type | What it tests |
|---|---|---|
| A | Physical/operational (e.g. logistics, manufacturing, construction services) | Event-driven signals: premises, contracts, expansion |
| B | Technical/professional services (e.g. IT, software, consultancy) | Softer signals: hiring, leadership, tech change, funding |
| C | SME-focused offer, small-business targets | Sparse-data handling and hypothesis classification |

Ask for 20 opportunities per pilot, not 50. A 20-row run exercises the
whole funnel and is cheap enough to repeat after each methodology fix.
Scale to 50 only once a run passes.

Store each run under `runs/<client-slug>/<YYYY-MM-DD>/` with the filled
prompt, the raw output, and the completed scorecard below.

## Grading

Grade a **random sample of 10 rows** per run — not the top 10, which
flatters the method. For each row, check:

| # | Check | Pass condition |
|---|---|---|
| 1 | Evidence exists | A real, reachable source URL supports the stated signal |
| 2 | Source is accurately represented | The source actually says what the row claims |
| 3 | Date is real | The signal date matches the event/announcement, not the crawl |
| 4 | Signal is a signal | Something happened — not size, sector, or apparent success |
| 5 | Why now is specific | Names what changed and what it implies; no "they may need X" |
| 6 | ICP fit is real | The company genuinely matches the client's buyer, not just the industry |
| 7 | Decision maker is right | Correct function, currently there, publicly sourced |
| 8 | Sales angle is usable | A salesperson could open a call with it unedited |
| 9 | Score is justified | The breakdown supports the total; caps applied correctly |
| 10 | No fabrication | No invented company, person, quote, figure or URL |

**Row passes** only if checks 1–5 and 10 all pass. 6–9 are quality marks,
recorded but not fatal individually.

### Run-level thresholds

| Metric | Target |
|---|---|
| Rows passing | ≥ 80% of the sample |
| Fabrications (check 10) | **Zero.** Any fabricated source, person or figure fails the run outright |
| Funnel evidence | Candidate pool ≥ 5× the number returned |
| Duplicate leakage (run 2 onwards) | Zero repeated company+signal pairs |
| Distinct signal models | Pilots A/B/C produce visibly different signal models |
| Honest shortfall | If quality is thin, the run returns fewer rows and says so — padding fails the run |

A single fabricated citation is disqualifying regardless of the other 19
rows, because it is the one failure mode a customer cannot detect and
will not forgive.

## Human read

Numbers aren't the whole test. For each pilot, a person who could
plausibly sell the client's service reads the top 10 and answers:

1. Would you actually call these companies?
2. Which rows are obviously weak, and what gave them away?
3. Is this better than an hour of manual prospecting? By how much?

If the answer to (3) is "not really", the methodology is not ready and no
amount of software will fix it.

## Iteration

Each failed check maps to a fix in `docs/RESEARCH_METHODOLOGY.md` or the
master prompt — not to a special case in the output. Log what changed and
why, bump the version in both files, and re-run the affected pilot.

## Exit criteria — when Phase 0 is done

All of the following, on two consecutive runs per pilot:

- ≥ 80% row pass rate, zero fabrications.
- Duplicate leakage zero on the second run of each pilot.
- Human read says the output beats manual prospecting.
- The methodology has been stable (no substantive rule changes) across
  those two runs.

At that point the method is worth automating, and
[`docs/SIGNAL_PROJECT_STATE.md`](SIGNAL_PROJECT_STATE.md) §3 step 4
applies: build the smallest slice that runs the proven process and stores
its output — not the full platform at once.
