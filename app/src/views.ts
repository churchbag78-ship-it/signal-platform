/**
 * Server-rendered HTML.
 *
 * No framework, no build step, no client-side state. The product is forms and
 * documents: a salesperson types what they know, presses a button, and reads
 * what came back. React would add a toolchain and a bundle to render a form.
 *
 * The rule the markup follows: never show a number without showing what it is
 * made of. A score with no visible components is a number to be trusted or
 * ignored, and both are wrong. Every verdict here can be opened.
 */

import type { Opportunity } from '../../engine/src/pipeline.ts';
import type { ResearchSignal } from '../../engine/src/research/types.ts';
import type { Assessment } from './analyse.ts';
import type { StoreData, StoredClient, StoredEvidence, StoredTarget } from './store.ts';
import { evidenceFor, latestAssessment, targetsFor } from './store.ts';

export function escape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
:root {
  --ink: #16181d; --muted: #5d6470; --line: #dfe3ea; --bg: #f7f8fa;
  --panel: #ffffff; --accent: #1b4dd8; --good: #0f7a4a; --warn: #a3630b;
  --bad: #a51f2b;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
main { max-width: 900px; margin: 0 auto; padding: 24px 16px 80px; }
header.bar { border-bottom: 1px solid var(--line); background: var(--panel); }
header.bar div { max-width: 900px; margin: 0 auto; padding: 14px 16px; display: flex; gap: 16px; align-items: baseline; }
header.bar strong { font-size: 18px; letter-spacing: -0.01em; }
header.bar span { color: var(--muted); font-size: 13px; }
a { color: var(--accent); }
h1 { font-size: 24px; margin: 24px 0 4px; letter-spacing: -0.02em; }
h2 { font-size: 18px; margin: 28px 0 8px; }
h3 { font-size: 15px; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
p.lede { color: var(--muted); margin: 0 0 8px; }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin: 12px 0; }
.row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
ul.list { list-style: none; padding: 0; margin: 0; }
ul.list li { border-bottom: 1px solid var(--line); padding: 10px 0; }
ul.list li:last-child { border-bottom: 0; }
label { display: block; font-size: 13px; color: var(--muted); margin: 10px 0 3px; }
input[type=text], textarea, select {
  width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px;
  font: inherit; background: #fff; color: var(--ink);
}
textarea { min-height: 90px; resize: vertical; }
button {
  font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--accent);
  background: var(--accent); color: #fff; cursor: pointer; margin-top: 12px;
}
button.secondary { background: transparent; color: var(--muted); border-color: var(--line); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.tag { display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); }
.tag.good { color: var(--good); border-color: var(--good); }
.tag.warn { color: var(--warn); border-color: var(--warn); }
.tag.bad { color: var(--bad); border-color: var(--bad); }
.fact { border-left: 3px solid var(--line); padding: 4px 0 4px 12px; margin: 10px 0; }
.fact .src { font-size: 13px; color: var(--muted); }
.kv { display: grid; grid-template-columns: 180px 1fr; gap: 4px 14px; font-size: 14px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; }
.empty { color: var(--muted); font-style: italic; }
.warnbox { border-left: 3px solid var(--warn); background: #fff8ec; padding: 10px 12px; border-radius: 0 6px 6px 0; margin: 10px 0; }
.badbox { border-left: 3px solid var(--bad); background: #fff1f2; padding: 10px 12px; border-radius: 0 6px 6px 0; margin: 10px 0; }
code { font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: #f0f2f6; padding: 1px 5px; border-radius: 4px; }
@media (max-width: 640px) { .kv { grid-template-columns: 1fr; } }
`;

export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — Signal</title>
<style>${CSS}</style>
</head><body>
<header class="bar"><div><strong><a href="/" style="color:inherit;text-decoration:none">Signal</a></strong>
<span>evidence in, commercial assessment out</span></div></header>
<main>${body}</main>
</body></html>`;
}

// --- pages -----------------------------------------------------------------

export function clientsPage(data: StoreData): string {
  const list = data.clients.length
    ? `<ul class="list">${data.clients
        .map(
          (client) => `<li class="row">
        <span><a href="/client/${escape(client.id)}">${escape(client.profile.name)}</a>
        <span class="tag">${escape(targetsFor(data, client.id).length)} companies</span></span>
        <span class="tag">${escape(client.profile.domain)}</span></li>`,
        )
        .join('')}</ul>`
    : '<p class="empty">No client yet. A client is whoever is selling — their offer defines what counts as a signal.</p>';

  return layout(
    'Clients',
    `<h1>Clients</h1>
<p class="lede">Step 1. Signal assesses a change at one company <em>for one seller</em>. The same news is an opportunity for one and nothing for another, so the client comes first.</p>
<div class="panel">${list}</div>
<div class="panel">
<h2>Add a client</h2>
<form method="post" action="/clients">
  <label for="name">Name</label><input type="text" id="name" name="name" required>
  <label for="domain">Domain</label><input type="text" id="domain" name="domain" placeholder="example.co.uk" required>
  <label for="offerings">What they sell — one per line</label><textarea id="offerings" name="offerings" required></textarea>
  <label for="demandTriggers">Changes at a customer that create demand for them — one per line</label><textarea id="demandTriggers" name="demandTriggers" required></textarea>
  <label for="buyerFunctions">Which function buys this — one per line</label><textarea id="buyerFunctions" name="buyerFunctions"></textarea>
  <label for="disqualifiers">Who they cannot sell to — one per line</label><textarea id="disqualifiers" name="disqualifiers"></textarea>
  <button type="submit">Add client</button>
</form>
</div>`,
  );
}

export function clientPage(data: StoreData, client: StoredClient): string {
  const targets = targetsFor(data, client.id);

  const rows = targets.length
    ? `<table><thead><tr><th>Company</th><th>Evidence</th><th>Last verdict</th></tr></thead><tbody>
${targets
  .map((target) => {
    const last = latestAssessment(data, target.id);
    return `<tr>
  <td><a href="/target/${escape(target.id)}">${escape(target.fingerprint.canonicalName)}</a><br>
      <span class="tag">${escape(target.fingerprint.canonicalDomain)}</span></td>
  <td>${escape(evidenceFor(data, target.id).length)}</td>
  <td>${last ? verdictTag(last.assessment) : '<span class="empty">not assessed</span>'}</td>
</tr>`;
  })
  .join('')}
</tbody></table>`
    : '<p class="empty">No companies yet.</p>';

  return layout(
    client.profile.name,
    `<h1>${escape(client.profile.name)}</h1>
<p class="lede">Step 2. Add the companies to assess. Identity is a fingerprint, not a name: the name alone collides with same-named businesses, and a source about the wrong company is the failure that matters most.</p>
<div class="panel">
<h3>Signal model</h3>
<dl class="kv">
  <dt>Sells</dt><dd>${escape(client.profile.offerings.join('; '))}</dd>
  <dt>Demand triggers</dt><dd>${escape(client.profile.demandTriggers.join('; '))}</dd>
  <dt>Cannot sell to</dt><dd>${escape(client.profile.disqualifiers.join('; ')) || '<span class="empty">none recorded</span>'}</dd>
</dl>
</div>
<div class="panel">${rows}</div>
<div class="panel">
<h2>Add a company</h2>
<form method="post" action="/targets">
  <input type="hidden" name="clientId" value="${escape(client.id)}">
  <label for="canonicalName">Registered or trading name</label><input type="text" id="canonicalName" name="canonicalName" required>
  <label for="canonicalDomain">Domain</label><input type="text" id="canonicalDomain" name="canonicalDomain" required>
  <label for="town">Town</label><input type="text" id="town" name="town">
  <label for="region">Region</label><input type="text" id="region" name="region">
  <label for="country">Country</label><input type="text" id="country" name="country">
  <label for="industry">Industry</label><input type="text" id="industry" name="industry">
  <label for="descriptors">Distinguishing words — one per line (e.g. "technical textiles")</label><textarea id="descriptors" name="descriptors"></textarea>
  <label for="companyNumber">Company number</label><input type="text" id="companyNumber" name="companyNumber">
  <button type="submit">Add company</button>
</form>
</div>`,
  );
}

export function targetPage(
  data: StoreData,
  client: StoredClient,
  target: StoredTarget,
  evidence: StoredEvidence[],
): string {
  const last = latestAssessment(data, target.id);

  const items = evidence.length
    ? `<ul class="list">${evidence
        .map(
          (item) => `<li>
    <div class="row"><strong>${escape(item.title)}</strong>
      <form method="post" action="/evidence/${escape(item.id)}/delete" style="margin:0">
        <button class="secondary" type="submit" style="margin:0;padding:2px 8px;font-size:12px">remove</button>
      </form></div>
    <div class="fact src"><a href="${escape(item.url)}" rel="noreferrer noopener">${escape(item.url)}</a>
      — ${item.text.trim() ? `${escape(item.text.trim().length)} characters of page text` : '<span class="tag warn">snippet only</span>'}
      ${item.publishedAt ? `<span class="tag">published ${escape(item.publishedAt)}</span>` : '<span class="tag warn">no publication date</span>'}
    </div>
  </li>`,
        )
        .join('')}</ul>`
    : '<p class="empty">No evidence yet. Nothing can be assessed without a source — that is the point of the system, not a limitation of it.</p>';

  const assessed = last
    ? `<div class="panel">${assessmentSummary(last.assessment)}
<p><a href="/assessment/${escape(last.id)}">Read the full assessment →</a></p></div>`
    : '';

  return layout(
    target.fingerprint.canonicalName,
    `<h1>${escape(target.fingerprint.canonicalName)}</h1>
<p class="lede">for <a href="/client/${escape(client.id)}">${escape(client.profile.name)}</a> — <span class="tag">${escape(target.fingerprint.canonicalDomain)}</span></p>
${assessed}
<div class="panel">
<h2>Evidence</h2>
<p class="lede">Step 3. Paste what you found. Where you paste the page text, every claim's supporting passage is checked against it — a claim whose passage is not in the page does not earn page-level verification, and is recorded as failing.</p>
${items}
</div>
<div class="panel">
<h2>Add evidence</h2>
<form method="post" action="/evidence">
  <input type="hidden" name="targetId" value="${escape(target.id)}">
  <label for="url">Source URL</label><input type="text" id="url" name="url" placeholder="https://…" required>
  <label for="title">Headline or page title</label><input type="text" id="title" name="title" required>
  <label for="publishedAt">Publication date (YYYY-MM-DD), if the source states one</label><input type="text" id="publishedAt" name="publishedAt" placeholder="leave blank if the source does not say">
  <label for="text">Page text — paste the body. Leave blank to supply only a snippet.</label><textarea id="text" name="text" style="min-height:180px"></textarea>
  <label for="snippet">Snippet (used when no page text is pasted)</label><textarea id="snippet" name="snippet"></textarea>
  <label for="providedBy">Supplied by</label><input type="text" id="providedBy" name="providedBy" required>
  <button type="submit">Add evidence</button>
</form>
</div>
<div class="panel">
<h2>Assess</h2>
<p class="lede">Step 4. Two model calls — read the sources, then reason about them — with the identity gate between them and the scoring after. ${evidence.length === 0 ? '<strong>Add evidence first.</strong>' : ''}</p>
<form method="post" action="/assess">
  <input type="hidden" name="targetId" value="${escape(target.id)}">
  <button type="submit"${evidence.length === 0 ? ' disabled' : ''}>Run assessment</button>
</form>
</div>`,
  );
}

function verdictTag(assessment: Assessment): string {
  if (assessment.status === 'opportunity') {
    const quadrant = assessment.opportunity.axes?.quadrant ?? 'scored';
    const good = quadrant === 'ACT_NOW';
    return `<span class="tag ${good ? 'good' : 'warn'}">${escape(quadrant)}</span>`;
  }
  if (assessment.status === 'rejected') {
    return `<span class="tag">${escape(assessment.stage)}</span>`;
  }
  return `<span class="tag bad">run failed</span>`;
}

function assessmentSummary(assessment: Assessment): string {
  if (assessment.status === 'failed') {
    return `<div class="badbox"><strong>The run could not be completed.</strong>
<p>${escape(assessment.reason)}</p>
<p>This is a failure of the <code>${escape(assessment.step)}</code> step. It says nothing about ${escape(assessment.company.name)} — no verdict has been reached, and none should be inferred.</p></div>`;
  }
  if (assessment.status === 'rejected') {
    return `<div class="warnbox"><strong>No opportunity: ${escape(assessment.stage)}</strong>
<p>${escape(assessment.reason)}</p>
<p class="lede">${escape(REJECTION_MEANING[assessment.stage] ?? 'The engine reached a negative verdict at this stage.')}</p></div>`;
  }

  const { opportunity } = assessment;
  const axes = opportunity.axes;
  return `<div class="row"><strong>${escape(opportunity.signal.type)}</strong>
  ${axes ? `<span class="tag ${axes.quadrant === 'ACT_NOW' ? 'good' : 'warn'}">${escape(axes.quadrant)}</span>` : ''}</div>
<p>${escape(opportunity.signal.description)}</p>
<dl class="kv">
  <dt>Recommended action</dt><dd>${escape(opportunity.recommendedAction.action.replace(/_/g, ' '))} — ${escape(opportunity.recommendedAction.rationale)}</dd>
  ${axes ? `<dt>Evidence / value</dt><dd>${escape(axes.evidence.score)} / ${escape(axes.value.score)}</dd>` : ''}
  <dt>Confidence</dt><dd>${escape(opportunity.score.confidence)}</dd>
</dl>`;
}

const REJECTION_MEANING: Record<string, string> = {
  no_trigger_found: 'The sources were read and no commercial change was found in them. That is a result, not an error.',
  insufficient_evidence: 'A change was found but the evidence behind it is too thin to act on.',
  identity_unresolved: 'The sources could not be confidently tied to this company. More evidence, or better identifying detail on the company, would resolve it.',
  identity_collision: 'The sources describe a different company with a similar name.',
  icp: 'This company is not the kind of customer this client can sell to.',
  no_commercial_consequence: 'The change is real and current, and creates nothing this client can act on.',
  stale: 'The change is real but too old to open a conversation with.',
  contradiction: 'The evidence contradicts itself in a way that makes the signal unsafe to act on.',
  invalid_chain: 'The reasoning did not hold together and was rejected rather than reported.',
  invalid_claims: 'Every extracted claim failed validation — most often a claim with no supporting passage.',
  research_failure: 'The research could not be performed. This is a coverage failure, NOT a finding about the company.',
  scoring: 'The signal held, but neither evidence nor commercial value cleared the reporting floor.',
  freshness: 'The change is real but too old to open a conversation with.',
  dedupe: 'This was already reported in an earlier run.',
};

export function assessmentPage(assessment: Assessment, backHref: string): string {
  if (assessment.status !== 'opportunity') {
    return layout(
      assessment.company.name,
      `<h1>${escape(assessment.company.name)}</h1>
<p class="lede">assessed ${escape(assessment.runDate)} — <a href="${escape(backHref)}">back</a></p>
<div class="panel">${assessmentSummary(assessment)}</div>
${assessment.status === 'rejected' ? rejectionDetail(assessment) : ''}
<div class="panel"><h3>Evidence supplied</h3>${evidenceSummaryBlock(assessment)}</div>`,
    );
  }

  const { opportunity, signal } = assessment;

  return layout(
    assessment.company.name,
    `<h1>${escape(assessment.company.name)}</h1>
<p class="lede">assessed ${escape(assessment.runDate)} — <a href="${escape(backHref)}">back</a></p>

<div class="panel">
<h3>What changed</h3>
<p>${escape(signal.whatChanged)}</p>
<dl class="kv">
  <dt>Signal type</dt><dd>${escape(signal.trigger)}</dd>
  <dt>Date of the change</dt><dd>${signal.eventDate ? escape(signal.eventDate) : '<span class="tag warn">no source dates the change itself</span>'}</dd>
  <dt>Direction</dt><dd>${escape(signal.polarity.replace(/_/g, ' '))}${
    signal.polarity !== signal.declaredPolarity
      ? ` <span class="tag warn">model said ${escape(signal.declaredPolarity.replace(/_/g, ' '))}</span>`
      : ''
  }</dd>
  <dt>Whose problem this is</dt><dd>${escape(signal.owningFunction.function)} — ${escape(signal.owningFunction.rationale)}</dd>
</dl>
</div>

<div class="panel">
<h3>Why now</h3><p>${escape(signal.whyNow)}</p>
<h3>How to open it</h3><p>${escape(signal.salesAngle)}</p>
<h3>What is unproven</h3>
<p>${escape(signal.hypothesis.statement)}</p>
<p class="lede">Settle it by asking: ${escape(signal.hypothesis.testableBy)}</p>
</div>

${contradictionsBlock(signal)}

<div class="panel">
<h3>The evidence</h3>
${factsBlock(signal)}
</div>

<div class="panel">
<h3>The reasoning</h3>
<p class="lede">These are inferences, not facts. They are what the evidence implies, and they are where a mistake would be.</p>
${signal.claims
  .filter((claim) => claim.kind === 'inference')
  .map((claim) => `<div class="fact"><p>${escape(claim.statement)}</p>
  <p class="src">from ${escape(claim.derivedFrom.join(', '))} — ${escape(claim.reasoning)}</p></div>`)
  .join('') || '<p class="empty">none</p>'}
</div>

${scoreBlock(opportunity)}

<div class="panel"><h3>What this run looked at</h3>${coverageBlock(assessment)}</div>
<div class="panel"><h3>Evidence supplied</h3>${evidenceSummaryBlock(assessment)}</div>`,
  );
}

function rejectionDetail(assessment: Extract<Assessment, { status: 'rejected' }>): string {
  const errors = assessment.errors?.length
    ? `<h3>What failed</h3><ul class="list">${assessment.errors.map((e) => `<li>${escape(e)}</li>`).join('')}</ul>`
    : '';
  const identity = assessment.identityRejections?.length
    ? `<h3>Sources rejected on identity</h3><table><thead><tr><th>Source</th><th>Verdict</th><th>Why</th></tr></thead><tbody>
${assessment.identityRejections
  .map((r) => `<tr><td>${escape(r.url)}</td><td>${escape(r.status)}</td><td>${escape(r.explanation)}</td></tr>`)
  .join('')}</tbody></table>`
    : '';
  return errors || identity ? `<div class="panel">${errors}${identity}</div>` : '';
}

function contradictionsBlock(signal: ResearchSignal): string {
  const all = [
    ...signal.contradictions.map((c) => ({ severity: c.severity, note: c.note })),
    ...signal.polarityWarnings.map((note) => ({ severity: 'caveat' as const, note })),
    ...signal.verifications
      .filter((v) => v.failure)
      .map((v) => ({ severity: 'caveat' as const, note: `${v.url}: ${v.failure}` })),
  ];
  if (all.length === 0) {
    return '<div class="panel"><h3>Caveats</h3><p class="empty">none recorded</p></div>';
  }
  return `<div class="panel"><h3>Caveats — read these before calling</h3>
${all
  .map(
    (c) =>
      `<div class="${c.severity === 'caveat' ? 'warnbox' : 'badbox'}"><span class="tag ${
        c.severity === 'caveat' ? 'warn' : 'bad'
      }">${escape(c.severity)}</span> ${escape(c.note)}</div>`,
  )
  .join('')}</div>`;
}

function factsBlock(signal: ResearchSignal): string {
  if (signal.facts.length === 0) return '<p class="empty">none</p>';
  return signal.facts
    .map((fact) => {
      const verification = signal.verifications.find((v) => v.url === fact.source.url);
      return `<div class="fact">
  <p>${escape(fact.statement)}</p>
  <p class="src"><a href="${escape(fact.source.url)}" rel="noreferrer noopener">${escape(fact.source.publisher)}</a>
  <span class="tag">tier ${escape(fact.source.tier)}</span>
  <span class="tag ${fact.verification === 'page_retrieved' ? 'good' : 'warn'}">${escape(
    fact.verification.replace(/_/g, ' '),
  )}</span>
  ${fact.eventDate ? `<span class="tag">dates ${escape(fact.dateBasis ?? 'change_occurred')} ${escape(fact.eventDate)}</span>` : '<span class="tag warn">undated</span>'}
  ${verification?.passage ? `<span class="tag">passage ${escape(Math.round(verification.passage.overlap * 100))}% matched</span>` : ''}
  </p>
</div>`;
    })
    .join('');
}

function scoreBlock(opportunity: Opportunity): string {
  const axes = opportunity.axes;
  if (!axes) return '';
  const line = (label: string, value: number, max: number) =>
    `<tr><td>${escape(label)}</td><td>${escape(value)} / ${escape(max)}</td></tr>`;

  return `<div class="panel">
<h3>How it scored</h3>
<p class="lede">Evidence and commercial value are scored separately, because a well-evidenced change that is worth nothing and a valuable change that is barely sourced are different problems with different next steps.</p>
<div class="row" style="align-items:flex-start;gap:24px">
<div style="flex:1">
<strong>Evidence ${escape(axes.evidence.score)}</strong>
<table><tbody>
${line('Source authority', axes.evidence.components.sourceAuthority, 40)}
${line('Independence', axes.evidence.components.independence, 25)}
${line('Verification', axes.evidence.components.verification, 20)}
${line('Dating', axes.evidence.components.dating, 15)}
</tbody></table>
</div>
<div style="flex:1">
<strong>Commercial value ${escape(axes.value.score)}</strong>
<table><tbody>
${line('ICP fit', axes.value.components.icpFit, 25)}
${line('Signal strength', axes.value.components.signalStrength, 20)}
${line('Commercial relevance', axes.value.components.commercialRelevance, 15)}
${line('Demand direction', axes.value.components.demandDirection, 15)}
${line('Timing', axes.value.components.timing, 15)}
${line('Buyer identified', axes.value.components.buyerIdentified, 10)}
</tbody></table>
</div>
</div>
${
  axes.evidence.appliedCaps.length > 0
    ? `<h3>Caps applied to the evidence score</h3><ul class="list">${axes.evidence.appliedCaps
        .map((cap) => `<li>capped at ${escape(cap.cap)} — ${escape(cap.reason)}</li>`)
        .join('')}</ul>`
    : ''
}${
  axes.value.penalties.length > 0
    ? `<h3>Penalties on the commercial score</h3><ul class="list">${axes.value.penalties
        .map((p) => `<li>−${escape(p.points)} — ${escape(p.reason)}</li>`)
        .join('')}</ul>`
    : ''
}
</div>`;
}

function coverageBlock(assessment: Assessment): string {
  if (assessment.status === 'failed' || !assessment.coverage) {
    return '<p class="empty">no coverage recorded</p>';
  }
  const c = assessment.coverage;
  return `<dl class="kv">
  <dt>Queries planned and run</dt><dd>${escape(c.queriesRun.length)}</dd>
  <dt>Change families checked</dt><dd>${escape(c.familiesChecked.join(', ')) || '<span class="empty">none</span>'}</dd>
  <dt>First-party sections swept</dt><dd>${
    c.firstPartySectionsCovered.length
      ? escape(c.firstPartySectionsCovered.join(', '))
      : '<span class="tag warn">none — the company’s own site was not retrievable from here</span>'
  }</dd>
  <dt>Sections unchecked</dt><dd>${escape(c.firstPartySectionsUnchecked.join(', ')) || 'none'}</dd>
  <dt>Sources seen</dt><dd>${escape(c.sourcesSeen)}</dd>
</dl>
<p class="lede">Coverage is reported separately from findings on purpose. "We did not look" and "we looked and found nothing" are different statements, and only one of them is evidence.</p>`;
}

function evidenceSummaryBlock(assessment: Assessment): string {
  const e = assessment.evidenceSupplied;
  return `<dl class="kv">
  <dt>Items supplied</dt><dd>${escape(e.items)}</dd>
  <dt>With page text</dt><dd>${escape(e.withBody)} — only these can have their passages checked</dd>
  <dt>From the company itself</dt><dd>${escape(e.firstParty)}</dd>
</dl>
<ul class="list">${e.urls.map((url) => `<li class="src"><code>${escape(url)}</code></li>`).join('')}</ul>
${
  assessment.trace
    ? `<h3>Model steps</h3><dl class="kv">
  <dt>Claims extracted</dt><dd>${escape(assessment.trace.claimsExtracted)}${
    assessment.trace.claimsDiscarded ? ` (${escape(assessment.trace.claimsDiscarded)} discarded as malformed)` : ''
  }</dd>
  <dt>Blocked by the identity gate</dt><dd>${escape(assessment.trace.claimsGated)}</dd>
  <dt>Facts the reasoning saw</dt><dd>${escape(assessment.trace.factsReasonedOver)}</dd>
  ${assessment.trace.reasoningSkipped ? `<dt>Reasoning skipped</dt><dd>${escape(assessment.trace.reasoningSkipped)}</dd>` : ''}
  ${
    assessment.trace.grounding
      ? `<dt>Ungrounded specifics</dt><dd>${
          assessment.trace.grounding.findings.length === 0
            ? '<span class="tag good">none — every name, figure and date in the write-up appears in a source</span>'
            : assessment.trace.grounding.findings
                .map((f) => `<span class="tag bad">${escape(f.specific)} (${escape(f.field)})</span>`)
                .join(' ')
        }</dd>`
      : ''
  }
</dl>`
    : ''
}`;
}
