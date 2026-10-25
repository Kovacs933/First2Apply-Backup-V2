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
// jobs the user deleted are remembered for longer, so a role they've said no to doesn't come back
const DELETED_LOOKBACK_DAYS = 365;
// Supabase returns at most 1000 rows per request, so the lookup is paged
const PAGE_SIZE = 1000;
const MAX_EXISTING_JOBS = 20000;

const COMPANY_SUFFIXES = /\b(inc|llc|ltd|limited|plc|gmbh|corp|corporation|co|company|group|sa|bv|ag|uk|the)\b/g;
// words boards and recruiters add to the same role's title ("URGENT: Data Analyst - Hybrid")
const TITLE_NOISE =
  // ("contract" and "new" are left out: "Contract Manager" and "New Business Manager" are real titles)
  /\b(urgent(ly)?|immediate start|start asap|asap|apply now|hiring|remote|hybrid|on ?site|office based|home based|work from home|wfh|full ?time|part ?time|permanent|perm|temporary|temp|fixed ?term|ft|pt|x\d+)\b/g;
const TITLE_SEPARATOR = /\s+[-–—|]\s+|\s*\|\s*/;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/\(.*?\)|\[.*?\]/g, ' ') // drop "(remote)", "[hybrid]" etc.
    .replace(/[^a-z0-9£]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const stripNoise = (value: string) => normalize(value).replace(TITLE_NOISE, ' ').replace(/\s+/g, ' ').trim();

export const normalizeTitle = (title: string) => stripNoise(title);
export const normalizeCompany = (company: string) =>
  normalize(company).replace(COMPANY_SUFFIXES, ' ').replace(/\s+/g, ' ').trim();
/** first word of the location (e.g. "london" from "London, England, UK"), empty if unknown */
export const normalizeLocationHint = (location?: string | null) => normalize(location ?? '').split(' ')[0] ?? '';

/**
 * The title, plus the title without a trailing "- Leeds", "| £30k" or "- Hybrid" part when that part is just the
 * location, salary or filler. A trailing part that says something else ("Engineer - Java") is kept, so different
 * roles at one company don't get mixed up.
 */
export function titleVariants(job: JobLike): string[] {
  const variants = new Set([normalizeTitle(job.title)]);
  const [head, ...rest] = job.title.split(TITLE_SEPARATOR);
  if (rest.length > 0) {
    const tail = normalize(rest.join(' '));
    const tailWithoutNoise = stripNoise(rest.join(' '));
    const locationHint = normalizeLocationHint(job.location);
    const tailIsLocationSalaryOrNoise =
      !tailWithoutNoise ||
      /£|\b\d+k?\b|\bper (annum|hour|day)\b/.test(tail) ||
      (!!locationHint && tail.includes(locationHint));
    if (tailIsLocationSalaryOrNoise && stripNoise(head)) variants.add(stripNoise(head));
  }
  return [...variants].filter(Boolean);
}

export const jobFingerprints = (job: JobLike) =>
  titleVariants(job).map((title) => `${title}|${normalizeCompany(job.companyName)}`);
export const jobFingerprint = (job: JobLike) => jobFingerprints(job)[0];

/** Two jobs are the same if they share a fingerprint and their locations don't clearly differ. */
function isSameJob(a: JobLike, b: JobLike) {
  const fa = new Set(jobFingerprints(a));
  if (!jobFingerprints(b).some((f) => fa.has(f))) return false;
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
    for (const key of jobFingerprints(job)) {
      byFingerprint.set(key, [...(byFingerprint.get(key) ?? []), job]);
    }
  };
  existingJobs.forEach(add);

  const jobs: T[] = [];
  const duplicates: T[] = [];
  for (const job of newJobs) {
    const candidates = jobFingerprints(job).flatMap((key) => byFingerprint.get(key) ?? []);
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

/** Load the user's jobs created since `since` (optionally only deleted ones), a page at a time. */
async function loadExistingJobs({
  supabaseClient,
  userId,
  since,
  onlyDeleted,
}: {
  supabaseClient: SupabaseClient<DbSchema, 'public'>;
  userId: string;
  since: string;
  onlyDeleted: boolean;
}): Promise<JobLike[]> {
  const jobs: JobLike[] = [];
  for (let from = 0; from < MAX_EXISTING_JOBS; from += PAGE_SIZE) {
    let query = supabaseClient
      .from('jobs')
      .select('externalId, title, companyName, location')
      .eq('user_id', userId)
      .gte('created_at', since);
    if (onlyDeleted) query = query.eq('status', 'deleted');
    const { data, error } = await query.order('id', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    jobs.push(...((data ?? []) as JobLike[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return jobs;
}

/**
 * Filter out jobs the user already has from another job board (or a repost with a new id) in the last 30 days,
 * and roles they deleted in the last year. Never throws: if the lookup fails, all jobs are kept.
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
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const [recentJobs, deletedJobs] = await Promise.all([
      loadExistingJobs({ supabaseClient, userId, since: daysAgo(LOOKBACK_DAYS), onlyDeleted: false }),
      loadExistingJobs({ supabaseClient, userId, since: daysAgo(DELETED_LOOKBACK_DAYS), onlyDeleted: true }),
    ]);

    const { jobs: uniqueJobs, duplicates } = removeCrossBoardDuplicates(jobs, [...recentJobs, ...deletedJobs]);
    if (duplicates.length > 0) {
      logger.info(`skipped ${duplicates.length} jobs already found on another board, reposted or deleted before`);
    }
    return uniqueJobs;
  } catch (error) {
    logger.error(`cross-board duplicate check failed, keeping all jobs: ${error instanceof Error ? error.message : error}`);
    return jobs;
  }
}
