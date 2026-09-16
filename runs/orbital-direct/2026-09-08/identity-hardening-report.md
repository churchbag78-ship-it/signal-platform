# Pilot A v2 — identity hardening, before/after

_Orbital Direct · 2026-09-08 · `npm run pilot-a-live`_

v1 (`engine-run-live.txt`, `live-run-report.md`) is preserved unchanged as
historical evidence. Nothing in v1 was re-scored.

---

## What changed, and why

**Identity became a pipeline invariant, not a query trick.** v1 lost three of
seven companies to name collisions. Disambiguating queries fixed those three,
but a search engine can always hand back the wrong company, so the real defence
is at the source: every fact now carries an `attribution` describing what its
source says about the company it discusses, and `attributeSource()` must return
`match` before that fact may enter the evidence corpus.

The governing rule is that **a matching name is never sufficient**:

| Situation | Verdict |
|---|---|
| Registry number matches | match (0.99) |
| Published on a verified owned domain | match (0.95) |
| Name + corroborating attribute (country, town, industry) | match |
| Name alone, nothing corroborating | **unresolved** |
| Name + conflicting country, industry, domain or registry number | **identity_collision** |
| No company identifiable at all | unresolved |

Attributions are read from the result title and snippet, never derived from the
target fingerprint — otherwise every source would trivially match itself.

**Conclusions cannot outlive their sources.** When a fact is rejected,
`pruneChain` removes it and cascades: any inference or hypothesis left with no
surviving parent goes too. If the hypothesis itself loses all grounding the
company is rejected as `identity_unresolved` rather than reported on the
survivors.

**Signal polarity.** Signal is no longer implicitly about growth. Every
extraction declares `polarity` (`demand_increasing` / `demand_reducing` /
`neutral`) and a `consequence` judgement answering the real question — *does
this change create something this client can act on?* Contraction, closure,
restructuring and withdrawal are valid signal types; whether they are
opportunities depends on the client.

**Four negative outcomes, kept distinct**, because each implies a different
follow-up: `no_trigger_found` (looked, nothing there) · `insufficient_evidence`
(something, too thin) · `identity_unresolved` / `identity_collision` (could not
tell, or it was a different company) · `no_commercial_consequence` (real signal,
nothing to sell into).

**Verified alias domains with provenance.** An alias carries evidence, a source
URL, a verification method and a date. `verifiedBy: 'unverified'` confers
nothing — a similar-looking domain is not evidence of ownership.

---

## Before / after

| Metric | v1 | v2 |
|---|---|---|
| Companies in scope | 9 | 9 |
| Queries executed | 14 | 14 |
| Provider credits | 0 | 0 |
| Identity collisions in search results | **3 of 7 companies** | **0** |
| Sources accepted into the corpus | 8 (ungated) | **8 (gated)** |
| Sources rejected on identity | n/a — no gate existed | **1** |
| Opportunities reported | 3 | 3 |
| Pipeline time | 3 ms | 5 ms |

### Opportunities

| Company | v1 | v2 | Why it moved |
|---|---|---|---|
| Maeving | 70 (raw 87) | **70 (raw 87)** | Unchanged |
| Baltex | 70 (raw 86) | **70 (raw 86)** | Unchanged |
| deVOL Kitchens | 50 — **dropped** | **70 (raw 83) — reported** | Verified alias makes `devolkitchens.co.uk` first-party (tier 1), lifting it off the aggregator-only cap of 50 |
| Bramble Group | 63 — reported | 50 — **dropped** | v2's two sources (`ldc.co.uk`, `foodanddrinktechnology.com`) are both unrecognised hosts, so tier 4 and the same cap that previously caught deVOL |

Both moves have the same cause: **source-registry coverage, not research
quality**. deVOL rose because we could finally prove a domain was its own;
Bramble fell because two legitimate publishers are not in the registry. This is
the weakness flagged in the v1 report, now demonstrated in both directions.

### Identity collisions found

| Company | v1 collision | v2 |
|---|---|---|
| Bramble Group | "Bramble Group export growth…" → **Brambles Ltd**, CHEP pallets, Australia | Query fixed; the source is retained in the corpus deliberately and **rejected by the gate** as `identity_collision` |
| NMS International Group | "NMS International Group export growth…" → **NMS Industries**, Chinese mining equipment | Gone. Query now returns only the Market Harborough company |
| Slack & Parr | "Slack & Parr export growth…" → **academic papers on organisational slack** | Gone. Query returns only the Kegworth company |

Both fixes verified by re-running the affected queries live, not asserted.

### False positives prevented

1. **Brambles Ltd → Bramble Group.** A 60-country pallet-pooling business would
   have been read as a Market Harborough food manufacturer's overseas
   expansion. Caught twice over: at the query stage, and by the gate when
   deliberately re-fed.
2. **NMS Industries → NMS International Group.** A CNY 149m Uzbekistan mining
   contract would have become a Leicestershire infrastructure firm's export win.
3. **Slack & Parr sold on a growth premise.** The only current signal is a
   redundancy consultation driven by falling Far East demand and tariffs.
   Approaching them about export growth would have been actively embarrassing.
   Now classified `demand_reducing` / not actionable — recorded, not discarded.

### New opportunities discovered

- **deVOL Kitchens** re-enters at 70, on the strongest evidence in the run
  (two first-party sources): new markets in Thailand, China and Denmark, 31% of
  sales exported, overseas revenue up 2,300% over six years.
- **Baltex** carries the Boeing approval and US market entry found in v1, plus
  the detail that exports are already 60% of the business with agents in four
  territories — which sharpens the pitch to the genuinely new US aerospace lane.
- **Bramble's acquisition history** (Whitakers January 2025, The Bay Tree
  January 2024) surfaced for the first time. Both are outside the 12-month
  window, so they inform the hypothesis without becoming the trigger.

### Domain aliases discovered

One: `devolkitchens.co.uk` ↔ `devolkitchens.com`, verified `first_party_link` —
both domains appeared in the same result set carrying the same brand, Cotes Mill
address and product range. Evidence, source URL and method are stored with it.

### Unresolved identity cases

None in v2. Every source was either attributed to its target or rejected with a
reason. The NMS and Winbro rejections are `no_trigger_found` — researched, with
the queries recorded, and genuinely nothing current — not identity failures.

---

## Remaining architectural weaknesses

1. **Source classification is the binding constraint on score.** Bramble at 50
   proves it: good research, unrecognised publishers, aggregator cap. The
   conservative unknown-host default is right; the registry is too small and
   needs growing from evidence.
2. **Verification still caps everything at 70.** Page fetching is blocked, so
   no row can exceed 70 or reach High confidence regardless of quality.
3. **Attribution quality depends on the extractor.** The gate is only as good as
   what the extractor reads out of each source. A lazy extractor that omits
   `statedGeography` degrades every verdict to "unresolved" — safe, but it
   silently loses real signals.
4. **Geography conflict is coarse.** Country and town only. A company with sites
   in two countries could trip a false collision; today that risk is carried by
   the alias/fingerprint being complete.
5. **Polarity is declared, not derived.** The extractor asserts whether a change
   increases or reduces demand. That is a judgement the engine cannot yet check.
