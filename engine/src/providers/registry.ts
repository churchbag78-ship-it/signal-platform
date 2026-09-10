/**
 * Provider abstraction — at OPERATION level, not provider level.
 *
 * The Apollo evaluation (docs/PROVIDER_NOTES.md) settled this: a single
 * provider can span a free operation, a 1-credit operation and an operation
 * gated behind a paid plan. Describing cost and availability per provider
 * cannot express that, so routing rules like "cheap by default, expensive only
 * when justified" become unimplementable.
 */

export type DataType =
  | 'company_identity'
  | 'company_firmographics'
  | 'job_postings'
  | 'news'
  | 'filings'
  | 'web_page'
  | 'contacts';

export type Availability =
  | 'available'
  | 'plan_gated'
  | 'unauthenticated'
  | 'blocked'
  | 'unknown';

export interface OperationCost {
  /** Provider-native credits, where the provider prices in credits. */
  credits?: number;
  /** Cash cost where known, in minor units of `currency`. */
  amount?: number;
  currency?: string;
}

export interface ProviderOperation {
  providerId: string;
  /** Stable identifier, e.g. "apollo.organizations_lookup". */
  operation: string;
  dataType: DataType;
  cost: OperationCost;
  availability: Availability;
  /** Typical reliability of what this operation returns, 0-1. */
  confidence: number;
  notes?: string;
}

export function isFree(op: ProviderOperation): boolean {
  return (op.cost.credits ?? 0) === 0 && (op.cost.amount ?? 0) === 0;
}

/** Any spend needs explicit authorisation — never incurred as a side effect. */
export function requiresApproval(op: ProviderOperation): boolean {
  return !isFree(op);
}

export interface RouteRequest {
  dataType: DataType;
  /** Maximum credits this call may spend. Defaults to 0 — free only. */
  maxCredits?: number;
  /** Minimum acceptable operation confidence, 0-1. */
  minConfidence?: number;
}

export interface RouteDecision {
  operation: ProviderOperation | null;
  /** Why this operation, or why nothing was selected. */
  reason: string;
  /** Operations rejected, with the reason — routing must be auditable. */
  rejected: { operation: ProviderOperation; reason: string }[];
}

/**
 * Selects the cheapest available operation that meets the confidence floor and
 * the cost ceiling. Ties break toward higher confidence.
 */
export function route(
  registry: ProviderOperation[],
  request: RouteRequest,
): RouteDecision {
  const maxCredits = request.maxCredits ?? 0;
  const minConfidence = request.minConfidence ?? 0;
  const rejected: { operation: ProviderOperation; reason: string }[] = [];
  const eligible: ProviderOperation[] = [];

  for (const op of registry) {
    if (op.dataType !== request.dataType) continue;
    if (op.availability !== 'available') {
      rejected.push({ operation: op, reason: `availability: ${op.availability}` });
      continue;
    }
    if ((op.cost.credits ?? 0) > maxCredits) {
      rejected.push({
        operation: op,
        reason: `costs ${op.cost.credits} credits, budget ${maxCredits}`,
      });
      continue;
    }
    if (op.confidence < minConfidence) {
      rejected.push({
        operation: op,
        reason: `confidence ${op.confidence} below floor ${minConfidence}`,
      });
      continue;
    }
    eligible.push(op);
  }

  if (eligible.length === 0) {
    return {
      operation: null,
      reason: `no available operation for ${request.dataType} within budget`,
      rejected,
    };
  }

  eligible.sort((a, b) => {
    const costDiff = (a.cost.credits ?? 0) - (b.cost.credits ?? 0);
    if (costDiff !== 0) return costDiff;
    return b.confidence - a.confidence;
  });

  const chosen = eligible[0]!;
  for (const op of eligible.slice(1)) {
    rejected.push({ operation: op, reason: 'cheaper or equal option preferred' });
  }

  return {
    operation: chosen,
    reason: isFree(chosen)
      ? `free operation ${chosen.operation}`
      : `cheapest within budget: ${chosen.operation} (${chosen.cost.credits} credits)`,
    rejected,
  };
}

export interface SpendRecord {
  operation: string;
  credits: number;
  /** Did this call contribute to an opportunity that was actually reported? */
  useful: boolean;
  companyDomain?: string;
}

/**
 * Cost is a product metric, so it is tracked in the engine rather than left to
 * whatever calls it. Supports cost per researched company, per useful signal
 * and per opportunity.
 */
export class CostLedger {
  readonly records: SpendRecord[] = [];

  record(entry: SpendRecord): void {
    this.records.push(entry);
  }

  totalCredits(): number {
    return this.records.reduce((a, r) => a + r.credits, 0);
  }

  usefulCredits(): number {
    return this.records.filter((r) => r.useful).reduce((a, r) => a + r.credits, 0);
  }

  costPerOpportunity(opportunityCount: number): number | null {
    if (opportunityCount <= 0) return null;
    return this.totalCredits() / opportunityCount;
  }

  byOperation(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.records) {
      out[r.operation] = (out[r.operation] ?? 0) + r.credits;
    }
    return out;
  }
}
