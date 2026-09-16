# Discovery milestone — first-party sweep and change-family queries

_Orbital Direct · 2026-09-09 · `npm run benchmark`_
_Raw output: `runs/orbital-direct/2026-09-09-discovery-benchmark.txt`_

**Discovery recall went from 60% to 80%. Precision held at 75%. NMS is no
longer missed — and the same sweep that found it also found the evidence that
its commercial case is weaker than the gold set says.**

Nothing downstream of discovery changed. No scoring weight, threshold,
verification rule, freshness band or commercial-value model was touched, and
the three runs below share byte-identical judgement code. **242 tests pass**
(235 before this milestone, 7 added), typecheck clean.

---

## What was built

| | |
|---|---|
| `engine/src/research/first-party.ts` | Mandatory sweep of every domain a company is known to own |
| `engine/src/research/change-families.ts` | 16 change families with their own query vocabulary |
| `engine/src/research/history.ts` | Durable research state with nine distinct outcomes |
| `engine/src/analysis/discovery.ts` | Discovery measurement, kept apart from precision |
| `engine/test/discovery.test.ts` | 32 tests |

### 1. First-party sweep

Runs before any other query, for every researched company, on the canonical
domain **and verified alias domains only** — an unverified alias confers
nothing here as everywhere else.

Two channels, because either can be unavailable:

- **Direct retrieval** of conventional paths (`/news`, `/newsroom`, `/blog`,
  `/journal`, `/press`, `/press-releases`, `/media`, `/announcements`,
  `/investors`, `/investor-relations`, `/careers`, `/jobs`, `/vacancies`,
  `/projects`, `/our-projects`, `/case-studies`) through the injected
  `PageRetriever`.
- **Site-scoped search** (`site:domain news`) through the injected
  `SearchClient`, which reaches the same pages when retrieval is blocked and
  finds paths this list does not guess.

Both are recorded per section. A section that could not be checked is reported
**unchecked**, never as empty — "we could not look" and "there is nothing
there" are different statements, and the whole point of the history module is
that they stay different.

In this environment direct retrieval was blocked for all 7 researched companies
(42 attempts, 42 refusals) and the site-scoped channel carried the sweep.

### 2. Change-family query generation

Sixteen families, each with its own vocabulary: `major_contract`, `project`,
`new_market`, `expansion`, `new_premises`, `relocation`,
`manufacturing_change`, `distribution_change`, `acquisition`, `tender`,
`customer_win` (strong) and `investment`, `hiring`, `partnership`,
`technology_automation`, `restructuring` (moderate).

Two design decisions worth stating:

- **No family term names a company, industry or country.** There is a test that
  fails if one does. Nothing about NMS can be hard-coded into being found.
- **The client's own demand triggers do not reorder the plan.** I built it the
  other way first, promoting families whose vocabulary matched Orbital's stated
  triggers — and it pushed `major_contract` and `project` below a small budget,
  which is exactly the blind spot that hid NMS in v4. A client's trigger list
  describes the changes they have already thought of. There is a regression
  test for this.

Order is catalogue order within strength bands, so the plan is deterministic
and replayable. Budget is a cost decision, not a scoring one.

### 3. Durable research state

`company → researched → signals checked → result → evidence → last checked`,
persisted through an injected store (in-memory and JSON-file implementations;
the filesystem is injected so the durable path is testable).

Nine states that must never collapse into one another:

| State | Means |
|---|---|
| `not_researched` | never put to the engine — the absence of a record |
| `signal_found` | a change was found and passed downstream |
| `no_trigger_found` | looked properly, nothing there — **a genuine negative** |
| `no_commercial_consequence` | real current change, nothing in it for this client — **a genuine negative** |
| `insufficient_evidence` | a change was found, the evidence does not carry it |
| `identity_unresolved` | no source could be attributed to this company |
| `identity_collision` | the sources describe a different company |
| `disqualified` | rejected on the client's own disqualifiers, no research spent |
| `research_failure` | **the research could not be performed — never a finding** |

Two rules enforced by tests: a `research_failure` never overwrites a previously
known state (the failure goes into the history, the knowledge is kept), and a
company that has ever been researched stays in the universe until someone
deliberately removes it.

---

## Discovery — before and after

| | BEFORE (v4) | AFTER (v5) |
|---|---|---|
| Companies in universe | 9 | 9 |
| Companies researched | 7 | 7 |
| Prescreened, no research spent | 2 | 2 |
| **Queries executed** | **14** | **66** |
| — first-party sweep | 0 | 24 |
| — change-family | 14 | 42 |
| Change families covered | 0 | 6 of 16 |
| **First-party sources checked** | **0** | **33** |
| Sources seen | 15 | 94 |
| **Commercial changes found** | **5** | **6** |
| Signals reaching scoring | 4 | 4 |
| Identity collisions caught | 1 | 0 |
| Identity unresolved | 0 | 0 |
| Polarity warnings | 0 | 0 |
| Stale rejections | 0 | 1 |
| Contradiction rejections | 0 | 0 |
| Genuine negatives retained | 3 | 2 |
| Research failures | 0 | 0 |

**Queries by change family (this run's budget of 6):** `major_contract` 7,
`project` 7, `new_market` 7, `expansion` 7, `new_premises` 7, `relocation` 7.
The remaining ten families — including `distribution_change`, `acquisition`,
`tender`, `customer_win`, `hiring` and `restructuring` — were generated by the
planner and **not executed**, because 16 families × 9 companies is 144 searches
and this run's budget was 66. That is a cost decision, recorded as coverage
rather than hidden: the report says which families were not asked about.

**First-party sections:** newsroom, press releases and projects swept (6 of 7
companies covered on each); announcements, investors and careers generated and
not executed, for the same budget reason.

**Research cost:** 66 search calls (4.7× the v4 volume), 42 page fetches
attempted and refused, **0 credits, 0 currency**. No paid provider was called.

---

## Discovery recall, measured separately from precision

A genuine opportunity counts as **discovered** when a commercial change was
found and reached the pipeline — *including when the pipeline then rejected
it*. Whether the rejection was right is a downstream question, and conflating
the two is what let v4 report 75% precision while missing the best opportunity
in the corpus.

| | BEFORE | AFTER |
|---|---|---|
| Genuine opportunities (gold A + B) | 5 | 5 |
| **Discovered** | **3 (60%)** | **4 (80%)** |
| Of those, reaching scoring | 3 | 3 |
| Still not discovered | NMS, ADS Laser | ADS Laser |
| False discoveries | 1 | 2 |
| Signals recovered from the previous run | — | **1 (NMS)** |

**False discoveries** — a change found where the gold set says there is no
opportunity — are counted apart from false positives, because the downstream
pipeline may still reject one. Both v5 false discoveries behave as intended:
Bramble becomes a reported false positive (unchanged from v4), and Slack & Parr
is correctly rejected at `no_commercial_consequence`.

---

## The NMS case

**Discovery is fixed. NMS is no longer missed. It is now rejected on freshness,
and that is a different and much more useful failure.**

The sweep reached `nmsinfrastructure.com` and its own site states:

> NMSI is under contract to build 22 state of the art district hospitals for
> Africa with work underway on 12 sites, and with over 1,000,000 sq ft under
> construction…

That claim was extracted, its source classified first-party, its identity
attributes matched against the fingerprint, and a three-level chain built on
it. It reached the freshness stage and was rejected there:

```
REJ NMS International Group [stale] signal found but over 12 months and not structural
```

The mechanism is worth stating precisely, because it is the next thing to fix
and I have deliberately not fixed it. **The programme statement on the company
site carries no date, so no date was asserted for it** — that is the extractor's
date discipline working. The only dated corroboration the sweep found is the
June 2024 FEBE Growth 100 listing. `latestSignalDate` takes the most recent
date across the evidence, so the *undated current claim* is aged by its *older
dated corroboration*, and the signal is judged 27 months old.

That is a real modelling flaw: adding a corroborating source made the signal
look staler. Fixing it means changing the freshness model, which this milestone
was told not to do.

### What the same sweep also found

The `new_premises` family query returned NMSI's own announcement that it

> launched a new industrial warehouse facility adjacent to its headquarters in
> Market Harborough to handle export cargoes for projects in sub-Saharan
> Africa… staffed by NMSI Logistics team members who carry out pre-shipment
> testing and quality control inspections on equipment prior to
> containerisation and shipment.

**This answers the first unknown the gold set listed for NMS** — "whether
project logistics is handled in-house" — and the answer is: consolidation, QC
and containerisation are. That materially weakens the case the gold set graded
`A_strong` / value `high`.

The extraction reports both together and writes the hypothesis against the leg
that is still bought:

> The in-house warehouse covers consolidation and pre-shipment QC, which means
> the leg still being bought is the international movement itself — ocean and
> air freight, oversized and mixed loads, and destination customs for African
> ports with awkward regimes.
>
> *Test: ask who moves the containers once they leave Market Harborough,
> whether that is tendered per project or held on a standing arrangement, and
> whether the freight leg is inside the EPCF financing.*

**I have not changed the gold label.** Changing a label because the engine found
evidence is exactly the circularity the benchmark exists to avoid. The finding
is recorded and flagged for the human re-grade that the gold set already says
it needs. My own read is that NMS is a B, not an A: real, specific, and a
harder sale than it looked.

---

## Precision and the downstream pipeline

Three runs. BEFORE is v4 as reported last milestone; both AFTER runs use the
v5 discovery plan.

| | BEFORE v4 | AFTER v5 (retrieval blocked) | AFTER v5 (reconstructed) |
|---|---|---|---|
| Reported | 4 | 4 | 4 |
| **Precision** | **75%** | **75%** | **75%** |
| False-positive rate | 25% | 25% | 25% |
| Recall (all gold) | 60% | 60% | 60% |
| Ranking tau | +1.00 | +1.00 | +1.00 |
| Evidence agreement | 75% | 50% | **100%** |
| Evidence overstatements | 0 | 0 | **0** |
| Value agreement | 25% | 75% | **0%** |
| Value overstatements | 3 | 1 | **4** |

Reported list, v5 reconstructed:

| Rank | Company | Score | Confidence | Action | Gold |
|---|---|---|---|---|---|
| 1 | Maeving | 79 (raw 89) | High | draft_outreach | B_potential |
| 2 | Baltex | 77 (raw 87) | Medium | draft_outreach | B_potential |
| 3 | deVOL Kitchens | 75 (raw 85) | High | draft_outreach | B_potential |
| 4 | Bramble Group | 68 (raw 78) | Medium | call | **C_weak — false positive** |

**Precision held at 75%, which meets the exit criterion.** It did not improve,
because the one false positive is a reasoning defect (Bramble's new hub reduces
the storage opportunity; the engine says so in its own polarity rationale and
scores it as demand-increasing anyway) and nothing in this milestone addresses
reasoning.

### Evidence calibration improved; value calibration got worse

**Evidence agreement reached 100% with zero overstatements.** The engine has
still never claimed better evidence than the sources support. deVOL's
understatement is gone because the sweep found its journal on both owned
domains, which is the right reason for a confidence to rise.

**Value agreement fell from 25% to 0%.** deVOL joined Maeving and Baltex above
the 75 threshold — reaching `CONFIRMED_OPPORTUNITY`, a high-value band — purely
because it gained a fourth independent source. Its commercial case did not
move an inch.

This is the same defect the last report named, now with more force: **one score
carries two axes, so better discovery inflates apparent commercial value.**
Better discovery makes it worse, not better. That is the strongest argument yet
for two-axis scoring, and it is the next milestone.

### No new identity or polarity regressions

- Identity unresolved: **0**. Identity collisions: **0 presented**. Polarity
  warnings: **0**. Contradiction rejections: **0**. Research failures: **0**.
- Reasoning: **0 generic-logistics hallucinations**, 4/4 chains reach all three
  levels, 0 answer their own third-order question — unchanged.
- The **identity-collision count fell from 1 to 0** and that is not a
  regression in the gate: the Brambles/CHEP page that v4's queries returned is
  simply not in the v5 corpus, so no collision was presented. The gate is
  covered by 12 regression tests and by a test asserting only verified alias
  domains are ever swept.

### The defects that persisted, deliberately

Where a company's evidence was unchanged, its extraction is unchanged — same
claims, same inference, same hypothesis, same caveats. That includes the three
defects the commercial benchmark found. Rewriting them here would have hidden
whether they persist and made the comparison meaningless.

- **Baltex** still asserts a US lane that "does not exist yet" against its own
  fact stating agents in the USA. Still unflagged: the contradiction checker
  compares claims across sources, and this one is inside a single chain.
- **deVOL** is still dated to the King's Award rather than to the market
  openings.
- **Bramble** still scores a demand-reducing event as demand-increasing.
- **Slack & Parr** is still rejected on volume alone, without asking what
  contraction itself creates.

---

## Durable state, demonstrated

| Company | State | Queries | First-party sources |
|---|---|---|---|
| Maeving Ltd | signal_found | 9 | 4 |
| Baltex | signal_found | 9 | 6 |
| deVOL Kitchens | signal_found | 12 | 9 |
| Bramble Group | signal_found | 9 | **0** |
| NMS International Group | insufficient_evidence | 9 | 6 |
| Winbro Group Technologies | no_trigger_found | 9 | 3 |
| Slack & Parr | no_commercial_consequence | 9 | 5 |
| Bleckmann | disqualified | 0 | 0 |
| Aldi UK | disqualified | 0 | 0 |

Seven distinct states across nine companies. NMS has moved out of the
genuine-negative bucket it never belonged in.

**ADS Laser Cutting is back in the universe.** Seeded from its v1 record, it is
reported by `droppedFromUniverse`:

```
ADS Laser Cutting Ltd — last state signal_found on 2026-09-08.
Still in the universe; this run did not re-check it.
```

It was not re-researched — the target list still omits it, and re-adding
targets is a separate decision — but it can no longer disappear silently. That
was the failure; this is the fix.

### A finding the durable state made visible

**Bramble Group has 0 first-party sources.** Its fingerprint records
`bramblefoods.co.uk`; the company's live site is `bramblefoods.com`. The
site-scoped queries ran against the recorded domain, the results came back on
the other one, and the ownership check correctly refused to treat them as
first-party.

That is the alias-verification control doing its job, and it exposes a real
dependency: **the sweep is only as good as the identity fingerprint's domain
list.** An unverified or wrong domain makes a company's own newsroom invisible.
Worth an alias-discovery step later; not this milestone.

---

## Exit criteria

| Criterion | Result |
|---|---|
| NMS's opportunity discoverable and reaching the downstream pipeline | **MET** — extracted from its own site, identity matched, chain built and validated, rejected at the freshness stage rather than never found |
| Precision not below the 75% benchmark | **MET** — 75%, unchanged |
| No new identity or polarity regressions | **MET** — 0 unresolved, 0 collisions presented, 0 polarity warnings, 242 tests pass |

Not claimed: NMS is not *reported*. It reaches the pipeline and freshness stops
it, for the dating reason above. Calling that a pass would be overstating it.

---

## What I would do next, and did not do

In order:

1. **Two-axis scoring.** Separate the evidence score from the commercial-value
   score. This milestone made the case unanswerable: better discovery pushed
   value agreement from 25% to 0% while evidence agreement went to 100%. One
   number cannot carry both.
2. **Date attribution.** Distinguish the date of an announcement from the date
   of the change, and stop an undated current claim being aged by an older
   corroborating one. That is the NMS blocker.
3. **Alias discovery.** A company whose recorded domain is wrong has an
   invisible newsroom. Bramble is the proof.
4. **Intra-chain contradiction checking**, then **contraction consequence
   testing** — both carried over from the last report, both still open.

Also worth doing but lower value: raising the query budget past 6 families and
3 sections, which is a cost decision rather than an engineering one.

---

## What this cannot tell you

- **Precision is 3 companies out of 4.** One reclassification moves it 25
  points. Discovery recall is 4 opportunities out of 5.
- **The gold labels are still not independent** — same agent built the engine
  and wrote the labels. The NMS in-house-logistics finding is the first hard
  evidence that a label is wrong, and it argues the gold set is *too generous*,
  not too harsh.
- **Verification remains fixture-based.** The reconstructed run's page-level
  evidence comes from snippet-derived reconstructions; the honest run has none.
  Three of four rows cleared for outreach is what *would* happen with real
  retrieval.
- **The 66 queries are one run, one client, one week.** The families not asked
  about might have changed every answer.
