/**
 * Extraction fidelity measurement.
 *
 * Scores what an extractor actually produced against what a careful reader
 * would take from the same sources. Every check RECORDS a failure; nothing
 * here repairs one. A silently corrected extraction is an extraction whose
 * quality you can no longer measure.
 *
 * The categories are the ones that matter commercially: a wrong company, a
 * wrong date or an invented figure all reach the salesperson as confident
 * fact.
 */

import type { ExtractedClaim } from './extraction.ts';
import { validatePolarity, type SignalPolarity } from './extraction.ts';

export type FidelityCategory =
  | 'missing_identity_attributes'
  | 'incorrect_geography'
  | 'incorrect_company_attribution'
  | 'incorrect_date'
  | 'unsupported_polarity'
  | 'polarity_contradiction'
  | 'hallucinated_claim'
  | 'passage_does_not_support_claim'
  | 'topic_misclassification'
  | 'interpretation_not_extraction';

export interface FidelityFinding {
  category: FidelityCategory;
  claimId?: string;
  detail: string;
}

export interface FidelityExpectation {
  allowedUrls: string[];
  expectedName: string;
  expectedCountry?: string;
  expectedTown?: string;
  /** Event dates the sources actually state. Empty means none are stated. */
  expectedEventDates: string[];
  expectedTopics: string[];
  expectedPolarity: SignalPolarity;
  /** Figures present in the source text, for hallucination detection. */
  sourceFigures: string[];
  claimCount: { min: number; max: number };
}

export interface FidelityReport {
  caseId: string;
  claimsExamined: number;
  findings: FidelityFinding[];
  /** Findings per category, for aggregate reporting. */
  byCategory: Partial<Record<FidelityCategory, number>>;
  passed: boolean;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Numbers and money amounts a claim asserts, for hallucination checks. */
export function extractFigures(text: string): string[] {
  const matches = text.match(/£?\d[\d,.]*\s?(?:%|m\b|bn\b|k\b|sq\s?ft)?|fivefold|half|double|triple/gi);
  return (matches ?? []).map((m) => m.trim());
}

/**
 * Scores one extraction against its expectation. The source texts are needed
 * to tell an extracted figure from an invented one.
 */
export function measureFidelity(
  caseId: string,
  claims: ExtractedClaim[],
  polarity: SignalPolarity,
  polarityRationale: string,
  expectation: FidelityExpectation,
  sourceTexts: string[],
): FidelityReport {
  const findings: FidelityFinding[] = [];
  const corpus = normalise(sourceTexts.join(' '));

  if (claims.length < expectation.claimCount.min) {
    findings.push({
      category: 'hallucinated_claim',
      detail: `expected at least ${expectation.claimCount.min} claims, got ${claims.length}`,
    });
  }
  if (claims.length > expectation.claimCount.max) {
    findings.push({
      category: 'hallucinated_claim',
      detail: `expected at most ${expectation.claimCount.max} claims, got ${claims.length} — ` +
        'excess claims are usually the same fact restated or invented',
    });
  }

  for (const claim of claims) {
    const attributes = claim.identityAttributes;

    // 1. Missing identity attributes.
    const supplied = Object.values(attributes).filter(
      (v) => v !== undefined && String(v).length > 0,
    );
    if (supplied.length === 0) {
      findings.push({
        category: 'missing_identity_attributes',
        claimId: claim.id,
        detail: 'no identity attributes supplied',
      });
    } else if (!attributes.statedName) {
      findings.push({
        category: 'missing_identity_attributes',
        claimId: claim.id,
        detail: 'no stated company name',
      });
    }

    // 2. Company attribution.
    if (
      attributes.statedName &&
      normalise(attributes.statedName) !== normalise(expectation.expectedName)
    ) {
      findings.push({
        category: 'incorrect_company_attribution',
        claimId: claim.id,
        detail: `source names "${attributes.statedName}", expected "${expectation.expectedName}"`,
      });
    }

    // 3. Geography — only wrong if it contradicts, not if it is absent.
    const country = attributes.statedGeography?.country;
    if (expectation.expectedCountry && country && normalise(country) !== normalise(expectation.expectedCountry)) {
      findings.push({
        category: 'incorrect_geography',
        claimId: claim.id,
        detail: `country "${country}", expected "${expectation.expectedCountry}"`,
      });
    }
    const town = attributes.statedGeography?.town;
    if (expectation.expectedTown && town && normalise(town) !== normalise(expectation.expectedTown)) {
      findings.push({
        category: 'incorrect_geography',
        claimId: claim.id,
        detail: `town "${town}", expected "${expectation.expectedTown}"`,
      });
    }
    // Geography the sources never stated, imported from the target.
    if (town && !corpus.includes(normalise(town))) {
      findings.push({
        category: 'interpretation_not_extraction',
        claimId: claim.id,
        detail: `town "${town}" does not appear in any source text — imported from the target, not read`,
      });
    }

    // 4. Dates. Asserting one the sources never gave is the common failure.
    if (claim.eventDate) {
      if (!expectation.expectedEventDates.includes(claim.eventDate)) {
        findings.push({
          category: 'incorrect_date',
          claimId: claim.id,
          detail:
            expectation.expectedEventDates.length === 0
              ? `event date "${claim.eventDate}" asserted, but no source states a date`
              : `event date "${claim.eventDate}" not among the stated dates ` +
                `(${expectation.expectedEventDates.join(', ')})`,
        });
      }
    }

    // 5. Source URL must be one that was actually supplied.
    if (!expectation.allowedUrls.includes(claim.sourceUrl)) {
      findings.push({
        category: 'hallucinated_claim',
        claimId: claim.id,
        detail: `cites ${claim.sourceUrl}, which was not among the search results`,
      });
    }

    // 6. Topic.
    if (!expectation.expectedTopics.includes(claim.topic)) {
      findings.push({
        category: 'topic_misclassification',
        claimId: claim.id,
        detail: `topic "${claim.topic}", expected one of ${expectation.expectedTopics.join(', ')}`,
      });
    }

    // 7. Passage must support the claim, and come from the sources.
    const passage = normalise(claim.supportingPassage);
    const passageTokens = passage.split(' ').filter((t) => t.length > 4);
    const passageFound = passageTokens.filter((t) => corpus.includes(t)).length;
    if (passageTokens.length > 0 && passageFound / passageTokens.length < 0.8) {
      findings.push({
        category: 'passage_does_not_support_claim',
        claimId: claim.id,
        detail: `only ${Math.round((passageFound / passageTokens.length) * 100)}% of the passage's ` +
          'distinctive tokens appear in the source text',
      });
    }

    // 8. Figures asserted that no source states.
    for (const figure of extractFigures(claim.claimText)) {
      const known = expectation.sourceFigures.some(
        (f) => normalise(figure).includes(normalise(f)) || normalise(f).includes(normalise(figure)),
      );
      if (!known && !corpus.includes(normalise(figure))) {
        findings.push({
          category: 'hallucinated_claim',
          claimId: claim.id,
          detail: `asserts figure "${figure}", which appears in no source`,
        });
      }
    }
  }

  // 9. Polarity: supported and non-contradictory.
  if (polarity !== expectation.expectedPolarity) {
    findings.push({
      category: 'unsupported_polarity',
      detail: `polarity "${polarity}", expected "${expectation.expectedPolarity}"`,
    });
  }
  const polarityCheck = validatePolarity(claims, polarity, polarityRationale);
  for (const warning of polarityCheck.warnings) {
    findings.push({ category: 'polarity_contradiction', detail: warning });
  }

  const byCategory: Partial<Record<FidelityCategory, number>> = {};
  for (const finding of findings) {
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
  }

  return {
    caseId,
    claimsExamined: claims.length,
    findings,
    byCategory,
    passed: findings.length === 0,
  };
}

export interface FidelitySummary {
  cases: number;
  passed: number;
  totalClaims: number;
  totalFindings: number;
  byCategory: Partial<Record<FidelityCategory, number>>;
}

export function summariseFidelity(reports: FidelityReport[]): FidelitySummary {
  const byCategory: Partial<Record<FidelityCategory, number>> = {};
  let totalFindings = 0;
  let totalClaims = 0;

  for (const report of reports) {
    totalClaims += report.claimsExamined;
    totalFindings += report.findings.length;
    for (const [category, count] of Object.entries(report.byCategory)) {
      const key = category as FidelityCategory;
      byCategory[key] = (byCategory[key] ?? 0) + (count ?? 0);
    }
  }

  return {
    cases: reports.length,
    passed: reports.filter((r) => r.passed).length,
    totalClaims,
    totalFindings,
    byCategory,
  };
}
