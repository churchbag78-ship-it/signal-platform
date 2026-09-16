# Signal

Signal turns a verified change at a company into a commercial assessment for a
specific seller — or says, in as many words, that there is nothing here.

It is an evidence-first system. The single rule everything else follows from:
**a claim without a source cannot be constructed, and a conclusion cannot
outlive the source it rested on.**

## Run it

```
cd app
node src/server.ts        # http://localhost:3000
```

Node 22.18 or later. **There are no dependencies to install** — not for the
engine, not for the app. TypeScript is stripped by Node itself; the server is
`node:http`; persistence is a JSON file.

Assessment needs a model credential:

```
export SIGNAL_LLM_API_KEY=...          # or ANTHROPIC_API_KEY
export SIGNAL_LLM_MODEL=claude-opus-5  # optional
```

Without one the product still records clients, companies and evidence, and
refuses to assess rather than guessing. A missing credential is never presented
as a finding about a company.

## What it does

1. **Define the client.** Who is selling, what they sell, what changes at a
   customer create demand for them, and who they cannot sell to. The same news
   is an opportunity for one seller and nothing for another, so this comes
   first.
2. **Add a company** as an identity fingerprint — name, domain, town, industry,
   distinguishing words. Not a name: a name alone collides with same-named
   businesses worldwide.
3. **Supply evidence.** A URL, a headline, and the page text where you have it.
4. **Assess.** Two model calls, with the engine between and after them.
5. **Read the verdict** — or the reason there is no verdict, which is a
   different and more useful statement than silence.

## How an assessment is made

```
evidence
   ↓
EXTRACT  (model)      reads sources → structured claims with provenance and
                      identity attributes. Never decides what a claim means,
                      and has no field in which to assert "this is about the
                      target".
   ↓
[engine]              schema validation → source classification → IDENTITY
                      GATE → promotion to Fact. A claim that fails cannot
                      proceed, and a Fact without a valid source cannot be
                      constructed.
   ↓
REASON   (model)      reads ONLY promoted Facts → inference → hypothesis →
                      polarity → commercial consequence → sales angle.
   ↓
[engine]              grounding check → chain validation → demand direction →
                      date attribution → freshness → two-axis scoring →
                      quadrant → recommended action.
```

Two model calls, both bounded. Everything else is deterministic: the model is
used where judgement is genuinely required — what a source says, and what it
implies commercially — and nowhere else.

## The controls, and what each one is for

| Control | The failure it exists to prevent |
| --- | --- |
| Identity gate | A source about a different company with a similar name speaking for this one. Four verdicts: match, unresolved, collision, rejected. |
| Passage verification | A claim earning page-level evidence when no page was opened, or when the page does not contain the passage. Verification is *earned*, never asserted. |
| Grounding check | A name, figure or date in the write-up that appears in no source. This was built after a real brief named three countries no source mentioned. |
| Date attribution | An award or a reporting period dating a change it does not date, and an old corroborating fact ageing a current one. |
| Demand direction | A declared "growth" label surviving evidence that does not support it. Direction is derived from per-claim demand impacts, not taken on trust. |
| Two-axis scoring | A well-evidenced signal worth nothing and a valuable one barely sourced scoring the same. Evidence and commercial value are scored separately. |
| Distinct negatives | "Not researched", "found nothing", "too thin", "wrong company", "too old" and "the run failed" collapsing into one useless answer. |
| Coverage reporting | "We did not look" being read as "we looked and found nothing". |

## Layout

```
engine/    the deterministic core: identity, claims, sources, scoring,
           freshness, dating, direction, research adapter. No dependencies.
app/       the product: reasoning layer, grounding check, storage, HTTP server.
docs/      methodology, benchmark, validation protocol, critical review.
runs/      recorded runs and their reports.
```

## Tests

```
cd engine && npm test          # the engine
cd app    && npm test          # the product
cd app    && npm run verify    # end to end, on real recorded model responses
```

## What is not verified

Stated plainly, because a system about evidence should not be vague about its
own:

- **The live HTTP model call.** No credential exists in the development
  environment (`api.anthropic.com` answers and returns 401). Both model calls
  are exercised through recorded real responses, so everything downstream of
  `fetch` is tested; `fetch` itself is not.
- **Live web retrieval.** Outbound CONNECT is refused with 403, so no page has
  been fetched from the open web. Page bodies in tests are user-pasted or
  reconstructed from search snippets, and are labelled as such.
- **Whether the assessments are commercially right.** One salesperson has
  graded five briefs (`runs/orbital-direct/`). That is a signal, not market
  validation, and it is not treated as one.

## Product principles

1. Evidence before assertion.
2. Conflicts require review, not resolution by the system.
3. Thin evidence may produce a hypothesis, never a false certainty.
4. Every verdict — including every negative — must be explainable and traceable.
5. A number is never shown without what it is made of.
6. Where something could not be verified, say so rather than implying it was.
