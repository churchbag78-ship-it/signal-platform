/**
 * Evidence-grounded demand direction.
 *
 * The two-axis milestone attached 15 scoring points to `polarity` — and
 * polarity was a label the extractor supplied, taken on trust. Bramble Group
 * declared `demand_increasing` for a change its own rationale described as
 * closing the storage opportunity, and took full marks for it. Making a label
 * worth points without grounding it is how a scoring model gets gamed by its
 * own upstream.
 *
 * So direction is now DERIVED, not declared. Each claim states how it moves
 * demand for the client's named offerings; the engine aggregates those across
 * the facts that survived the identity gate and decides the direction. The
 * declared polarity becomes a cross-check that raises warnings, exactly as
 * declared identity attributes became a cross-check rather than an assertion.
 *
 * Three rules do the work:
 *
 *  1. An impact naming an offering the client does not sell is IGNORED and
 *    warned about. A change cannot create demand for a service nobody offers.
 *  2. A signal with no grounded impact at all is NEUTRAL, never growth. Saying
 *     nothing about direction is not the same as establishing it.
 *  3. Increases and reductions together are NEUTRAL. A change that helps one
 *     thing you sell and hurts another is not a growth trigger — the benchmark
 *     says as much about consolidation: "cuts both ways".
 */

import type { SignalPolarity } from './domain.ts';
import type { ClientProfile } from './pipeline.ts';
import type { DemandEffect, OfferingImpact } from './research/extraction.ts';

/** Lowercase, punctuation to spaces, collapsed — so profile prose can match. */
export function normaliseOffering(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Matches an extracted offering name against the client's own list.
 *
 * Deliberately permissive in ONE direction only: "warehousing" matches
 * "warehousing, e-commerce fulfilment and FBA prep" because it is a substring
 * of it. It will not match something the client does not list at all, which is
 * the case that matters.
 */
export function matchOffering(named: string, offerings: string[]): string | null {
  const target = normaliseOffering(named);
  if (target.length < 4) return null;

  for (const offering of offerings) {
    const candidate = normaliseOffering(offering);
    if (candidate === target || candidate.includes(target) || target.includes(candidate)) {
      return offering;
    }
  }
  return null;
}

export interface GroundedImpact {
  /** The client offering as the profile names it. */
  offering: string;
  effect: DemandEffect;
  rationale: string;
  /** The claim the impact was extracted from. */
  claimId: string;
}

export interface DirectionAssessment {
  /** The direction the evidence supports. This is what scoring reads. */
  grounded: SignalPolarity;
  /** What the extractor declared, for comparison only. */
  declared: SignalPolarity;
  /** True when the two agree. */
  supported: boolean;
  /** Offerings the evidence says gain, and those it says lose. */
  increases: string[];
  reduces: string[];
  /** Impacts naming something the client does not sell — ignored, not counted. */
  ignored: { offering: string; claimId: string }[];
  grounds: GroundedImpact[];
  warnings: string[];
  rationale: string;
}

export interface ClaimImpacts {
  id: string;
  demandImpacts?: OfferingImpact[];
}

/**
 * Aggregate the per-claim impacts into one direction.
 *
 * Only claims passed in here influence the result, so a source rejected at the
 * identity gate cannot set the direction for a company it does not describe.
 */
export function assessDirection(
  claims: ClaimImpacts[],
  client: ClientProfile,
  declared: SignalPolarity,
): DirectionAssessment {
  const grounds: GroundedImpact[] = [];
  const ignored: { offering: string; claimId: string }[] = [];
  const warnings: string[] = [];

  for (const claim of claims) {
    for (const impact of claim.demandImpacts ?? []) {
      const matched = matchOffering(impact.offering, client.offerings);
      if (!matched) {
        ignored.push({ offering: impact.offering, claimId: claim.id });
        warnings.push(
          `claim "${claim.id}" declares an impact on "${impact.offering}", which ${client.name} ` +
            'does not list as an offering — ignored',
        );
        continue;
      }
      grounds.push({
        offering: matched,
        effect: impact.effect,
        rationale: impact.rationale,
        claimId: claim.id,
      });
    }
  }

  const increases = [...new Set(grounds.filter((g) => g.effect === 'increases').map((g) => g.offering))];
  const reduces = [...new Set(grounds.filter((g) => g.effect === 'reduces').map((g) => g.offering))];

  let grounded: SignalPolarity;
  let rationale: string;

  if (increases.length > 0 && reduces.length === 0) {
    grounded = 'demand_increasing';
    rationale = `the evidence increases demand for ${increases.join(', ')}`;
  } else if (reduces.length > 0 && increases.length === 0) {
    grounded = 'demand_reducing';
    rationale = `the evidence reduces demand for ${reduces.join(', ')}`;
  } else if (increases.length > 0 && reduces.length > 0) {
    grounded = 'neutral';
    rationale =
      `the change increases demand for ${increases.join(', ')} and reduces it for ` +
      `${reduces.join(', ')} — it cuts both ways, so it is not a growth trigger`;
  } else {
    grounded = 'neutral';
    rationale =
      grounds.length > 0
        ? 'every grounded impact is neutral'
        : 'no claim states how this change moves demand for anything the client sells';
    if (grounds.length === 0) {
      warnings.push(
        'direction is not grounded in any claim — scored as neutral, not as growth',
      );
    }
  }

  const supported = grounded === declared;
  if (!supported) {
    warnings.push(
      `declared polarity is ${declared} but the evidence supports ${grounded}: ${rationale}`,
    );
  }

  return {
    grounded,
    declared,
    supported,
    increases,
    reduces,
    ignored,
    grounds,
    warnings,
    rationale,
  };
}
