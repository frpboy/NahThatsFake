/**
 * Separate per-check results.
 *
 * Suggestion by Alex Meleshko (LinkedIn, on the Nah That's Fake launch post):
 * "If the image service times out but the link check comes back clean, I'd
 * show those as two separate results. A green check next to the link is easy
 * to read as a verdict on the photo too."
 *
 * So: an image check and a link check that belong to the same message are
 * always reported as two distinct results, each with its own status. A
 * timeout / failure of one service makes THAT check inconclusive — it never
 * inherits the other check's verdict, and a clean result for one check is
 * never presented as a verdict on the other.
 */

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type CheckOutcome =
  | { status: 'complete'; score: number; risk_level: RiskLevel }
  | { status: 'timeout' | 'error' | 'inconclusive'; reason?: string };

export interface SeparateCheckResult {
  type: 'image' | 'link';
  /** 'complete' only when that check's own service produced a verdict. */
  status: 'complete' | 'inconclusive';
  /** Null unless status is 'complete' — an inconclusive check has no verdict. */
  risk_level: RiskLevel | null;
  score: number | null;
  /** Why the check is inconclusive ('timeout', 'error', ...), when it is. */
  reason?: string;
}

export interface SeparateCheckSummary {
  /** True only when every check that ran produced its own verdict. */
  complete: boolean;
  inconclusiveTypes: Array<'image' | 'link'>;
  headline: string;
}

export interface SeparateCheckResults {
  results: SeparateCheckResult[];
  summary: SeparateCheckSummary;
}

/** Classify a thrown service error so a timeout is reported as a timeout. */
export function classifyServiceError(error: unknown): 'timeout' | 'error' {
  const code = (error as { code?: string } | null)?.code || '';
  const message = error instanceof Error ? error.message : String(error || '');
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout|timed out/i.test(message)) {
    return 'timeout';
  }
  return 'error';
}

function toSeparateResult(type: 'image' | 'link', outcome: CheckOutcome): SeparateCheckResult {
  if (outcome.status === 'complete') {
    return { type, status: 'complete', risk_level: outcome.risk_level, score: outcome.score };
  }
  // Timeout / error / inconclusive: this check has NO verdict. It must not
  // borrow the other check's risk level or score.
  return { type, status: 'inconclusive', risk_level: null, score: null, reason: outcome.status };
}

const TYPE_LABEL: Record<'image' | 'link', string> = {
  image: 'image',
  link: 'link'
};

export function buildSeparateCheckResults(input: {
  image?: CheckOutcome | null;
  link?: CheckOutcome | null;
}): SeparateCheckResults {
  const results: SeparateCheckResult[] = [];
  if (input.image) results.push(toSeparateResult('image', input.image));
  if (input.link) results.push(toSeparateResult('link', input.link));

  const inconclusiveTypes = results
    .filter(result => result.status === 'inconclusive')
    .map(result => result.type);
  const complete = inconclusiveTypes.length === 0;

  const headline = complete
    ? 'Separate results for each check — each verdict applies only to its own check:'
    : `⚠️ *Partial result:* the ${inconclusiveTypes.map(t => TYPE_LABEL[t]).join(' and ')} check is inconclusive, so there is no verdict for it. Each result below applies only to its own check.`;

  return { results, summary: { complete, inconclusiveTypes, headline } };
}

function riskEmoji(riskLevel: RiskLevel): string {
  return riskLevel === 'HIGH' ? '🔴' : riskLevel === 'MEDIUM' ? '🟡' : '🟢';
}

function formatOneResult(result: SeparateCheckResult): string {
  if (result.type === 'image') {
    if (result.status !== 'complete' || result.risk_level === null || result.score === null) {
      const why = result.reason === 'timeout'
        ? 'the image service timed out'
        : 'the image service could not complete the analysis';
      return `🖼️ *Image check*\n⏳ *Inconclusive — ${why}.* No verdict for the image.`;
    }
    return `🖼️ *Image check*\n${riskEmoji(result.risk_level)} Risk Level: *${result.risk_level}*\nArtificial Probability: *${(result.score * 100).toFixed(1)}%*\n(This verdict is about the image only.)`;
  }

  if (result.status !== 'complete' || result.risk_level === null || result.score === null) {
    const why = result.reason === 'timeout'
      ? 'the link service timed out'
      : 'the link service could not complete the scan';
    return `🔗 *Link check*\n⏳ *Inconclusive — ${why}.* No verdict for the link.`;
  }
  return `🔗 *Link check*\n${riskEmoji(result.risk_level)} Risk Level: *${result.risk_level}*\nThreat Probability: *${(result.score * 100).toFixed(1)}%*\n(This verdict is about the link only.)`;
}

/** Format the separate results as one message with two distinct sections. */
export function formatSeparateCheckResults(separate: SeparateCheckResults): string {
  const sections = separate.results.map(formatOneResult);
  return `${separate.summary.headline}\n\n${sections.join('\n\n')}\n\n⚠️ *Always verify sources yourself!*`;
}
