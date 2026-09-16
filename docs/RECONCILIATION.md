# Signal — reconciliation of V1 against the product vision

_2026-09-16. No code changed. Written against `claude/signal-project-state-cw43qu` @ `1cc6471`._

The short version: **V1 is the back half of the intended product, built to a
high standard, with the front half missing and its absence disguised by
naming.** The method called `discoverTriggers()` does not discover companies.
It iterates a list the caller supplies.

---

## 1. Current system

### 1.1 Reusable core capabilities

| Capability | File | State |
| --- | --- | --- |
| Identity fingerprint + source attribution gate | `identity.ts` (374) | Complete. Four verdicts. Zero identity errors across every run. |
| Claim schema, fact promotion | `research/extraction.ts` (324) | Complete. A fact without a valid source cannot be constructed. |
| Chain validation, pruning | `claims.ts` (235) | Complete. Structural only — never reads the sentences. |
| Source classification | `research/sources.ts`, `research/registry.ts` (466) | Complete. ~120 domains, tiered, topic-aware. |
| Earned verification | `research/retrieval.ts` (321) | Complete. Page level requires fetch **and** passage match. |
| Demand direction from evidence | `direction.ts` (176) | Complete. Derived from per-claim impacts, never the declared label. |
| Date attribution | `dating.ts` (172), `freshness.ts` (77) | Complete. Four date bases; only two date a change. |
| Two-axis scoring | `two-axis.ts` (387), `scoring.ts` (217) | Complete. Weights tuned against one gold set (see §4). |
| Dedupe against history | `dedupe.ts` (162) | Complete. CSV ledger in and out. |

### 1.2 Current V1 application workflow

`app/` (2,305 lines, 7 files). The journey a user can actually complete:

1. Type a `ClientProfile` into a form — name, domain, offerings, demand
   triggers, buyer functions, disqualifiers. **All six fields are hand-typed.**
2. Type an `IdentityFingerprint` for one company — name, domain, town, region,
   country, industry, descriptors, company number. **All hand-typed.**
3. Paste evidence — URL, headline, publication date, page body.
4. Press assess. Two model calls with the engine between and after them.
5. Read a brief, or a stage-labelled rejection, or a failed-run notice.
6. Repeat for the next company, one at a time.

There is no step in which Signal finds anything.

### 1.3 Testing infrastructure

299 engine tests, 55 app tests, one end-to-end script over five real recorded
model responses, one HTTP-boundary test against a local replay. Five engine
scripts producing reports. A gold set of **11 labelled entries for one client**,
authored by the same agent that built the engine — a limitation stated in the
file's own header.

### 1.4 Research / analysis code

- `research/adapter.ts` (777) — the research loop. Takes `targets`, researches
  each, returns candidates.
- `research/change-families.ts` (275) — **16 hard-coded change families**, with
  the file stating they are "the ones `docs/ORBITAL_COMMERCIAL_BENCHMARK.md`
  recognises". `orderFamilies(_client, …)` ignores its client argument
  entirely, by a documented decision.
- `research/first-party.ts` (273) — sweeps a company's own site. Requires the
  domain to be known already.
- `research/history.ts` (253) — nine `ResearchState` values, a durable store,
  coverage records, `droppedFromUniverse`.
- `analysis/*` (987) — measurement only, used by `scripts/benchmark.ts`.
  `discoveryRecall()` asks: of the gold-set companies with a genuine
  opportunity, for how many did the engine surface a signal at all. **The
  company list is an input to that metric.**

### 1.5 UI

`node:http`, server-rendered HTML, no framework, no JS. Five pages. Every
number opens onto its components. No auth.

### 1.6 Persistence

One JSON file, written atomically. Clients, targets, evidence, assessments.
Assessments accumulate. Separately, `FileHistoryStore` persists per-company
research state and coverage — this is a real monitoring substrate that the app
does not currently use.

### 1.7 Providers / retrieval

- `HttpSearchClient` (151) — provider-agnostic, presets for Brave, Serper,
  Tavily. **Never executed against a live API.** Not used by the app.
- `HttpPageRetriever` — real, production-shaped. **Never executed successfully**
  (403 CONNECT).
- `AgentBridgeSearchClient` (67) — replays captures an agent took.
- `ProvidedEvidenceSearchClient` / `ProvidedPageRetriever` (app) — serve pasted
  evidence. This is what the product actually runs on today.
- `providers/registry.ts` (176) — cost/availability routing types.

### 1.8 Reasoning

`app/src/reasoner.ts` (345). One model call over promoted facts only. Rejects
rather than repairs. New as of this build; before it, the reasoning layer was a
human writing fixtures.

### 1.9 Grounding

`app/src/grounding.ts` (284). Checks generated prose against the evidence for
ungrounded proper nouns, figures, money and dates. New as of this build.

### 1.10 Scoring

Evidence axis (authority 40 / independence 25 / verification 20 / dating 15)
and value axis (icpFit 25 / signalStrength 20 / commercialRelevance 15 /
direction 15 / timing 15 / buyer 10), floor 60, five quadrants, mechanical caps.

### 1.11 What does not exist

No website ingestion. No commercial-model extraction. No opportunity map. No
event→demand derivation. No signal hypothesis generation. No company
discovery. No entity resolution. No batch or scheduled runs. No feedback
capture. No calibration or learning. Zero lines of any of it.

---

## 2. Original product architecture

Twelve stages. Naming them separately matters, because the current system
collapses stages 1–7 into "the user types it in".

```
 ① CLIENT INTAKE           input: one URL
                           out:   raw site corpus (pages, text, provenance)

 ② COMMERCIAL MODEL        what they sell, how they charge, delivery model,
                           geography, capacity constraints, who they cannot serve
                           out:   CommercialModel {offerings[], model, geo, limits}

 ③ ICP / OPPORTUNITY MAP   which companies can buy this, and in what situation
                           out:   IcpDefinition + BuyingSituation[]

 ④ EVENT→DEMAND MODEL      for each buying situation, the business events that
                           create it, with a stated causal link
                           out:   DemandTrigger[] {event, mechanism, strength,
                                  offering(s) affected, exclusions}

 ⑤ SIGNAL HYPOTHESES       for each trigger, the observable public traces it
                           leaves, and where they appear
                           out:   SignalHypothesis[] {query shapes, source
                                  classes, expected phrasing, disconfirmers}

 ⑥ SIGNAL DISCOVERY        execute hypotheses against the open web / feeds.
                           NOT company-named queries.
                           out:   raw hits

 ⑦ CANDIDATE COMPANIES     extract "which company is this about" from each hit
                           out:   CandidateMention[] {name, domain?, locus}

 ⑧ ENTITY RESOLUTION       CandidateMention → IdentityFingerprint, or refuse
                           out:   IdentityFingerprint | unresolved

 ⑨ EVIDENCE VERIFICATION   ┐
 ⑩ COMMERCIAL REASONING    ├─ EXISTS TODAY, essentially unchanged
 ⑪ OPPORTUNITY SCORING     ┘

 ⑫ OUTPUT + FEEDBACK       ranked opportunities → salesperson verdict →
                           outcome → calibration
```

Stages ⑨–⑪ are V1. Stages ①–⑧ and ⑫ do not exist.

The architectural consequence worth naming: **stages ①–⑤ are a compiler.** They
take one URL and emit a client-specific search program. Stage ⑥ runs it. The
current system has a *hand-written, single-client* version of that program's
output — the 16 change families — with no compiler behind it.

---

## 3. Drift analysis

| Component | In the vision? | Exists? | Reusable? | Incomplete? | Promoted to product? | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Client intake from website | ① yes | **No** | — | — | — | Build |
| Commercial model | ② yes | **No** (hand-typed `ClientProfile`) | The *type* is reusable | — | — | Build behind the existing type |
| ICP / opportunity map | ③ yes | **No** (`disqualifiers: string[]` is a stub) | — | — | — | Build |
| Event→demand model | ④ yes | **Partly** — 16 fixed families | Yes, as a seed | Yes: not client-derived | — | Needs a layer that generates it |
| Signal hypotheses | ⑤ yes | **Partly** — `familyQuery()` templates one per family, per *named company* | Shape reusable | Yes: cannot express a company-free query | — | Build |
| Signal discovery | ⑥ yes | **No** | `HttpSearchClient` is ready but unproven | — | — | Build + credential |
| Candidate companies | ⑦ yes | **No** | — | — | — | Build |
| Entity resolution | ⑧ yes | **No** | `compareNames`, `attributeSource` are the inverse operation | — | — | Build |
| Evidence verification | ⑨ yes | **Yes** | Yes | No | No | Keep as-is |
| Commercial reasoning | ⑩ yes | **Yes** | Yes | No | No | Keep as-is |
| Scoring | ⑪ yes | **Yes** | Yes | Value axis uncalibrated | No | Keep shape, distrust numbers |
| Feedback / learning | ⑫ yes | **No** | — | — | — | Defer (Phase 2) |
| Manual evidence paste | **No** | **Yes** | As a harness | — | **Yes — this is the drift** | Demote to diagnostic mode |
| Manual company entry | **No** | **Yes** | As a harness | — | **Yes** | Demote |
| Manual client profile | **No** | **Yes** | As an override | — | **Yes** | Demote to editable output of ② |

### Where the drift actually happened, and why it was invisible

**1. A naming collision hid the missing half.** `discoverTriggers()` is the
`ResearchAdapter` interface's discovery method. It does this:

```ts
for (const target of this.#options.targets) {
  this.outcomes.push(await this.researchCompany(target, client));
}
```

"Discovery" in this codebase has always meant *finding the change within a
company you already named*. The vision's discovery means *finding the company*.
Both are real problems; only one is solved; the same word covers both. Every
report written to date — including mine — used "discovery recall" without
flagging that the denominator was a fixed list of 11 companies somebody typed.

**2. `IdentityFingerprint` is never constructed.** Every occurrence across the
codebase is a *parameter*: `target: IdentityFingerprint`. There is no function
anywhere that takes a company name observed in the wild and produces one. The
identity **gate** (does this source describe the company I named?) is excellent.
The identity **resolution** (which company is this source about, and is it a
real company I can research?) is the inverse operation and does not exist.

**3. The environment selected the architecture.** Outbound `CONNECT` returns
403. Given that, the only buildable V1 was one where the user supplies the
evidence. That was a defensible engineering response to a blocked sandbox, and
I recorded it as such — but it silently became the product definition. The V1
report's section 7 said "step 3 is *paste* rather than *retrieve* because
retrieval is blocked". That sentence is correct about retrieval and wrong about
the product: the vision does not have a paste step at all.

**4. One client's benchmark became the event model.** The 16 change families
are logistics-shaped because they were derived from Orbital Direct's benchmark.
`orderFamilies` explicitly ignores the client, for a good reason that is worth
preserving — the client's own trigger list describes changes they have already
thought of, and promoting them buried `major_contract`, which is the family that
surfaces the NMS programme. But that decision was tuned on **n=1 client**. For a
second client the same 16 families are an untested assumption, not a finding.

### What did *not* drift

The epistemic spine, the identity gate, verification, dating, direction and the
distinct negatives are all exactly what the vision's stages ⑨–⑪ require. Nothing
in them assumes a hand-typed input. They take a fingerprint and evidence, from
wherever those came.

---

## 4. What survives

Ruling on each item you listed, plus what you did not list.

| Item | Verdict | Condition |
| --- | --- | --- |
| Identity fingerprinting | **Survives whole** | Becomes the *output* of stage ⑧ rather than a form field. |
| Identity gate | **Survives whole** | More load-bearing, not less: discovered candidates are far more collision-prone than typed ones. |
| Source classification | **Survives whole** | Registry will need widening beyond UK trade press. |
| Earned verification | **Survives whole** | Becomes genuinely testable once retrieval is unblocked. Today it is close to circular. |
| Claim → fact promotion | **Survives whole** | — |
| Evidence provenance | **Survives whole** | — |
| Freshness / date handling | **Survives whole** | More important: discovery returns a lot of old news. |
| Contradiction detection | **Survives** | Currently the model's declaration plus polarity/direction checks. Adequate. |
| Grounding | **Survives whole** | — |
| Reasoning | **Survives whole** | Prompt needs the *derived* commercial model rather than a typed profile. |
| Commercial consequence | **Survives whole** | — |
| Hypothesis generation (fact→hypothesis) | **Survives whole** | Note: this is a *different* thing from stage ⑤ signal hypotheses. Same word, different job — do not conflate them the way "discovery" was conflated. |
| Two-axis scoring | **Shape survives; numbers do not** | The value axis was tuned against a gold set the engine's own author wrote. Recalibrate against real salespeople before trusting a threshold. |
| Coverage reporting | **Survives and grows** | Today it reports coverage over a universe you chose. It must learn to report coverage over a universe you did not — which is a harder and more honest number. |
| Negative / rejected outcomes | **Survives whole** | The nine states are exactly right for a discovery pipeline. |
| Manual evidence mode | **Survives as a harness** | Demote from product to diagnostic: it is how you A/B the reasoning layer with discovery held constant. Keep it; stop calling it the product. |
| **`HttpSearchClient`** (you did not list it) | **Survives; becomes critical** | Provider-agnostic, presets ready, never run. It is stage ⑥'s transport. |
| **`FileHistoryStore` + nine states + `dedupe`** (you did not list it) | **Survives; becomes the monitoring substrate** | This is most of Phase 3 already built. |
| **`analysis/*` benchmark harness** | **Survives, needs a new metric** | It cannot currently express company-discovery recall, because it has no concept of a universe it did not receive. |
| Change families | **Survives as a seed, not as the model** | Keep the 16 as a control arm. A generated map that cannot beat them is a negative result worth having. |
| `ClientProfile` as a hand-typed form | **Does not survive as the entry point** | Survives as an editable override of stage ②'s output. |
| `ProvidedEvidenceSearchClient` | **Survives as a test double only** | — |

Nothing in the list is thrown away. One thing changes rank: the manual paste
flow stops being the product and becomes an instrument.

---

## 5. What is missing

Minimum capabilities, with a build/defer verdict. Not all are needed now.

**A. Website / business understanding** — *Build (small).* Fetch 10–30 pages
from one domain (home, about, services, sectors, case studies, careers), keep
provenance. Most of this is `HttpPageRetriever` plus a crawl frontier. Needs
egress.

**B. Commercial model extraction** — *Build (small).* One model call, structured
output: offerings, delivery model, pricing shape, geography, capacity limits,
who they explicitly cannot serve. Failure mode to guard: inventing offerings the
site does not claim — which is exactly what `grounding.ts` already checks, and
it should be pointed at this output too.

**C. Opportunity-map construction** — *Build (small).* ICP definition plus
buying situations. This is reasoning over B, one call.

**D. Event→demand derivation** — *Build (medium).* The map from business events
to demand, with a stated mechanism per link. This is the piece with genuine
intellectual content, and the one where a generic model will produce plausible
nonsense most readily. It needs its own grading, against the 16 hand-built
families as the control.

**E. Signal hypothesis generation** — *Build (medium).* Turn each trigger into
executable queries that name **no company**. The current `familyQuery(target,
family)` cannot express this — it interpolates a target name. Genuinely new code.

**F. External signal discovery** — *Build (small code, hard operationally).*
`HttpSearchClient` with a credential. The engineering is done; the unknowns are
cost, rate limits, and whether open web search can answer condition-shaped
queries at all.

**G. Candidate-company discovery** — *Build (medium).* Extract "which company is
this about" from a hit, distinguishing the subject from mentioned parties. The
hardest new reasoning task.

**H. Continuous / batch monitoring** — *Defer to Phase 3.* `FileHistoryStore`
and dedupe already hold the state. A cron loop is not the risk.

**I. Entity resolution** — *Build (medium), and do not skip it.* Name → domain →
fingerprint, with an explicit "cannot resolve" verdict. Without it, the identity
gate has nothing to gate against, and the whole downstream apparatus is inert on
discovered candidates. **This is the single most under-appreciated gap in the
list**, because the existing identity code looks like it covers it and does not.

**J. Evidence collection** — *Build (small).* Retrieve the pages behind
discovered hits. Exists (`HttpPageRetriever`), blocked by egress.

**K. Opportunity qualification** — *Exists.* Stages ⑨–⑪ unchanged.

**L. Feedback and outcome learning** — *Defer to Phase 2.* Capture the verdict
from day one (a thumbs up/down and a reason costs nothing and the data is
irreplaceable). Do not build calibration until there is data to calibrate on.

---

## 6. The critical product question

Your proposed assumption:

> "Given only a company's website/business information, can Signal identify
> commercially meaningful external events that create credible prospect
> opportunities for that particular business?"

**I think this is close, and I want to challenge it on one point: it bundles two
independent assumptions with very different risk, and the riskier one is
hidden.**

- **(a) Can Signal build a good commercial and opportunity model from a
  website?** Probably yes. This is summarisation and inference over text a
  company wrote about itself, which current models do well. Low risk, cheap to
  test, and failure would be obvious immediately.
- **(b) Can Signal, from that model alone, surface *companies the salesperson
  did not already know*, experiencing a *verifiable, current* change, that the
  salesperson agrees is *worth a call*?** Unknown, untested, and everything else
  in the vision is downstream of it.

The asymmetry matters because (a) failing is a prompt problem and (b) failing is
a *product* problem. Web search is good at "news about company X" and largely
untested at "companies currently experiencing condition Y". If (b) fails, Signal
collapses back to "give me a list of companies and I'll research them" — which
is roughly what V1 does, and a much smaller product than the one you want.

So I would sharpen the assumption to:

> **From a commercial model derived from one website alone, can Signal name
> companies the salesperson did not already know, that are experiencing a
> verifiable and current change, which that salesperson agrees is worth a call?**

Four conditions, each of which independently kills the product: *previously
unknown*, *verifiable*, *current*, *worth a call*. Drop "previously unknown" and
you have a research tool, not a prospecting one — and that is the condition the
existing benchmark has never tested, because the company list was always given.

One further candidate I considered and rejected as *the* critical question:
"is the output better than the salesperson's own prospecting in the same time?"
That is the right *commercial* question and it is already the failure condition
in the V1 report — but it cannot be asked until (b) produces anything at all.
Sequence it second.

---

## 7. The smallest real experiment

**Name:** Discovery Probe — one client, one week of public information, no code.

**Client:** Orbital Direct. Chosen because a gold set, a benchmark and one round
of human grading already exist for it, so results are comparable to something.

**What runs:** a controlled batch, executed largely by hand with model
assistance. No SaaS, no auth, no CRM, no monitoring, no UI, one search source.

### Procedure

| # | Step | Output | Mechanism |
| --- | --- | --- | --- |
| 1 | Ingest `orbital-direct.com` | page corpus | manual fetch |
| 2 | Derive the commercial model | offerings, geography, limits, exclusions | one model call |
| 3 | Derive the opportunity map | ICP + buying situations | one model call |
| 4 | Derive demand triggers | event → mechanism → offering | one model call |
| 5 | Generate signal hypotheses | 20 queries naming **no company** | one model call |
| 6 | Execute the queries | ~200 raw hits | manual search |
| 7 | Extract candidate companies | name + likely domain per hit | one model call |
| 8 | Resolve and verify | fingerprint or "unresolved" | manual + existing identity code |
| 9 | Assess each resolved candidate | briefs | **existing V1, unchanged** |
| 10 | Rank | ranked opportunity list | existing two-axis |

Steps 9–10 are free. That is the point of the reconciliation: this experiment
tests the missing half and reuses the built half as the instrument.

### Control arms

- **Control A — the hand-built families.** Run the same 20-query budget using
  the existing 16 change families instead of the generated map (step 4–5
  replaced). If the generated map does not beat a catalogue written for one
  client, stages ②–④ are not earning their place.
- **Control B — the salesperson.** The Orbital salesperson spends the same
  wall-clock time prospecting their own way, listing companies worth a call.
  Lists compared blind.

### Success criteria

| Metric | Measure | Pass bar |
| --- | --- | --- |
| **Novelty** | share of surfaced companies the salesperson did not already know | **≥ 40%** |
| **Relevance** | salesperson-graded: is this company plausibly a buyer? | **≥ 60%** of surfaced |
| **Commercial plausibility** | does the stated event→demand mechanism hold? | **≥ 50%** |
| **Evidence quality** | share reaching `page_retrieved` with a passage match | **≥ 70%** |
| **Freshness** | share whose change is dated within 90 days | **≥ 60%** |
| **Actionability** | "would you make this call this week?" | **≥ 5 yes** out of ~20 briefs |
| **False positives** | surfaced and graded not-a-prospect | **≤ 25%** |
| **Time saved** | Signal minutes-per-actionable vs Control B | **< 50%** of manual |
| **Discovery yield** | actionable opportunities per 20 queries | **≥ 3** |

Grading is blind: briefs stripped of scores, Signal-sourced and
salesperson-sourced companies interleaved.

### Stopping rules, stated in advance

- **Novelty < 20%** → Signal is re-finding what the salesperson already knows.
  The product is research assistance, not prospecting. Rethink the pitch.
- **Zero actionable from 20 queries** → open web search cannot answer
  condition-shaped queries for this client. Either change the source class
  (filings, planning applications, tenders, job postings) or stop.
- **Generated map loses to Control A** → stages ②–④ are ornamental; ship the
  catalogue and drop the compiler.

Every one of those is a result worth having.

### What this experiment needs that we do not have

- **A search API credential** (Brave or Serper — `HttpSearchClient` has presets
  for both).
- **Network egress**, or a human executing the queries and pasting the results.
  This sandbox returns 403 on every outbound `CONNECT`.
- **One Orbital salesperson**, roughly half a day.

---

## 8. Solo-builder scope

### Phase 0 — validation *(now)*
The Discovery Probe. Hand-run, model-assisted, no new production code. Output is
a findings document and a go/no-go.

### Phase 1 — narrow working prototype *(only if Phase 0 passes)*
Website → commercial model → opportunity map → demand triggers → queries →
candidates → entity resolution → **existing engine**. One client, one search
provider, run from the command line as a batch. Results into the existing
store. Manual paste kept as the diagnostic path.

### Phase 2 — repeatable product
A second and third client, which is what tests whether stages ②–④ generalise or
were fitted to logistics. Feedback capture on every brief. The existing UI grows
a run view. Value-axis recalibration against real verdicts.

### Phase 3 — monitoring
Scheduled runs over a persistent universe. `FileHistoryStore`, the nine states
and dedupe already carry most of this.

### Phase 4 — integrations and scale
CRM, multi-user, auth, a real database, multiple source classes, alerting.

### Do NOT build yet — explicitly

Authentication. A database. Multi-tenancy. A CRM integration. Scheduled jobs.
A queue. A richer UI. Outreach drafting or sending. Contact enrichment. Apollo.
Multiple search providers. A learning/calibration loop. Embeddings or a vector
store. An agent framework. Dify, OpenHands or any orchestration platform.
Deployment infrastructure of any kind.

Every one of those is downstream of a question Phase 0 has not answered.

---

## 9. Recommended next step

**One step. Run step 1–6 of the Discovery Probe by hand for Orbital Direct, and
count how many previously-unknown, verifiable, current candidate companies come
out of twenty company-free queries.**

Write no code. Derive the commercial model, the opportunity map, the demand
triggers and the twenty queries with model assistance; execute the searches;
list the companies. Stop there — do not run them through the engine yet.

**Why this one.** It is the cheapest possible test of assumption (b) from §6,
which is the assumption everything else in the vision depends on and the one
Signal has never attempted. It needs no new code, because the only thing being
tested is whether the front half can produce a list at all. If twenty queries
yield nothing but companies the salesperson already knows, no amount of
downstream verification quality rescues the product — and we would have learned
that for the cost of an afternoon rather than a phase.

**The blocker to name:** this sandbox cannot execute the searches (403 on every
outbound `CONNECT`). Either the searches are run outside it and the results
brought back, or a search API credential and egress are provided. That choice is
yours, and it is the only decision needed to start.
