import { Element } from 'deno-dom-wasm';

import { findPostedDate } from './postedDate.ts';

/**
 * Helper function to determine if a text likely represents salary information.
 * It checks for common currency symbols, keywords, and patterns that indicate salary.
 * @param text - The text to evaluate.
 * @returns True if the text is likely salary information, false otherwise.
 */
export function isSalaryText(text: string): boolean {
  const salaryRegex = /(?:[$€£]|\b(?:usd|eur|gbp|salary)\b|\d+\s*k\b)/i;
  if (salaryRegex.test(text)) {
    return true;
  }

  // Additional heuristic: check for numbers followed by 'per year', 'annually', etc.
  const salaryPhrases = ['per year', 'annually', 'per annum', 'per hour'];
  const lowerText = text.toLowerCase();
  if (/\d/.test(text) && salaryPhrases.some((phrase) => lowerText.includes(phrase))) {
    return true;
  }

  return false;
}

/**
 * Map over job card elements, but never let one malformed card break the whole page.
 * A card that throws while being parsed is skipped (treated as `null`).
 * Also reads when each job was posted from its card, for every board, unless the parser set it already.
 */
export function safeMapJobs<E, R>(elements: E[], parseOne: (el: E, index: number) => R | null): Array<R | null> {
  return elements.map((el, index) => {
    try {
      const job = parseOne(el, index);
      if (job && typeof job === 'object' && !('postedAt' in job && job.postedAt) && el instanceof Element) {
        (job as { postedAt?: string }).postedAt = findPostedDate(el);
      }
      return job;
    } catch (error) {
      console.error(`skipping malformed job card #${index}: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  });
}

/**
 * Async version of `safeMapJobs`.
 */
export function safeMapJobsAsync<E, R>(
  elements: E[],
  parseOne: (el: E, index: number) => Promise<R | null>,
): Promise<Array<R | null>> {
  return Promise.all(
    elements.map(async (el, index) => {
      try {
        return await parseOne(el, index);
      } catch (error) {
        console.error(`skipping malformed job card #${index}: ${error instanceof Error ? error.message : error}`);
        return null;
      }
    }),
  );
}

type CleanableJob = { externalId: string; externalUrl: string; title: string; companyName: string; location?: string | null };

/**
 * Final clean-up applied to every parsed jobs list:
 * - trims ids/titles/company names and drops jobs missing them
 * - turns relative job links ("/jobs/123") into full links using the search page url
 * - removes duplicates of the same job on the same page (same id, or same title + company + location)
 */
export function cleanParsedJobs<T extends CleanableJob>(jobs: T[], pageUrl: string): T[] {
  const seenIds = new Set<string>();
  const seenTitleCompany = new Set<string>();
  const result: T[] = [];

  for (const job of jobs) {
    if (!job) continue;
    const externalId = job.externalId?.trim();
    const title = job.title?.trim();
    const companyName = job.companyName?.trim();
    let externalUrl = job.externalUrl?.trim();
    if (!externalId || !title || !companyName || !externalUrl) continue;

    try {
      externalUrl = new URL(externalUrl, pageUrl).toString();
    } catch {
      // keep the original url if it can't be resolved
    }

    const titleCompanyKey = [title, companyName, job.location ?? ''].map((v) => v.trim().toLowerCase()).join('|');
    if (seenIds.has(externalId) || seenTitleCompany.has(titleCompanyKey)) continue;
    seenIds.add(externalId);
    seenTitleCompany.add(titleCompanyKey);

    result.push({ ...job, externalId, title, companyName, externalUrl });
  }

  return result;
}
