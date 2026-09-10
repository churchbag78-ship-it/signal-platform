# Signal — critical review

_2026-09-10 · written against commit `fc2524b`, after eight milestones_

## The one-sentence version

**We have built a careful referee for a game nobody has played.** The judgement
layer is real, tested and better than I expected. Every interface with the
world — search, retrieval, extraction, and the salesperson — is unvalidated,
and the benchmark that says the engine works was written by the same agent that
wrote the engine, from data that agent curated by hand.

**I am withdrawing my own last recommendation.** Retiring the no-date cap would
move one metric on a ten-row synthetic benchmark. It is not worth doing, and
proposing it was the sunk-cost reflex this review is meant to catch.

---

## The numbers, first

| | |
|---|---|
| Engine source | 7,799 lines |
| Tests | 4,996 lines · 305 tests |
| Fixtures | 4,761 lines |
| Scripts | 1,270 lines |
| Measurement instrumentation | 987 lines |
| Run reports | 4,826 lines |
| **Clients profiled** | **1** |
| **Companies ever researched** | **9** |
| **Gold-set entries** | **10** |
| **Live HTTP requests made by the engine** | **0** |
| **Live LLM extractions** | **0** |
| **Salespeople who have seen the output** | **0** |
| **Sales conversations resulting** | **0** |

`HttpSearchClient` and `HttpPageRetriever` exist and are tested against injected
stubs. Neither has ever made a request. `LlmClaimExtractor` has never called an
API. Every pilot ran on `CorpusClaimExtractor`, reading fixtures I wrote.

---

## 1. What is genuinely working

The **deterministic judgement layer**, given well-formed input. This is real and
it is the part that would be expensive to retrofit:

- **Identity resolution.** Source-level attribution against a fingerprint, with
  four distinct verdicts. It has caught a real collision (Brambles Ltd of
  Australia offered as evidence about Bramble Foods of Market Harborough) and
  produced zero identity errors across every benchmark run.
- **The epistemic spine.** Fact → Inference → Hypothesis, where a Fact without a
  valid source cannot be constructed and a Hypothesis without a grounded Fact
  cannot exist. Chain validation, cycle detection, pruning when a source is
  rejected.
- **Verification levels.** `page_retrieved` requires the page fetched *and* the
  passage found in it. Snippet-level evidence cannot masquerade as verified.
- **Negative outcomes stay distinct.** Nine research states that cannot collapse
  into one another, and a research failure never overwrites a known result.
- **Two-axis scoring.** Evidence and commercial value genuinely independent
  (correlation +0.22, where one number made it 1 by construction).
- **Direction and dating grounded in claims** rather than in labels.
- **Zero generic-logistics hallucinations** across every run, adversarially
  tested.

That list is not nothing. Most tools in this space would happily tell you
Brambles Ltd of Australia had just opened a distribution centre in
Leicestershire.

## 2. What is architecture rather than validated functionality

Almost everything that touches reality.

| Component | Status |
|---|---|
| `HttpSearchClient` | never made a request |
| `HttpPageRetriever` | never made a request |
| `LlmClaimExtractor` | never called a model |
| `extraction-fidelity.ts` (330 lines) | measures an extractor that has never run |
| `providers/registry.ts` + `contacts.ts` (345 lines) | cost routing for a deferred feature |
| `history.ts` persistence | one run, seeded by hand |
| `dedupe.ts` | never had a second run to de-duplicate against |
| Source registry (89 domains) | hand-maintained; a live run would touch hundreds |
| Target selection | **does not exist** |

That last row deserves its own paragraph. **The pipeline takes
`targets: IdentityFingerprint[]` as an input.** Nine of them, hand-written by
me, each with canonical domain, alias domains, geography, industry, descriptors
and company number. Signal cannot currently answer *"which companies should I
look at?"* — the question a salesperson actually starts from. And the identity
gate, our best component, is load-bearing on fingerprints somebody has to
author. Nobody has costed that.

## 3. The smallest useful end-to-end workflow

```
one client profile
  → a target list (however it arrives)
    → real search
      → real extraction by a model at runtime
        → the existing deterministic pipeline
          → a written brief per opportunity
            → a salesperson marks it useful / not, and says why
```

Everything between the arrows exists. The two ends do not:

- **Real search and real extraction** need an API key and outbound network. The
  code is written and the interfaces are already injected — this is a
  configuration problem, not an engineering one.
- **The salesperson's verdict** needs a salesperson. There is no substitute and
  no amount of code produces one.

The target list can be a spreadsheet to begin with. That is not the bottleneck
today; it becomes the bottleneck the moment the loop works.

## 4. What evidence we have that the proposition is useful

Honestly: **almost none, and the benchmark does not count.**

Here is the circularity, stated plainly rather than as a footnote:

| Input | Author |
|---|---|
| Gold labels | me |
| Search snippets | me, transcribed by hand from a search tool |
| Claim extractions | me |
| Demand impacts | me |
| Date bases | me |
| Trigger claim ids | me |

So the benchmark measures whether deterministic code, run over data I curated,
reaches conclusions I also wrote down. It mostly does. That is a statement about
internal consistency, not about usefulness.

**The Bramble finding is the clearest example.** I did not build a mechanism
that discovered Bramble's demand-reducing change. I found it by reading, wrote
it into the benchmark, then built a rule and authored the per-claim impacts that
make the rule fire. The rule is sound and generally stated. It has still never
been tested against an extraction it did not already agree with.

The nearest thing to real evidence:

- **Four companies with specific, current, well-sourced changes and a
  non-obvious commercial angle.** Maeving's Class 9 documentation burden against
  a fivefold volume increase is a real reason to call, and a salesperson would
  not have found it by searching "Leicestershire manufacturers".
- **Two disciplined negatives.** Winbro was researched across nine queries and
  is genuinely quiet. That is a real result and most lead tools do not produce
  it.
- **One disagreement with my own gold set that the engine reached by three
  independent mechanisms** — NMS's in-house logistics. That is the closest thing
  to the system telling me something I did not tell it.

Against that: **the call sheet from the most recent run is one company.**

## 5. Where we are over-engineering

Ranked by lines built ahead of demand:

1. **Measurement instrumentation (987 lines)** — `evaluation.ts`,
   `discovery.ts`, `reasoning.ts` — is now larger than the scoring it measures
   (952 lines across scoring, two-axis, direction, dating), for a ten-row
   benchmark. Kendall tau over three comparable pairs is not a statistic.
2. **Provider cost routing (345 lines)** for contact enrichment we deliberately
   are not building, priced in Apollo credits we are not spending.
3. **Extraction fidelity (330 lines)** measuring an extractor that has never
   run. The instrument was validated adversarially; the thing it measures does
   not exist yet.
4. **Four pilot scripts kept for replay (1,270 lines).** Reproducibility is
   good; four historical entry points for a system with one live path is
   hoarding.
5. **The hand-curated source registry.** 89 domains, each with provenance.
   Correct in principle, and it will not survive contact with a live corpus that
   touches hundreds of unfamiliar domains per run.

None of this is wrong. All of it was built before the thing it supports was
needed.

## 6. Untested assumptions

**About users**
- That a freight salesperson wants evidence and provenance, rather than a name,
  a number and a one-line reason. Nobody has asked one.
- That "why now" is what wins the call, rather than relationship or price.
- That an SME forwarder will pay for four leads a week — or that four is enough.
- That the buyer is the salesperson at all, rather than the owner.

**About data and sources**
- That an ICP can be specified precisely enough to be useful. Orbital's profile
  was written by me from a website, not by Orbital.
- That target lists exist and are cheap. Signal has never selected a target.
- That identity fingerprints can be produced at scale. Nine were hand-written.
- That search returns comparable quality without me choosing which results to
  transcribe.

**About verification**
- That page retrieval works at all against real sites: paywalls, JavaScript
  rendering, bot blocking, redirects, robots.txt. Zero attempts.
- That the 75% passage-overlap threshold is right. Chosen by judgement, never
  calibrated, and it sits directly on the path that lifts the score cap.
- That a user tolerates "unverified" and "undated" rather than finding them
  annoying.

**About opportunity detection and value**
- That the change families are the right families. They came from one afternoon
  of reasoning about one client.
- That six queries per company is the right depth — ten of sixteen families were
  never asked in the last run.
- That every reported opportunity is a **displacement sale against an
  incumbent**, which is the hardest kind. We have never tested whether those
  convert.

## 7. Biggest technical risks

1. **Live extraction quality is completely unknown and everything depends on
   it.** The engine's discipline assumes the extractor reports what a source
   says. If a real model at runtime is 80% faithful rather than 100%, the
   identity gate and the epistemic spine become the last line of defence rather
   than a refinement — and we have no idea which it is.
2. **Retrieval may simply not work.** Modern sites block scrapers. If
   `page_retrieved` is unreachable in practice, everything is snippet-level, the
   70-point cap applies to everything, and the call sheet is empty forever. That
   is exactly what the honest run already shows.
3. **Cost at scale.** 66 searches for 7 companies. Five hundred companies a week
   is roughly 4,700 searches plus retrievals plus LLM calls, recurring. Nobody
   has priced it against what an SME forwarder would pay.
4. **Identity fingerprints do not scale.** The best component has a manual
   dependency nobody has costed. Companies House can supply some of it; alias
   domains and descriptors are judgement.
5. **The source registry is a maintenance liability** that grows with every new
   client and every new domain.

## 8. Biggest commercial and product risks

1. **Volume.** One call-sheet entry from nine companies in one week. If that
   ratio holds, a client needs a target list in the hundreds before the output
   is worth a subscription — which multiplies every cost in §7.
2. **Nobody has said they want this.** Orbital is a worked example, not a
   customer. There is no pricing conversation, no letter of intent, no
   commitment to look at the output.
3. **Rigour may not be the thing people buy.** Our differentiator is refusing to
   assert what we cannot support. The competing pitch is "here are 200 leads",
   and it is cheaper to produce and easier to sell.
4. **Signal decay.** "Why now" is worth something for weeks. That forces
   continuous operation, which forces recurring cost, which raises the price
   floor.
5. **Single-client fragility.** Everything — the ICP, the change families, the
   offerings, the disqualifiers — is shaped around one freight forwarder in
   Leicestershire. We do not know what generalises.

## 9. What could make parts of this unnecessary

Said plainly, because it is the strongest argument against continuing:

- **Clay.** Enrich a list, run LLM prompts over each row, score, export. That is
  structurally Signal, sold today, with an integration catalogue we will never
  match. A competent operator could approximate our output in an afternoon.
- **Exa / Tavily / Perplexity search APIs.** Recency-filtered, semantically
  ranked company news. Our change-family query generation may be reinventing
  what their ranking already does.
- **Owler, Crunchbase alerts, LinkedIn Sales Navigator, Google Alerts,
  Companies House feeds.** All emit "company X had event Y" already. The
  monitoring half of Signal is a commodity.
- **A single well-prompted structured-output call.** Much of `extraction.ts`,
  `llm-extractor.ts` and `extraction-fidelity.ts` is scaffolding around a
  problem that modern structured output largely solves.

**What none of them do** is refuse to attribute a source to the wrong company,
distinguish "we looked and found nothing" from "we could not look", or decline
to assert a commercial consequence the evidence does not carry. That is a real
gap in the market. It is also a *feature*, and we have no evidence anyone will
pay for it.

## 10. The highest-value next piece of coding

**None, this week.** The highest-value next action is not code.

The binding constraint is that we have no evidence from outside the system.
Everything we could build next makes the engine better at a task whose value is
unmeasured. Two things unblock that, in order:

**First — get the existing output graded by a human.** Take the five rows from
the last run, write them as briefs a salesperson would actually read, and have
someone at Orbital (or you, in their shoes) mark each: *would you make this
call, and why not?* No code, a couple of hours, and it is the first
non-circular evidence this project would have. It also settles the NMS
disagreement, which currently distorts every metric on the board.

**Second — one live run with nothing hand-authored.** A real search API key and
a real model key, and one execution where I am not in the loop transcribing
snippets or writing extractions. That is the experiment that tells us whether
any of the last eight milestones matter. The code exists; it needs credentials
and outbound network.

If you want coding done regardless, the only justified item is **consolidation,
not capability**: collapse the four pilot scripts into one live-run entry point
that uses the real adapters, degrades honestly to `research_failure` when keys
are absent, and emits a gradeable brief plus a feedback file. That reduces the
codebase and makes both experiments above one command away. It is worth roughly
200 lines and deletes more than it adds.

**What I would not do:** retire the no-date cap, add alias discovery, add
intra-chain contradiction checking, or ground more of the value axis. All four
are real defects. All four are refinements to a system whose usefulness is
unmeasured, and every one of them would be measured against the same ten rows I
wrote myself.

---

## Verdict

The architecture is sound and unusually disciplined for its stage. It is also
roughly two milestones ahead of its evidence, and the gap is widening — each
milestone adds capability measured against a benchmark that cannot validate it.

**Stop adding engine capability. Validate.** One human grading five briefs, and
one live run without me in the loop. If the briefs come back "I would not call
any of these", no amount of scoring model saves the product — and finding that
out costs a fraction of what the next milestone would.
