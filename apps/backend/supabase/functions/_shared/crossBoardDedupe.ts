import { DbSchema } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';

import { ILogger } from './logger.ts';

type JobLike = {
  externalId: string;
  title: string;
  companyName: string;
  location?: string | null;
};

// only look back this far when checking for the same job posted on another board / reposted
const LOOKBACK_DAYS = 30;
const COMPANY_SUFFIXES = /\b(inc|llc|ltd|limited|plc|gmbh|corp|corporation|co|company|group|sa|bv|ag)\b/g;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\(.*?\)|\[.*?\]/g, ' ') // drop "(remote)", "[hybrid]" etc.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const normalizeTitle = (title: string) => normalize(title);
export const normalizeCompany = (company: string) =>
  normalize(company).replace(COMPANY_SUFFIXES, ' ').replace(/\s+/g, ' ').trim();
/** first word of the location (e.g. "london" from "London, England, UK"), empty if unknown */
export const normalizeLocationHint = (location?: string | null) => normalize(location ?? '').split(' ')[0] ?? '';

export const jobFingerprint = (job: JobLike) => `${normalizeTitle(job.title)}|${normalizeCompany(job.companyName)}`;

/**
 * Two jobs are considered the same if title + company match and their locations don't clearly differ
 * (if either location is unknown, title + company is enough).
 */
function isSameJob(a: JobLike, b: JobLike) {
  if (jobFingerprint(a) !== jobFingerprint(b)) return false;
  const la = normalizeLocationHint(a.location);
  const lb = normalizeLocationHint(b.location);
  return !la || !lb || la === lb;
}

/**
 * Pure helper: drop jobs that are the same as one of the `existingJobs` (but with a different id),
 * or the same as an earlier job in the list itself.
 */
export function removeCrossBoardDuplicates<T extends JobLike>(
  newJobs: T[],
  existingJobs: JobLike[],
): { jobs: T[]; duplicates: T[] } {
  const byFingerprint = new Map<string, JobLike[]>();
  const add = (job: JobLike) => {
    const key = jobFingerprint(job);
    byFingerprint.set(key, [...(byFingerprint.get(key) ?? []), job]);
  };
  existingJobs.forEach(add);

  const jobs: T[] = [];
  const duplicates: T[] = [];
  for (const job of newJobs) {
    const candidates = byFingerprint.get(jobFingerprint(job)) ?? [];
    // same externalId = the exact same posting, the db upsert already ignores those
    const isDuplicate = candidates.some((other) => other.externalId !== job.externalId && isSameJob(job, other));
    if (isDuplicate) {
      duplicates.push(job);
    } else {
      jobs.push(job);
      add(job);
    }
  }

  return { jobs, duplicates };
}

/**
 * Filter out jobs the user already has from another job board (or a repost with a new id)
 * in the last 30 days. Never throws: if the lookup fails, all jobs are kept.
 */
export async function filterCrossBoardDuplicates<T extends JobLike>({
  jobs,
  userId,
  supabaseClient,
  logger,
}: {
  jobs: T[];
  userId: string;
  supabaseClient: SupabaseClient<DbSchema, 'public'>;
  logger: ILogger;
}): Promise<T[]> {
  if (jobs.length === 0) return jobs;

  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseClient
      .from('jobs')
      .select('externalId, title, companyName, location')
      .eq('user_id', userId)
      .gte('created_at', since)
      .limit(5000);
    if (error) throw new Error(error.message);

    const { jobs: uniqueJobs, duplicates } = removeCrossBoardDuplicates(jobs, (data ?? []) as JobLike[]);
    if (duplicates.length > 0) {
      logger.info(`skipped ${duplicates.length} jobs already found on another board or reposted`);
    }
    return uniqueJobs;
  } catch (error) {
    logger.error(`cross-board duplicate check failed, keeping all jobs: ${error instanceof Error ? error.message : error}`);
    return jobs;
  }
}
