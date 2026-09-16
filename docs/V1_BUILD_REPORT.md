# Signal V1 — build report

_Written 2026-09-16, against `claude/signal-project-state-cw43qu`. Baseline: `6318296`._

---

## 1. What Signal was before

A measurement instrument with no product around it, and a hole in the middle
of it.

`engine/` held 7,619 lines of dependency-free TypeScript implementing a
genuinely careful epistemic pipeline: identity fingerprinting with source-level
attribution, claim schemas that make a Fact without a source impossible to
construct, source classification, earned verification levels, evidence-grounded
demand direction, date attribution, freshness, two-axis scoring and nine
distinct research states. 299 tests passed. Five scripts produced reports.

Nobody could use it. There was no interface, no persistence, no way to put a
company in and get an assessment out. Every run to date went through a fixture
file and a script.

And one component had never existed. `LlmClaimExtractor.extract()` throws by
design, with an honest comment saying why: claim extraction alone cannot
produce the inference and hypothesis layers, because those are reasoning rather
than reading. Nothing else supplied that layer. So in every run so far, the
inference chain, the hypothesis, the "why now" and the sales angle were written
**by hand, by the person building the system, into fixtures**. That is the real
reason Signal could not be given to anyone else — not the missing UI.

The README described a different project: a planned Next.js/Supabase/Vercel
stack, and the sentence "nothing here is an application yet, deliberately".

## 2. What I discovered

**The reasoning layer was missing, not incomplete.** See above. This reframed
the whole build: the gap was not product polish, it was that half the product
loop was a human.

**One piece of genuinely dead code.** `engine/src/providers/contacts.ts`, 169
lines, imported only by its own test and by a Pilot A report footer that
printed "no provider configured, nothing enriched". It was written to prove
contact data could never gate an opportunity; that property is now structural
(scoring gives person-level data no weight), so the demonstration had outlived
its purpose.

**`providers/registry.ts` is NOT dead**, despite looking adjacent. It supplies
`ProviderOperation` to retrieval, search and extraction. Kept.

**`analysis/*` (987 lines) is measurement, not product.** Used only by
`scripts/benchmark.ts`. It is not dead — it is how claims about the engine get
checked — but it is not part of the product path and should never be confused
for it. Kept, unchanged, unconnected.

**No database, no migrations, no auth, no deployment config, no API existed.**
The audit found nothing to clean up in those areas because nothing was there.
The README's promises of them were the only trace.

**A real defect, previously recorded and deliberately left unfixed.** The deVOL
brief asserted "Thailand, China and Denmark" in five places — in no source. The
chain validator could not catch it: it checks structure, never sentences.

**Zero runtime dependencies, and no reason to add one.** Node 22 strips types
natively, `node:test` runs the suite, `node:http` serves pages. Dify, OpenHands,
Supabase and Vercel were evaluated against concrete needs and none produced one.
A Dify workflow would own the orchestration this product needs to own itself —
the identity gate sits *between* two model calls and decides what the second one
may see, which is the opposite of a prompt-chaining tool's shape.

## 3. Decision: BUILD

Not because code exists. Explicitly against that reasoning: I removed working
code in the same pass.

BUILD because the binding constraint on testing the core hypothesis is that
**no real person can run the loop**, and the two things stopping them —
a missing reasoning layer and a missing surface — are small, well-specified,
and buildable without touching the engine's controls.

STRIP BACK was considered and partially taken (the cleanup below). EXPERIMENT
FIRST was rejected because the last experiment's finding was precisely that the
next experiment needs real users, and real users need a product. STOP was
considered seriously and rejected on one ground: the controls are the
differentiator, they work, and they have never been in front of anyone.

## 4. What I removed

| Removed | Lines | Why |
| --- | --- | --- |
| `engine/src/providers/contacts.ts` | 169 | Dead in the product path. The property it demonstrated is now structural. |
| Contact-enrichment tests in `engine/test/providers.test.ts` | ~127 | Tested the above. Registry tests kept. |
| Contact-enrichment block in `engine/scripts/pilot-a.ts` | ~24 | Printed that nothing had been enriched. |
| `ContactResult`, `ContactStatus`, `Candidate.contact` in `domain.ts` | 11 | Types for the above. |
| The README's "Planned stack" and Phase 0 framing | — | Advertised dependencies that never arrived and a project state that is no longer true. |

`docs/SIGNAL_PROJECT_STATE.md` was kept and marked historical rather than
deleted — the reasoning that led to methodology-before-code is worth re-reading.

Nothing else was removed. Several things were considered and kept with a
stated reason, which matters as much: `analysis/*`, `providers/registry.ts`,
the five scripts, and every fixture.

## 5. What I changed

Seven new files, 2,305 lines, in `app/`. The engine's controls were not
touched.

**`reasoner.ts`** — the missing layer. Reads ONLY Facts that survived the
identity gate; returns inferences, hypothesis, polarity, commercial
consequence, owning function and sales angle. `coerceReasoning` rejects rather
than repairs: an inference deriving from a fact that does not exist is not
patched up, because the identity gate removed that source and a conclusion
resting on it must not survive. A hypothesis with no test is refused.

**`grounding.ts`** — the fix for the deVOL defect, as a general rule. Pulls the
checkable specifics out of the generated prose — proper nouns, figures, money,
dates — and asks whether each appears anywhere in the evidence. What does not
becomes a contradiction, which caps the score at 60 and routes to manual
review. Deliberately not `fatal`: a discarded signal is invisible, and the
point is that the ungrounded detail should be *seen*.

**`providers.ts`** — three adapters that let `WebResearchAdapter` run unchanged
over evidence a user pastes. The page retriever serves the pasted body so
passage verification does real work. The search client returns the corpus once
and refuses `site:` queries, so the coverage record cannot claim a sweep that
never happened. `ReasoningExtractor` composes EXTRACT → identity gate → REASON.

**`store.ts`** — a JSON file, written atomically. A corrupt store fails loudly
rather than reading as empty. Assessments accumulate rather than overwrite.

**`analyse.ts`** — assembles one assessment and keeps three outcomes distinct:
opportunity, rejected-with-a-stage, and failed-run (never a finding about the
company).

**`views.ts` / `server.ts`** — `node:http`, server-rendered HTML, no framework.

One engine-adjacent correction, made in the app rather than the engine:
`ClaimExtractor.extract` can return only an output or null, and the adapter
reads null as "researched, found nothing". When reasoning is skipped because no
claim passed the identity gate, that is the wrong negative. The trace carries
the identity verdicts so `identity_collision` and `no_trigger_found` do not
collapse.

## 6. Final V1 architecture

```
                 ┌──────────────── app/ ────────────────┐
  browser ──────▶│ server.ts   node:http, no framework  │
                 │ views.ts    server-rendered HTML     │
                 │ store.ts    one JSON file, atomic    │
                 │ analyse.ts  assembles one assessment │
                 └───────────────────┬──────────────────┘
                                     │
   ┌─────────────────────────────────▼──────────────────────────────────┐
   │ EXTRACT (model call 1)  sources → claims + provenance + identity   │
   │                         attributes. Cannot assert attribution.     │
   ├────────────────────────────────────────────────────────────────────┤
   │ [engine] schema validation → source classification → IDENTITY GATE │
   │          → promotion to Fact                                       │
   ├────────────────────────────────────────────────────────────────────┤
   │ REASON (model call 2)   Facts only → inference → hypothesis →      │
   │                         polarity → consequence → sales angle       │
   ├────────────────────────────────────────────────────────────────────┤
   │ [engine] grounding → chain validation → demand direction → date    │
   │          attribution → freshness → two-axis → quadrant → action    │
   └────────────────────────────────────────────────────────────────────┘
```

Two AI calls. Each has a defined input, a structured output, a schema that
rejects rather than repairs, loud failure handling, and an observable trace.
Everything else is deterministic.

Runtime dependencies: **zero**, in both packages. Node 22.18+, and that is all.

Data model: raw evidence (with who supplied it and when) → extracted claims →
promoted Facts (with source, tier, verification level, date basis, identity
verdict) → inferences → hypothesis → signal → two scores with components and
caps → recommended action. Provenance is carried at every step, not
reconstructed.

## 7. Final user workflow

1. **Define the client** — what they sell, what changes create demand, who they
   cannot sell to. The same news is an opportunity for one seller and nothing
   for another, so this is first, not optional.
2. **Add a company** as an identity fingerprint: name, domain, town, industry,
   distinguishing words.
3. **Paste evidence** — URL, headline, publication date, page text.
4. **Run the assessment.**
5. **Read the verdict**, or the reason there is no verdict — with the stage that
   says which negative it is.
6. **Open the brief**: what changed, why now, how to open the conversation, and
   what is unproven with the question that would settle it.
7. **Check the evidence**: each fact with its source, tier, verification level,
   date basis and passage-match percentage; the caveats; both score axes
   component by component; the caps applied.
8. **See what the run did not look at**, then repeat for the next company.

Step 3 is "paste" rather than "retrieve" because outbound retrieval is blocked
in this environment. `HttpPageRetriever` already exists and is production-shaped;
wiring it is a configuration change, not a build.

## 8. What genuinely requires custom Signal software

Honestly, and with the negative answer given first in section 9.

- **The identity gate as a gate.** Not "check the company matches" — an
  architecture where the extractor has no field in which to assert attribution,
  the engine decides from the attributes it was given, and the reasoning model
  never sees a source that failed. A prompt can be asked to check identity. It
  cannot be prevented from seeing what it was told to ignore.
- **Earned verification.** A claim reaches page level only if a page was
  fetched and the passage was found in it. The negative is recorded with a
  percentage, not silently downgraded.
- **Pruning conclusions when their source is rejected.** `pruneChain` removes
  anything resting on a removed fact. A model asked to "ignore source 3" will
  keep the conclusion it already drew from it.
- **Grounding the generated prose against the evidence.** A model checking its
  own output for fabrication is the same model that fabricated it.
- **Two-axis scoring with mechanical caps.** Caps that cannot be forgotten
  under pressure, and cannot be argued with.
- **Distinct negatives.** Nine states that never collapse. A prompt returns
  "no significant signal found" for all nine.
- **Coverage reported separately from findings.** "We did not look" never
  becomes "we looked and found nothing".

## 9. What remains generic AI functionality

- **Reading a source and extracting what it says.** Any competent model does
  this. Signal's contribution is the schema it must fit and the validation that
  discards what does not — not the reading.
- **Writing the commercial narrative.** The "why now" and the sales angle are
  model prose. Signal constrains what may go into them and checks what came
  out; it does not write better sentences.
- **Judging commercial relevance.** The 0–25/0–20/0–15 judgements are the
  model's opinion, clamped. A Dify workflow would produce comparable numbers.
- **Everything in the interface.** Forms, lists, routing, storage. Ordinary
  CRUD.

A fair summary: **a good prompt reproduces perhaps 60% of what a Signal brief
contains, and none of what stops a Signal brief being wrong.** Whether that
difference is worth paying for is the question section 11 exists to answer. It
has not been answered, and this report does not claim it has.

## 10. Tests performed, and their results

| What | Result |
| --- | --- |
| `engine` typecheck | clean |
| `engine` tests | **299 pass, 0 fail** |
| All five engine scripts | run clean |
| `app` typecheck | clean |
| `app` tests | **55 pass, 0 fail** |
| End-to-end on real recorded model responses | **5/5 cases as expected** |

**End-to-end verification** (`app/scripts/verify-end-to-end.ts`) runs the whole
path on the five real recorded model responses, with expectations written
before the responses. Two expectations were wrong and are marked as revised,
with the originals stated:

- *Maeving* — expected `demand_increasing`; the engine derived **neutral** and
  was right: direction is grounded in per-claim demand impacts, and that
  recorded extraction predates the field, so the engine refused to score growth
  on the model's say-so.
- *Baltex* — expected an opportunity; the engine **rejected it at the floor**
  (evidence 44, value 52) and was right: two facts, one trade-press article,
  snippet level, undated.
- *Brambles* — every source rejected on identity. **The reasoning model was
  never called.**
- *Slack & Parr* — contraction, correctly reported as having **no commercial
  consequence** rather than dressed up as an opportunity.
- *deVOL-style grounding* — the fabrication check flags every ungrounded
  specific and caps the score.

No response was edited to make a case pass.

**Live product, driven as a person would drive it:**

- Server starts, reports its store path, and states plainly that without a
  credential it will refuse to assess.
- Client → company → evidence → assessment, over real HTTP, with both model
  calls going over a real socket to a local replay of the recorded responses.
  The rendered brief carries the facts, tiers, verification levels, passage
  match percentages, caveats, both axes with components, the caps, and the
  coverage.
- Repeated use works: a second assessment on the same company, and a second
  company, both recorded; assessments accumulate.
- Empty states: "No client yet", "No evidence yet", disabled assess button.
- Error states: no credential → 503 saying no verdict should be inferred;
  extraction 401 → "the run could not be completed… it says nothing about this
  company"; reasoning refusal → failed run; unknown page → 404; corrupt store →
  loud failure; hostile input escaped.
- Store on disk is readable JSON and survives a reopen.

**Authentication: not applicable.** V1 has none, deliberately — it is a
single-user local tool. If it is put in front of more than one person, that is
the first thing to add.

## 11. Known limitations

**Stated as limitations, not as features.**

1. **The live model call to api.anthropic.com is unverified.** There is no
   credential in this environment; the API answers and returns HTTP 401. The
   HTTP contract is verified against a local replay — two calls, correct
   headers, correct response shape — but the real provider has never accepted a
   request from this code.
2. **Live web retrieval is unverified.** Outbound CONNECT is refused with 403.
   No page has been fetched from the open web. Evidence is pasted, and page
   bodies in tests are either user-supplied or snippet reconstructions, so
   passage matching against them is close to circular.
3. **Evidence is manual.** The user finds the sources. Signal assesses them.
   This may be the right product — a salesperson who already found the news and
   wants to know whether it is worth a call — or it may be the thing that makes
   it unusable. That is unknown.
4. **The reasoning quality is unmeasured.** Five recorded responses, produced
   by a model against the real prompt, is a smoke test. It says the chain
   survives the engine's checks; it says nothing about whether the reasoning is
   good.
5. **The grounding check finds ungrounded specifics, not falsehoods.** It
   flagged "Europe" where the sources said "Germany and France" — a widening,
   not a fabrication. It cannot tell the two apart, and it is tuned to be
   generous, so it will miss a fabrication that shares four letters with a real
   name.
6. **Commercial value is still one model's opinion, clamped.** The evidence
   axis is earned; the value axis is a judgement in a box.
7. **One salesperson has graded five briefs.** That is a signal, not
   validation, and it is not treated as one.
8. **Single user, no auth, one JSON file.** Correct for now; the first thing
   that breaks with a second user.
9. **No deployment configuration.** `node src/server.ts` on a machine. That is
   the whole deployment story, and it is enough for step one of section 12.

## 12. The exact next real-world validation

Not "get feedback". One specific test, with a stated failure condition.

**The test.** Put the product in front of three salespeople who are not Alex,
at three companies with different offers. Each brings **their own** five
companies and their own evidence — sources they found themselves, not from
Pilot A. They run the loop unaided, having read nothing but the screen.

**Measure four things:**

1. **Can they complete the loop without help?** Client, company, evidence,
   assessment, brief. Count where they stop.
2. **Do they agree with the verdict?** Per brief: would you make this call?
   Recorded before they see the score.
3. **Do the caveats change what they do?** The controls are the claimed
   differentiator. If nobody reads or acts on a caveat, the differentiator is
   not one — whatever the architecture proves.
4. **Would they paste evidence again tomorrow?** The manual step is the biggest
   product risk in section 11. This is the question that tests it.

**Failure condition, stated in advance.** If salespeople reach the same
decisions from the raw sources, in comparable time, without the briefs, then
Signal's value is not in the assessment and the product should be rethought or
stopped — not made more sophisticated.

**What is needed to run it:** an API credential, and network egress for
retrieval if evidence-gathering is to be automated later. Nothing else. The
product is ready for this test now.

---

## Git commits

On `claude/signal-project-state-cw43qu`, from baseline `6318296`:

```
981d4b3  Remove the contact-enrichment provider
56b8011  Add the commercial reasoning layer
5f989ff  Check that the write-up says nothing the evidence does not
d218fd1  Run the engine unchanged over evidence a user supplies
0df7685  Persist clients, companies, evidence and assessments
b006c3a  Assemble one assessment, end to end
f48d93d  Add the product surface
b81ccd6  Verify the whole product on real recorded model responses
57e94d3  Describe what Signal is, and what is not verified
0bdfb1e  Exercise the HTTP boundary against a local replay
```
