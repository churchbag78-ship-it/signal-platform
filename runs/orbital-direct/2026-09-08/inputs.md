# Pilot A — inputs

```
CLIENT WEBSITE:        https://www.orbital-direct.com
TARGET GEOGRAPHY:      inferred — UK, with a Midlands core
TARGET INDUSTRIES:     inferred from client site
NUMBER REQUESTED:      20
EXCLUDED COMPANIES:    none
EXCLUDED INDUSTRIES:   none
PREVIOUS RUN LEDGER:   none — first run
OTHER REQUIREMENTS:    none
```

## Environment constraints (material — read before the report)

This run was executed inside a sandboxed session whose egress policy
**blocks direct page fetching**. Confirmed blocked: `orbital-direct.com`,
`find-and-update.company-information.service.gov.uk` (Companies House),
and general news domains. Only keyword web search was available, which
returns titles, URLs and a machine-generated summary of the results.

Consequences, carried through the whole run:

1. **The client website was never read.** The ICP and signal model in the
   report are built from third-party descriptions of Orbital Direct
   (directory listings, social profiles, search summaries), not from the
   client's own pages. This is the foundation of the method and it was
   built on secondary sources.
2. **No source page was opened.** Every claim rests on a search-engine
   summary of a page, not the page itself. Dates, figures and quotes
   could not be checked at source.
3. **Companies House was unreachable**, so company identity, size,
   registered address and status could not be confirmed for any candidate.

Every row therefore carries `VERIFICATION: search summary only — source
page not opened`. Nothing in the report should be used commercially
before someone opens the source URLs and confirms it.
