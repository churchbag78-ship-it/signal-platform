# Signal Engine

The portable commercial reasoning layer. No database, no HTTP, no UI, no
provider SDKs — this package can be run from a script, a worker or an
application without change, which is what keeps the methodology from
becoming trapped inside a product.

```bash
cd engine
npm install       # typescript + @types/node, for typechecking only
npm test          # node --test, no test framework dependency
npm run typecheck
npm run pilot-a   # runs Pilot A end to end and prints the report
```

Node 22.18+ runs the TypeScript directly by stripping types, so the engine
has **no runtime dependencies at all**.

## What is implemented, and what is an interface

The split is deliberate. Judgement that must behave identically on every run
is implemented and tested here; research that needs the world is an interface.

| Implemented (deterministic) | Interface (supplied by the caller) |
|---|---|
| Identity resolution (`domain.ts`) | Search execution (`SearchClient`) |
| Freshness and recency bands (`freshness.ts`) | Claim extraction — what a source means (`ClaimExtractor`) |
| Source classification by URL (`research/sources.ts`) | Contact enrichment (`ContactProvider`) |
| Claim chain validation and depth (`claims.ts`) | |
| Source independence (`evidence.ts`) | |
| Scoring, caps, confidence (`scoring.ts`) | |
| Duplicate/history handling (`dedupe.ts`) | |
| Cost-aware provider routing (`providers/registry.ts`) | |
| Query generation, research loop (`research/adapter.ts`) | |
| Stage orchestration (`pipeline.ts`) | |

## Fact → inference → hypothesis

The epistemic spine, in `domain.ts` and enforced by `claims.ts`.

- A **fact** is what a source states, and carries that source.
- An **inference** is what we concluded, and names what from.
- A **hypothesis** is the commercial implication, always labelled unproven and
  carrying a stated way to test it.

`validateChain` rejects a hypothesis with no fact in its ancestry — speculation
dressed as intelligence — a fact with no source URL, a chain that loops, and a
hypothesis nobody can test. It also *measures* the number of reasoning hops
rather than trusting a researcher's estimate, and that measurement feeds the
scoring penalty directly. "They're expanding, so they'll need X, so they'll
want Y" costs points automatically.

That is the point: the output is auditable rather than merely plausible,
because the parts that decide what gets reported do not vary between runs.

## Pipeline order

```
identity → ICP fit → trigger discovery → evidence → freshness →
contradiction → hypothesis → scoring → decision-maker role →
recommended action → duplicate/history
```

Freshness runs before assessment so no research effort is spent on stale
news. Duplicate checking runs last, on candidates that already qualify.

## Two rules the code enforces rather than documents

**Contacts never gate an opportunity.** Person-level contact data carries no
score weight and is not a pipeline stage. The scored decision-maker component
rewards identifying the *function* that owns the problem, which is reasoning
and always achievable. `NullContactProvider` is the default, and the engine
runs end to end with it in place. Enrichment happens afterwards, only for
opportunities that already scored above the threshold — a paid lookup is
never spent on a candidate that was going to be dropped.

**Spending is never a side effect.** Every provider operation declares cost,
availability, confidence and data type independently, because one provider
routinely spans free, paid and plan-gated operations. `route()` selects the
cheapest available operation within an explicit budget that defaults to zero,
and paid operations require `approvedForSpend` before any call is made.

## Provider abstraction

Cost and availability are per **operation**, not per provider:

```ts
{
  providerId: 'apollo',
  operation: 'apollo.organizations_lookup',
  dataType: 'company_identity',
  cost: { credits: 0 },
  availability: 'available',
  confidence: 0.7,
}
```

See `docs/PROVIDER_NOTES.md` for the evaluation that forced this shape.

## Pilot A

`npm run pilot-a` replays the real Orbital Direct research corpus
(`fixtures/pilot-a.ts`) through the whole loop. Nine companies researched,
four reported:

```
Maeving 70 · Baltex 70 · Bramble 67 · deVOL 62
```

and five explained rejections covering every rejection path: competitor and
enterprise retailer on ICP, a 2020 relocation on freshness, a company with no
current trigger at all, and one that scored 56 against a floor of 60.

Two things that run demonstrates. First, "researched and found nothing" is a
recorded outcome distinct from "not researched" — a company absent from the
corpus raises rather than quietly reporting a clean negative. Second, because
page fetching was blocked when the corpus was captured, every row is capped at
70, which compresses the ranking: Maeving and Baltex tie at 70 despite raw
scores of 81 and 73. The cap is doing its job, and the flattening is the
visible cost of unverified sourcing.

## Tests

86 tests. The scoring rubric and every cap, recency bands, source
independence, claim-chain validation, duplicate handling, routing, enrichment
gating, cost tracking, source classification and the full research loop.

Several are regressions for real failures found by running Pilot A:

- Syndicated copies of one press release counted as independent sources.
- A 2020 story surfacing as current news.
- A company's own website classified as a tier-4 aggregator, because
  first-party detection needs the company domain and the caller wasn't passing
  it. Found by reading the printed report, not by a failing test.
