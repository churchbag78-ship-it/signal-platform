# Salvage inventory

_2026-09-14 · a reassessment written after four days of no progress, against
every branch and repository in the account._

This document answers one question: **after the stall, what is actually worth
keeping, and what can it be used for?**

It supersedes nothing. `docs/CRITICAL_REVIEW.md` (2026-09-10) remains correct
and its verdict still stands. This is an inventory, not a new plan.

---

## The short answer

There is a working, tested, zero-dependency reasoning engine — verified running
today — and it is stranded on an unmerged branch while `main` holds a 30-line
README. Two other repositories in the account are **empty on GitHub**; that work
exists only on one local machine.

The wall was never technical. On 2026-09-10 the project deliberately stopped
adding engine capability and asked for one human to grade five briefs. That
grading never happened. Nothing has been built since, and nothing needed to be.

---

## Verified today

Re-run on this branch, against `claude/signal-project-state-cw43qu`:

| Check | Result |
|---|---|
| `node --test test/*.test.ts` | **305 pass, 0 fail**, 1.24s |
| `tsc --noEmit` | **clean**, exit 0 |
| Runtime dependencies | **zero** — TypeScript run natively by Node ≥22.18 |
| Install step required | none (`npm install` only for `@types/node`) |

That combination is worth stating plainly: the engine has no supply chain, no
build step, no framework, and no bit-rot surface. It will still run in a year.
Very little of what gets abandoned is in this condition.

---

## Tier 1 — portable, and useful outside Signal

These modules import **only** `domain.ts` (shared types). They can be lifted
into any other project as a unit, with no Signal concepts attached.

| Module | Lines¹ | What it is, stated generically |
|---|---|---|
| `src/identity.ts` | 12.5 KB | Decide whether a retrieved source is actually about the entity you asked about. Four verdicts, not a boolean. Caught a real collision (Brambles Ltd, Australia vs. Bramble Foods, Market Harborough). |
| `src/claims.ts` | 6.7 KB | Fact → Inference → Hypothesis, enforced by construction. A Fact cannot exist without a valid source; a Hypothesis cannot exist without a grounded Fact. Chain validation, cycle detection, pruning on source rejection. |
| `src/evidence.ts` | 1.8 KB | Verification levels where `page_retrieved` requires the page fetched **and** the passage located within it. Snippet-level evidence cannot be promoted. |

¹ Source sizes, not line counts.

**Where this is reusable:** any retrieval-augmented or agentic system that must
not assert more than its sources carry. That is a general and recurring problem
— it is not specific to sales intelligence. The identity gate in particular
solves "is this document about the right entity", which every company-research,
due-diligence, KYC or monitoring pipeline hits and most handle with a fuzzy name
match.

These three are the most genuinely novel work in the repository and the only
part with obvious application elsewhere.

## Tier 2 — coherent, but Signal-shaped

Sound, tested, and reusable only in something that resembles Signal:
`two-axis.ts` (evidence and commercial value scored on genuinely independent
axes — measured correlation +0.22), `dating.ts`, `direction.ts`, `scoring.ts`,
`freshness.ts`, `dedupe.ts`. Together these are the "deterministic judgement
layer" the critical review found to be real.

## Tier 3 — architecture, never executed

Per the critical review, and unchanged since: `HttpSearchClient` and
`HttpPageRetriever` have never made a request; `LlmClaimExtractor` has never
called a model. The interfaces are injected and the code is written. This is a
credentials-and-network problem, not an engineering one.

## Tier 4 — dead weight, by the project's own assessment

Roughly 2,600 lines built ahead of demand: measurement instrumentation (987
lines, for a ten-row benchmark), provider cost routing (345 lines, for a
deferred feature), extraction fidelity (330 lines, measuring an extractor that
has never run), and four historical pilot scripts (1,270 lines) where one live
entry point would do.

## Tier 5 — the documents

`CRITICAL_REVIEW.md`, `RESEARCH_METHODOLOGY.md` and
`2026-09-10-human-grading-pack.md` are worth more than most of the code. The
grading pack in particular is a finished, honest experiment that was prepared
and then never run — including its own disclosure that deVOL's brief contains an
unsourced claim about three overseas markets, which the chain validator did not
catch because it validates structure and not the free text a salesperson reads.
That defect is recorded and still open.

---

## What is actually at risk

Ranked by how much is lost if nothing is done.

1. **`adaptive-os` and `Business-` are empty on GitHub.** Both were cloned and
   checked on 2026-09-14: zero commits, zero branches. Sessions against
   `adaptive-os` ran on a local bridge and reached an architectural
   reconciliation. None of it was ever pushed. If that machine fails, it is
   gone, and there is no copy anywhere else.

2. **Everything described above is on an unmerged branch.** PR #1 has been open
   since 2026-09-08 — 99 files, 25,785 additions, `mergeable_state: clean`.
   `main` is still the initial README commit. Delete the branch and four
   milestones of work go with it.

3. **The engine's value decays the longer it sits unvalidated**, not because the
   code rots — it does not — but because the briefs in the grading pack are
   dated commercial signals. "Why now" is worth something for weeks. The
   2026-09-09 run is already stale as a live call sheet, though it remains
   perfectly good as a grading instrument, which is all it was ever needed for.

---

## The three things worth doing, in order

Restated from the critical review because they were correct and none were done.

**1. Merge PR #1.** Mechanical, reversible, removes risk 2 entirely. There is no
argument for leaving it open; `main` currently misrepresents the project as
empty.

**2. Push `adaptive-os` and `Business-` from the local machine.** Also
mechanical. Removes risk 1.

**3. Grade the five briefs.** Two hours, no code, one human. This was the
binding constraint on 2026-09-10 and it is the binding constraint now. The
grading pack is written and the artifact is published. Until someone marks
"would I make this call, and why not", every further engine decision is measured
against a ten-row benchmark the engine's own author wrote.

Nothing in tier 4 should be built on. Nothing in tier 3 should be extended
before step 3 is done.

---

## If Signal is not continued

Then the honest salvage is **tier 1, lifted whole**. Three modules, one shared
type file, 305 tests of which the relevant subset travels with them, no
dependencies. They encode a discipline — refuse to attribute a source to the
wrong entity, distinguish "we looked and found nothing" from "we could not
look", decline to assert what the evidence does not carry — that is scarce in
agent and RAG systems generally and would be expensive to rebuild.

That is a real asset independent of whether anyone ever buys sales intelligence
from a Leicestershire freight forwarder.
