import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CostLedger,
  isFree,
  requiresApproval,
  route,
  type ProviderOperation,
} from '../src/providers/registry.ts';

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
