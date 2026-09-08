/**
 * Claim chain validation.
 *
 * A commercial hypothesis is only worth anything if you can walk it back to a
 * fact somebody published. This module enforces that walk: every inference
 * names what it was concluded from, every chain terminates in sourced facts,
 * and the number of reasoning hops is measured rather than asserted — because
 * "they're expanding, so they'll need X, so they'll want Y" is where research
 * quietly turns into wishful thinking.
 */

import type { Claim, Fact, Hypothesis, Inference } from './domain.ts';

export interface ChainValidation {
  valid: boolean;
  errors: string[];
  /**
   * Reasoning hops from the furthest fact to the hypothesis. A fact is 0, a
   * conclusion drawn directly from facts is 1. Feeds the scoring penalty, so
   * a longer chain costs points automatically.
   */
  depth: number;
  factCount: number;
}

export function isFact(claim: Claim): claim is Fact {
  return claim.kind === 'fact';
}

export function isInference(claim: Claim): claim is Inference {
  return claim.kind === 'inference';
}

export function isHypothesis(claim: Claim): claim is Hypothesis {
  return claim.kind === 'hypothesis';
}

/**
 * Depth of a claim, or null when the chain is unresolvable (missing parent or
 * a cycle). Memoised across a single validation pass.
 */
function resolveDepth(
  id: string,
  byId: Map<string, Claim>,
  cache: Map<string, number | null>,
  visiting: Set<string>,
): number | null {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;

  const claim = byId.get(id);
  if (!claim) return null;

  if (isFact(claim)) {
    cache.set(id, 0);
    return 0;
  }

  if (visiting.has(id)) return null; // cycle
  visiting.add(id);

  let deepest = -1;
  for (const parentId of claim.derivedFrom) {
    const parentDepth = resolveDepth(parentId, byId, cache, visiting);
    if (parentDepth === null) {
      visiting.delete(id);
      cache.set(id, null);
      return null;
    }
    deepest = Math.max(deepest, parentDepth);
  }

  visiting.delete(id);
  const depth = deepest + 1;
  cache.set(id, depth);
  return depth;
}

/** Whether any fact appears in this claim's ancestry. */
function isGrounded(id: string, byId: Map<string, Claim>, seen = new Set<string>()): boolean {
  if (seen.has(id)) return false;
  seen.add(id);

  const claim = byId.get(id);
  if (!claim) return false;
  if (isFact(claim)) return true;

  return claim.derivedFrom.some((parentId) => isGrounded(parentId, byId, seen));
}

export function validateChain(claims: Claim[]): ChainValidation {
  const errors: string[] = [];
  const byId = new Map<string, Claim>();

  for (const claim of claims) {
    if (byId.has(claim.id)) {
      errors.push(`duplicate claim id "${claim.id}"`);
      continue;
    }
    byId.set(claim.id, claim);
  }

  const facts = claims.filter(isFact);
  const hypotheses = claims.filter(isHypothesis);

  for (const fact of facts) {
    if (!fact.source?.url) {
      errors.push(`fact "${fact.id}" has no source URL — a fact without a source is an assertion`);
    }
  }

  for (const claim of claims) {
    if (isFact(claim)) continue;

    if (claim.derivedFrom.length === 0) {
      errors.push(`${claim.kind} "${claim.id}" derives from nothing`);
      continue;
    }
    if (claim.derivedFrom.includes(claim.id)) {
      errors.push(`${claim.kind} "${claim.id}" derives from itself`);
    }
    for (const parentId of claim.derivedFrom) {
      if (!byId.has(parentId)) {
        errors.push(`${claim.kind} "${claim.id}" references unknown claim "${parentId}"`);
      }
    }
  }

  if (hypotheses.length === 0) {
    errors.push('chain contains no commercial hypothesis');
  }

  const cache = new Map<string, number | null>();
  let depth = 0;

  for (const claim of claims) {
    if (isFact(claim)) continue;

    const claimDepth = resolveDepth(claim.id, byId, cache, new Set());
    if (claimDepth === null) {
      // Only report once per claim; the unknown-reference error above already
      // covers missing parents.
      if (!errors.some((e) => e.includes(`"${claim.id}"`))) {
        errors.push(`${claim.kind} "${claim.id}" is part of a circular chain`);
      }
      continue;
    }
    depth = Math.max(depth, claimDepth);
  }

  for (const hypothesis of hypotheses) {
    if (!isGrounded(hypothesis.id, byId)) {
      errors.push(
        `hypothesis "${hypothesis.id}" is not grounded in any fact — speculation, not intelligence`,
      );
    }
    if (!hypothesis.testableBy?.trim()) {
      errors.push(`hypothesis "${hypothesis.id}" states no way to test it`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    depth,
    factCount: facts.length,
  };
}

/** The facts a claim ultimately rests on, for rendering "why we believe this". */
export function supportingFacts(claimId: string, claims: Claim[]): Fact[] {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const found = new Map<string, Fact>();
  const seen = new Set<string>();

  const walk = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);

    const claim = byId.get(id);
    if (!claim) return;
    if (isFact(claim)) {
      found.set(claim.id, claim);
      return;
    }
    claim.derivedFrom.forEach(walk);
  };

  walk(claimId);
  return [...found.values()];
}

export function factsToEvidence(facts: Fact[]) {
  return facts.map((fact) => ({
    claim: fact.statement,
    source: fact.source,
    signalDate: fact.eventDate,
    retrievedAt: fact.discoveredAt,
    verification: fact.verification,
  }));
}

export type { Fact, Inference, Hypothesis };
