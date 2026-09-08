# Signal Engine

The portable commercial reasoning layer. No database, no HTTP, no UI, no
provider SDKs — this package can be run from a script, a worker or an
application without change, which is what keeps the methodology from
becoming trapped inside a product.

```bash
cd engine
npm install      # typescript + @types/node, for typechecking only
npm test         # node --test, no test framework dependency
npm run typecheck
```

Node 22.18+ runs the TypeScript directly by stripping types, so the engine
has **no runtime dependencies at all**.

## What is implemented, and what is an interface

The split is deliberate. Judgement that must behave identically on every run
is implemented and tested here; research that needs the world is an interface.

| Implemented (deterministic) | Interface (supplied by the caller) |
|---|---|
| Identity resolution (`domain.ts`) | Trigger discovery (`ResearchAdapter`) |
| Freshness and recency bands (`freshness.ts`) | Evidence gathering and hypothesis (`ResearchAdapter`) |
| Source independence (`evidence.ts`) | Contact enrichment (`ContactProvider`) |
| Scoring, caps, confidence (`scoring.ts`) | |
| Duplicate/history handling (`dedupe.ts`) | |
| Cost-aware provider routing (`providers/registry.ts`) | |
| Stage orchestration (`pipeline.ts`) | |

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

## Tests

53 tests covering the scoring rubric and every cap, recency bands, source
independence, duplicate handling, routing, enrichment gating and cost
tracking. Several are regressions for real failures found in Pilot A —
syndicated sources counted as independent, and a 2020 story surfacing as
current news.
