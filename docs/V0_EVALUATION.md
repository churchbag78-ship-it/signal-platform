# Signal V0 — what real searching actually surfaced

_2026-09-16. Every search below was really executed. Nothing here is simulated._

## What could and could not be exercised

| Stage | Status here | Why |
| --- | --- | --- |
| Read the client's website | **Could not run** | Every domain is refused by the egress proxy with HTTP 403. No website was fetched. |
| Commercial model | Ran, on a written stand-in corpus | Marked as a stand-in in the capture file. |
| Demand triggers | **Ran for real** | |
| Search | **Ran for real** | Agent web search, 10 queries. |
| Candidate extraction | **Ran for real** | On genuine search results. |
| Identity resolution | **Ran for real** | On genuine search results. |
| Fetch evidence pages | **Could not run** | Same 403. |
| Verify / reason / score | Could not run | No page bodies to verify against. |

So this evaluates the **discovery half** on real data. The verification half —
the part V1 already proved — could not be exercised because nothing could be
fetched.

## Finding 1 — condition-only queries return almost nothing

Two queries describing only the *event*:

- `UK manufacturer "has outgrown" warehouse moves larger premises 2026`
- `manufacturer wins first export order needs distribution UK 2026 announcement`

**Candidates: 0 from 20 results.** What came back instead: a warehouse
company's marketing blog about "signs your warehouse has outgrown its space",
two job adverts on the DWP job board, a Statista page on cloud-computing market
size, US companies, a 2016 relocation, a 2021 lease, and several pages of
aggregate government export statistics.

This is the predicted failure: web search indexes *documents about a topic*, it
does not enumerate *instances of a condition*.

## Finding 2 — naming the channel changes the result completely

The same events, searched by naming **where they get reported** (regional
business press), returned real, current, named companies:

| Query targets | Candidates returned |
| --- | --- |
| Insider Media / TheBusinessDesk, Midlands, contracts | Modular Systems (Sizewell C bathroom pods, 14 Sep 2026), Clarity Plastics, Dri-Pak (£1.8m HSBC, expansion) |
| Insider Media, Leicestershire/Derbyshire relocations | Slack & Parr (new HQ, multimillion-pound facility), Tsubaki (Derbyshire facility, ownership early October), a 175,000 sq ft forklift-manufacturer facility, a water and environment firm relocating its Derby base |
| Insider Media, Birmingham/Nottingham office lettings | Trowers & Hamlins (17,000 sq ft, One Snow Hill, ten-year lease), Lodders (6,500 sq ft, 1 Newhall Street, **"move in September following fit-out works"**), Softcat (9,000 sq ft), Goldman Sachs (110,000 sq ft), Phoenix Group (25,107 sq ft), Shakespeare Martineau (8,680 sq ft, up from 7,180), MIDFIX (100k sq ft) |

**The `observableTraces` field is doing the work, not the event description.**
Discovery succeeds when the query encodes the publication that already
enumerates these events, because regional business press *is* a feed of
corporate change.

## Finding 3 — the method's success tracks trigger observability, not reasoning quality

Five business types, same method, channel-targeted queries throughout:

| Business type | Trigger | Result |
| --- | --- | --- |
| **Commercial fit-out** | occupier signs a lease on shell/cat A space | **7 candidates, 5 resolved.** Best case by a distance. Square footages, buildings and dates in the snippets. |
| **Logistics / warehousing** | manufacturer outgrows premises, wins export contract | **Strong.** Named companies with dated premises and contract events. |
| **IT / MSP** | company acquired, needs systems integration | **Moderate, then blocked.** Real events surface, but headlines anonymise: "Compressor services firm acquired by Swedish group", "Birmingham market research firm acquired by London business". The company name is in the article body, which could not be fetched — so no candidate. |
| **Recruitment** | company opens a site and must staff it | **Weak.** Results were publication index pages and aggregate commentary ("Permanent recruitment rises in the Midlands"), not events at named companies. |
| **Occupational health** | headcount grows in a noisy environment, triggering health surveillance duties | **Zero.** Every result was a regulator page, a trade-body blog, a competitor's marketing, or national statistics. The event is never publicly reported because it is internal. |

The ordering is not about how well the reasoning worked. It is entirely about
whether a publication routinely reports that kind of event:

> **property and corporate-finance events are enumerated in public;
> operational and internal-state events are not.**

A business whose customers' demand triggers are invisible cannot be served by
this method, however good the causal reasoning is. That is a market boundary,
and finding it is a result.

## Finding 4 — a real false positive in identity resolution, caught and fixed

Running the built code on the real search data resolved **"Phoenix Group"**
(FTSE 100 UK life assurance) to **`phoenixinsgrp.com`, an unrelated insurance
agency in Texas** — because "phoenix" is a substring of "phoenixinsgrp".

This is the worst output the system can produce, and it arrives one stage
*before* the identity gate can catch it: a fingerprint built on a wrong domain
passes the gate, attributes sources to the wrong company, and yields a confident
brief about a business that never had the event.

Fixed: a one-word company name must now *match* the host after the same noise
words are stripped from both, not merely appear inside it. The run now refuses
it. A regression test carries the real case.

## Finding 5 — a real recall cost, left in place deliberately

**Shakespeare Martineau** trades at `shma.co.uk`. Signal cannot establish that
from the name, and refuses. That loses a genuine candidate — and inventing the
link is precisely the failure in Finding 4. The refusal is the right trade and
the limitation is recorded rather than patched over.

## Finding 6 — the trigger stage discards generic signals as designed

On the fit-out business the model proposed and rejected, in its own words:

- *"Company raises funding"* — "Funding is not a need. It says nothing about whether the company is taking space."
- *"Company is hiring"* — "Hiring is a standing condition, not an event."
- *"Company appoints a new CEO"* — "There is no mechanism from a leadership change to a fit-out requirement that would not apply equally to any supplier."

And the deterministic check discarded a trigger that named an offering the
client does not sell. This is the mechanism that separates Signal from a
generic buying-signal taxonomy, and it works.

## What this evaluation cannot tell you

- Whether the opportunities would be **commercially useful**. No evidence page
  could be fetched, so nothing reached the verification and reasoning layer.
- Whether the salesperson **already knew** these companies. Not measured.
- Whether the commercial model is **specific to a business** — the model here
  was built from a written stand-in corpus, not a real website.
- Whether live search behaves like agent search. The provider is unrun.

## The bug this evaluation found in the build itself

The first real run killed the single best trigger. `looksCompanySpecific`
treated *any* quoted phrase as a company name, so `"signs lease" OR "takes
space"` — exact-phrase searching, the correct way to write that query — was
rejected. Only a Title Case quoted phrase reads as a company name; the rule now
says so. Without running it on real queries this would have shipped.
