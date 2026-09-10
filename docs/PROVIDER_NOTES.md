# Research & Data Provider Notes

Running log of providers evaluated for Signal, what they can actually
supply, and what they cost. The eventual platform needs a provider
abstraction (never hard-code one provider); this file is the evidence
that abstraction should be designed against.

---

## Apollo.io — evaluated 2026-09-08 — INCONCLUSIVE

**Why evaluated.** Pilot A (Orbital Direct) failed to identify a decision
maker on 7 of 7 rows. The open question from that run: can a people-data
provider close the gap, and at what cost per useful contact? Apollo was
connected to the session, so it was the obvious first test.

**What happened.** The experiment could not be run, for two separate
reasons:

1. **People search is not available on the account's plan.**
   `mixed_people/api_search` returned `API_INACCESSIBLE` — "not included
   in your Free plan". This is the substantive blocker: the specific
   capability the decision-maker question needs is gated behind a paid
   tier on this account.
2. **The connection then required re-authorization** (expired token),
   which cannot be completed from a non-interactive session.

**Credits spent: zero.** The failed people search returned a plan error
rather than consuming credits, and the balance check is free. Position
observed before the token expired, for reference: 175 lead credits
remaining, 0 consumed in the 22 Aug – 22 Sep cycle; direct-dial credits
fully consumed (160/160); a 100-credit MCP grant present.

### What the tool surface tells us anyway

Even without a successful call, the API shape is informative for the
build:

| Endpoint | Cost | Relevance to Signal |
|---|---|---|
| `organizations_lookup` | **Free** | Identity resolution by domain — directly useful, and identity resolution is called out in SKILL.md as a real problem. Free means it can run on every candidate |
| `organizations_enrich` | 1 credit each | Revenue, employee count, location, funding. Would verify the ICP-fit component of the score — the largest single component at 25 points — which Pilot A could not check because Companies House was unreachable |
| `organizations_job_postings` | 1 credit each | **Unexpectedly interesting.** Live job postings are a first-class signal type in the brief. This is a signal-engine provider, not just a contact source — a company advertising warehouse, transport or export roles is a live hiring signal, retrievable per company on demand |
| `mixed_people/api_search` | Paid plan only | The decision-maker gap. Unavailable here |

### Implications for the build

1. **Cost tiering is real and it is per-endpoint, not per-provider.**
   Apollo alone spans free identity lookup, 1-credit firmographics and
   1-credit job postings. The provider abstraction needs cost metadata at
   the *operation* level, not the provider level, or routing decisions
   ("use cheap providers by default") cannot be expressed.
2. **Job postings deserve their own provider slot.** They are a signal
   source, priced per company, and can be pulled on demand for a shortlist
   rather than the whole candidate pool — exactly the "expensive research
   only when justified" pattern SKILL.md asks for.
3. **The decision-maker question remains open.** It is now blocked on a
   commercial decision (paid people-data tier) rather than a technical
   one. That decision should be made deliberately, with the GDPR position
   settled first — this is UK/EU B2B contact data, and Signal's stated
   position is public professional information only.

### To resume

Re-authorize the Apollo connector (claude.ai connector settings), and
confirm whether the account has, or should have, a plan that includes
people search. Then the experiment is: 7 companies → titles filtered to
operations/supply chain/logistics/procurement → measure how many yield the
*right function* (not the CEO), and the credit cost per useful contact.
