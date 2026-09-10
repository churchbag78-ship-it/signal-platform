# Signal

Commercial intelligence platform for discovering, validating, scoring and acting on sales opportunities.

## Architecture

Research providers → evidence → fusion → contradiction checks → commercial scoring → opportunities → actions → outcomes.

## Current phase — Phase 0: methodology validation

The intelligence methodology is being proven on paper before any of it is
built into software. Nothing here is an application yet, deliberately.

- [`docs/SIGNAL_PROJECT_STATE.md`](docs/SIGNAL_PROJECT_STATE.md) — where the project stands and why Phase 0 comes first
- [`docs/RESEARCH_METHODOLOGY.md`](docs/RESEARCH_METHODOLOGY.md) — the intelligence logic: ICP model, signal taxonomy, evidence rules, scoring rubric
- [`prompts/signal-master-prompt.md`](prompts/signal-master-prompt.md) — the executable master prompt
- [`docs/VALIDATION_PROTOCOL.md`](docs/VALIDATION_PROTOCOL.md) — how a run is graded, and what "proven" means
- [`runs/`](runs/) — pilot runs and the per-client duplicate-prevention ledger

The methodology documents are the portable core of Signal. The eventual
application automates them; it does not replace or hide them.

## Development

This repository is the source of truth for the production build. Prototype ZIPs are retained only as historical checkpoints and are not part of the installation workflow.

## Planned stack

- Next.js application
- Supabase/PostgreSQL
- Vercel deployment
- Interchangeable research providers
- Background research/monitoring workers
- CRM integrations
- Automated tests and Research Lab

## Product principles

1. Evidence before assertion.
2. Conflicts require review.
3. Weak SME evidence may generate a hypothesis, not a false certainty.
4. Every opportunity should have an explainable reason and recommended action.
5. Outcomes feed measurement and controlled learning.
6. API cost is treated as a product metric.
