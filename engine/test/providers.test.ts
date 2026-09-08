import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ContactResult } from '../src/domain.ts';
import {
  CostLedger,
  isFree,
  requiresApproval,
  route,
  type ProviderOperation,
} from '../src/providers/registry.ts';
import {
  enrichContacts,
  NullContactProvider,
  type ContactProvider,
  type EnrichmentTarget,
} from '../src/providers/contacts.ts';

// Modelled on the real Apollo surface recorded in docs/PROVIDER_NOTES.md:
// one provider spanning free, paid and plan-gated operations.
const registry: ProviderOperation[] = [
  {
    providerId: 'apollo',
    operation: 'apollo.organizations_lookup',
    dataType: 'company_identity',
    cost: { credits: 0 },
    availability: 'available',
    confidence: 0.7,
  },
  {
    providerId: 'apollo',
    operation: 'apollo.organizations_enrich',
    dataType: 'company_firmographics',
    cost: { credits: 1 },
    availability: 'available',
    confidence: 0.85,
  },
  {
    providerId: 'apollo',
    operation: 'apollo.people_search',
    dataType: 'contacts',
    cost: { credits: 1 },
    availability: 'plan_gated',
    confidence: 0.8,
  },
  {
    providerId: 'companies_house',
    operation: 'companies_house.search',
    dataType: 'company_identity',
    cost: { credits: 0 },
    availability: 'blocked',
    confidence: 0.99,
  },
];

test('cost and availability are per operation, not per provider', () => {
  const apollo = registry.filter((o) => o.providerId === 'apollo');

  assert.equal(isFree(apollo[0]!), true);
  assert.equal(isFree(apollo[1]!), false);
  assert.equal(apollo[2]!.availability, 'plan_gated');
});

test('routing prefers a free available operation', () => {
  const decision = route(registry, { dataType: 'company_identity' });

  assert.equal(decision.operation?.operation, 'apollo.organizations_lookup');
  assert.match(decision.reason, /free operation/);
});

test('unavailable operations are rejected with an auditable reason', () => {
  const decision = route(registry, { dataType: 'company_identity' });
  const blocked = decision.rejected.find(
    (r) => r.operation.operation === 'companies_house.search',
  );

  assert.equal(blocked?.reason, 'availability: blocked');
});

test('a paid operation is not selected without budget', () => {
  const decision = route(registry, { dataType: 'company_firmographics' });

  assert.equal(decision.operation, null);
  assert.match(decision.reason, /no available operation/);
});

test('a paid operation is selected once budget is granted', () => {
  const decision = route(registry, { dataType: 'company_firmographics', maxCredits: 1 });

  assert.equal(decision.operation?.operation, 'apollo.organizations_enrich');
  assert.equal(requiresApproval(decision.operation!), true);
});

test('a plan-gated contacts operation never routes', () => {
  const decision = route(registry, { dataType: 'contacts', maxCredits: 5 });

  assert.equal(decision.operation, null);
});

test('a confidence floor filters operations that are too unreliable', () => {
  const decision = route(registry, { dataType: 'company_identity', minConfidence: 0.9 });

  assert.equal(decision.operation, null);
});

test('the null contact provider is available, free, and attempts nothing', async () => {
  const provider = new NullContactProvider();
  const result = await provider.find();

  assert.equal(result.status, 'not_attempted');
  assert.equal(isFree(provider.describe()), true);
});

const targets: EnrichmentTarget[] = [
  { company: { name: 'High', domain: 'high.com' }, score: 88, role: { function: 'Operations', rationale: 'r' } },
  { company: { name: 'Low', domain: 'low.com' }, score: 61, role: { function: 'Operations', rationale: 'r' } },
];

test('enrichment is withheld from opportunities that have not earned it', async () => {
  const outcomes = await enrichContacts(targets, new NullContactProvider(), {
    minScore: 75,
    creditBudget: 10,
    approvedForSpend: true,
  });

  assert.equal(outcomes[1]?.result.status, 'not_attempted');
  assert.match(outcomes[1]!.reason, /below enrichment threshold/);
});

class StubContactProvider implements ContactProvider {
  readonly id = 'stub';
  calls = 0;

  describe(): ProviderOperation {
    return {
      providerId: this.id,
      operation: 'stub.contacts',
      dataType: 'contacts',
      cost: { credits: 1 },
      availability: 'available',
      confidence: 0.8,
    };
  }

  async find(): Promise<ContactResult> {
    this.calls += 1;
    return { status: 'found', name: 'A Person', title: 'Operations Director' };
  }
}

test('a paid provider is not called until spend is explicitly approved', async () => {
  const provider = new StubContactProvider();

  const withheld = await enrichContacts(targets, provider, {
    minScore: 75,
    creditBudget: 10,
    approvedForSpend: false,
  });

  assert.equal(provider.calls, 0);
  assert.match(withheld[0]!.reason, /spend is not approved/);

  const approved = await enrichContacts(targets, provider, {
    minScore: 75,
    creditBudget: 10,
    approvedForSpend: true,
  });

  assert.equal(provider.calls, 1);
  assert.equal(approved[0]?.result.status, 'found');
});

test('enrichment stops at the credit budget', async () => {
  const provider = new StubContactProvider();
  const many: EnrichmentTarget[] = [
    { company: { name: 'A', domain: 'a.com' }, score: 90, role: { function: 'Ops', rationale: 'r' } },
    { company: { name: 'B', domain: 'b.com' }, score: 89, role: { function: 'Ops', rationale: 'r' } },
    { company: { name: 'C', domain: 'c.com' }, score: 88, role: { function: 'Ops', rationale: 'r' } },
  ];

  const outcomes = await enrichContacts(many, provider, {
    minScore: 75,
    creditBudget: 2,
    approvedForSpend: true,
  });

  assert.equal(provider.calls, 2);
  assert.match(outcomes[2]!.reason, /budget .* exhausted/);
});

test('a failing provider degrades to not_available and does not throw', async () => {
  const broken: ContactProvider = {
    id: 'broken',
    describe: () => ({
      providerId: 'broken',
      operation: 'broken.contacts',
      dataType: 'contacts',
      cost: { credits: 0 },
      availability: 'available',
      confidence: 0.5,
    }),
    find: async () => {
      throw new Error('provider outage');
    },
  };

  const outcomes = await enrichContacts([targets[0]!], broken, {
    minScore: 75,
    creditBudget: 1,
    approvedForSpend: true,
  });

  assert.equal(outcomes[0]?.result.status, 'not_available');
});

test('the cost ledger reports spend per operation and per opportunity', async () => {
  const ledger = new CostLedger();
  const provider = new StubContactProvider();

  await enrichContacts(
    targets,
    provider,
    { minScore: 75, creditBudget: 5, approvedForSpend: true },
    ledger,
  );

  assert.equal(ledger.totalCredits(), 1);
  assert.equal(ledger.usefulCredits(), 1);
  assert.equal(ledger.byOperation()['stub.contacts'], 1);
  assert.equal(ledger.costPerOpportunity(2), 0.5);
  assert.equal(ledger.costPerOpportunity(0), null);
});
