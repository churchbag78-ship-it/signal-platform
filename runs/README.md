# Runs

One directory per client, one per run:

```
runs/<client-slug>/
  ledger.csv                      # every opportunity ever reported for this client
  <YYYY-MM-DD>/
    inputs.md                     # the filled-in INPUTS block from the master prompt
    report.md                     # the raw run output
    scorecard.md                  # grading against docs/VALIDATION_PROTOCOL.md
```

`ledger.csv` is the duplicate-prevention memory. It is fed back into the
next run's `PREVIOUS RUN LEDGER` input, and matched on **domain**, not
company name. Header:

```csv
run_date,company,domain,signal_type,signal_date,score,confidence,outcome
```

`outcome` stays empty until the client reports back (contacted, meeting,
qualified, won, no response, not a fit). It is the seed of the outcome
loop — filling it in by hand during Phase 0 is what makes the eventual
automated version measurable.

No client data is committed here without the client's agreement; treat
anything under `runs/` as real commercial information about real people
and companies.
