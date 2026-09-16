# Signal

**Signal finds reasons to sell.**

Give it a company's website. It works out what they sell and who buys it, what
has to happen at another company to create demand for them, goes looking for
companies that has just happened to, verifies the evidence — and throws away
everything it cannot stand up.

It is built to return **fewer** results, not more. A company matching your
customer profile is not an opportunity. A change that creates a need for
something you actually sell is.

---

## Run it

```
cd app
node src/server.ts        # http://localhost:3000
```

Node 22.18 or later. **No dependencies to install** — not for the engine, not
for the app. TypeScript is stripped by Node itself; the server is `node:http`;
persistence is a JSON file.

### Credentials

Research needs two. Set both, and the app does live research:

```
export SIGNAL_LLM_API_KEY=sk-ant-...        # or ANTHROPIC_API_KEY
export SIGNAL_LLM_MODEL=claude-opus-5       # optional
export SIGNAL_SEARCH_API_KEY=...            # Brave or Serper
export SIGNAL_SEARCH_PROVIDER=brave         # brave (default) | serper
```

With neither, the application still runs, still keeps your history, and
**refuses to research rather than guess**. A missing credential is never
presented as a finding about a company.

### Replaying a captured run

Where the machine has no outbound network — a locked-down sandbox, for instance —
point Signal at a capture file of searches, pages and model responses recorded
elsewhere:

```
export SIGNAL_CAPTURE=captures/fitout-2026-09-16.json
node src/server.ts
# or, headless:
node scripts/replay.ts captures/fitout-2026-09-16.json meridianworkspace.co.uk
```

Every stage of the pipeline runs for real; only the transport is replayed. A
query with no capture is an **error**, never an empty result — otherwise "we did
not look" would silently become "we looked and found nothing".

---

## What happens when you press the button

```
 website
   │  read the site (provenance kept — every page's URL and text)
   ▼
 COMMERCIAL MODEL      (AI)  what they sell, who buys, buying situations,
   │                         and who they CANNOT serve
   │  checked back against the site text: an offering the site never
   │  describes is reported, not used
   ▼
 DEMAND TRIGGERS       (AI)  real-world change → business need → THIS
   │                         client's offering
   │  a trigger that cannot name one of their actual offerings is
   │  DISCARDED here, before it becomes a search
   ▼
 SEARCHES                    company-free queries, spread across triggers
   ▼
 CANDIDATE COMPANIES   (AI)  which company did this happen TO
   ▼
 IDENTITY RESOLUTION         name → domain → fingerprint, or refusal
   ▼
 EVIDENCE                    fetch the source pages
   ▼
 ── the existing engine, unchanged ──────────────────────────────
 identity gate → passage verification → claim promotion →
 REASONING (AI) → grounding check → chain validation → demand
 direction → date attribution → freshness → two-axis scoring →
 quadrant → recommended action
```

Five bounded AI calls. Each has a defined input, a structured output, a schema
that rejects rather than repairs, loud failure handling and an observable trace.
Everything between and after them is deterministic.

## The controls, and what each one is for

| Control | The failure it prevents |
| --- | --- |
| Offering-link rule | A generic buying signal. "Raised funding" names no offering and is discarded; "won a contract needing bonded storage they lack" names one and survives. |
| Offering grounding | An invented capability. An offering the client's own site never describes would otherwise generate triggers, queries and opportunities — all consistent, all about a service nobody sells. |
| Subject test | An opportunity about the wrong company. One article names the company, its supplier, its adviser and the council; only one had the event. |
| Identity resolution | A guessed domain. A wrong identity passes the identity gate and produces a confident brief about a business that never had the event. |
| Identity gate | A source about a same-named company speaking for this one. |
| Passage verification | A claim earning page-level evidence when the page does not contain it. |
| Grounding check | A name, figure or date in the write-up that appears in no source. |
| Date attribution | An award or a reporting period dating a change it does not date. |
| Distinct negatives | "Did not look", "found nothing", "too thin", "wrong company", "too old" and "the run failed" collapsing into one useless answer. |

## Layout

```
engine/    the deterministic core: identity, claims, sources, scoring,
           freshness, dating, direction. No dependencies.
app/src/   the product: website reading, commercial model, demand triggers,
           discovery, identity resolution, reasoning, grounding, server.
app/captures/  recorded research, for replaying without network access.
docs/      methodology, benchmark, reconciliation, build reports.
```

## Tests

```
cd engine && npm test     # 299
cd app    && npm test     # 81
cd app    && npm run verify   # end to end on real recorded model responses
```

## The manual harness

`/diagnostic` is the old V1 flow: type a client profile, type a company, paste
evidence. It is **not** the product — it is how you test the reasoning layer
with discovery held constant. Keep it for that; do not mistake it for the
normal workflow.

## What is not verified

- **Live search and page retrieval have never run.** The development
  environment's egress proxy refuses CONNECT for every host with HTTP 403.
  `HttpSearchClient` and `HttpPageRetriever` are written and typechecked and
  have never made a successful request.
- **The live model call has never run.** `api.anthropic.com` answers and returns
  401; there is no credential here. The HTTP contract is verified against a
  local replay; the real provider is not.
- **Whether the results are commercially useful** is unmeasured. See
  `docs/V0_EVALUATION.md` for what real searching did and did not surface, and
  where the method stops working.
