# Signal

Commercial intelligence platform for discovering, validating, scoring and acting on sales opportunities.

## Architecture

Research providers → evidence → fusion → contradiction checks → commercial scoring → opportunities → actions → outcomes.

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
