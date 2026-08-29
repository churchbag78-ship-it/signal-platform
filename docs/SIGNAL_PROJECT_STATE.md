# Signal — Project State & Recommended Next Steps

_Written against: `churchbag78-ship-it/signal-platform` @ `bdaf373`, 2026-08-29._

## 1. What actually exists

The repository contains one file: `README.md`. It states the intended
architecture (research → evidence → fusion → contradiction checks →
scoring → opportunities → actions → outcomes), a planned stack
(Next.js, Supabase/Postgres, Vercel, pluggable research providers,
background workers, CRM integrations), and six product principles.

There is no code, no `docs/PRODUCT_SPEC.md`, no `docs/BUILD_PLAN.md`,
no package.json, no database schema, no research prompt, no example
run. The README describes intent, not a built or even partially built
system. This is genuinely Phase 0 — a naming/vision document, not a
foundation.

Two source documents govern this project and they are not fully
aligned:

- **The Signal Master Project Brief** (product/business, provided in
  this task) says explicitly: *do not build a large SaaS application
  yet* — first validate the intelligence engine and workflow with a
  structured master prompt and repeatable manual/semi-manual research
  process, and only automate once the methodology is proven.
- **The Lead Implementation Brief** (`SKILL.md`, technical) frames
  Signal as "a real commercial SaaS product, not demo code" from step
  one, and its 17-stage vertical-slice plan starts immediately with
  Next.js + Supabase application scaffolding, auth, and a relational
  data model.

Both are useful, but they answer different questions: the Brief is
about proving the methodology works; SKILL.md is about how to build
production software once you're building it. Right now nothing has
validated that the methodology produces good opportunities, so
committing to schema, auth, providers, and CRM abstractions today
would be encoding untested assumptions into infrastructure — exactly
what the Brief warns against and what SKILL.md's own "don't
over-engineer before purpose is clear" rule would object to.

## 2. Gap analysis against the Brief

| Brief requirement | Status |
|---|---|
| Master research prompt / repeatable process | Not present |
| At least one real end-to-end run (client site → research → scored, evidence-backed opportunities) | Not done |
| Signal taxonomy adapted per client type (logistics vs IT example) | Not done |
| Scoring methodology defined and documented | Not done — README lists principles, no scoring model |
| Evidence/contradiction-checking discipline | Described as a principle, not exercised |
| Output report format | Not implemented |
| Software automation | None — correctly, per Brief's own sequencing |

Nothing here is a criticism of prior work — there isn't any yet. It's
a straight "we are earlier than SKILL.md's phase list assumes."

## 3. Recommendation

Run a **Phase 0 (methodology validation)** before touching
SKILL.md's Phase 1 (application foundation):

1. Write the actual Signal master research prompt as a standalone,
   versioned document (`docs/RESEARCH_METHODOLOGY.md` or similar) —
   the ICP-derivation logic, signal taxonomy, evidence/contradiction
   checklist, scoring rubric, and output format from the Brief,
   turned into an executable prompt/process rather than prose.
2. Run it manually (Claude + web research, no app) against 2-3 real
   client websites spanning different industries (e.g. one
   logistics-type, one IT/services-type, one SME) to test whether the
   client-adaptation logic in the Brief actually holds up.
3. Have a human (or a second adversarial pass) grade the output
   against the Brief's own bar: is every opportunity evidence-backed,
   is "why now" specific rather than generic, are scores explainable
   and not inflated, would a salesperson actually use this list.
4. Only after that produces consistently good results, start
   SKILL.md's vertical slices — and even then, slice 1 should be the
   smallest possible wrapper that runs the *proven* prompt/process
   and stores its output, not the full Supabase/CRM/subscriptions
   surface at once.

This keeps the two documents compatible: SKILL.md's stack and
architecture are the right target for when Signal becomes software;
the Brief is right that we're not there yet.

## 4. Minor discrepancy to flag

The Brief's "CURRENT GITHUB" section names the repository as
`churchbag78-ship-it/Business`. The actual working repository for
this task is `churchbag78-ship-it/signal-platform`, which already
carries Signal-specific content (this README) and is presumably the
intended one. Flagging in case `Business` is a separate, older
location that should be checked for prior prototype material before
it's considered irrelevant.

## 5. Explicit non-actions this task took

Per the Brief's "do not immediately build a large application" and
SKILL.md's own "don't over-engineer before purpose is clear": no
Next.js scaffold, no Supabase schema, no provider abstraction, and no
`ARCHITECTURE.md`/`TECHNICAL-DECISIONS.md` were created in this pass.
Those are Phase 1 deliverables and are premature until Phase 0 above
produces a validated methodology to build around.
