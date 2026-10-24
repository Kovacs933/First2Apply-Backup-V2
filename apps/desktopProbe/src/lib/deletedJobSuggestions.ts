import { Job } from '@first2apply/core';

export type RuleSuggestion = { rule: string; reason: string };
export type CompanySuggestion = { company: string; reason: string };

/**
 * Patterns we look for in jobs the user deleted. Each one becomes an AI filter rule the user can add.
 */
const PATTERNS: Array<{ rule: string; label: string; matches: (job: Job) => boolean }> = [
  {
    rule: 'Hide senior roles',
    label: 'senior roles',
    matches: (job) => /\b(senior|snr|sr\.?)\b/i.test(job.title),
  },
  {
    rule: 'Hide lead, manager and director roles',
    label: 'lead, manager or director roles',
    matches: (job) => /\b(lead|manager|head of|director|principal)\b/i.test(job.title),
  },
  {
    rule: 'Hide junior, graduate and apprentice roles',
    label: 'junior, graduate or apprentice roles',
    matches: (job) => /\b(junior|graduate|trainee|apprentice(ship)?|intern(ship)?|entry[- ]level)\b/i.test(job.title),
  },
  {
    rule: 'Hide temporary and contract roles',
    label: 'temporary or contract roles',
    matches: (job) =>
      /\b(temporary|temp|contract|fixed[- ]term|locum)\b/i.test([job.title, ...(job.tags ?? [])].join(' ')),
  },
  {
    rule: 'Hide part-time jobs',
    label: 'part-time jobs',
    matches: (job) => /\bpart[- ]time\b/i.test([job.title, ...(job.tags ?? [])].join(' ')),
  },
  {
    rule: 'Hide jobs paid by the hour',
    label: 'jobs paid by the hour',
    matches: (job) => /\b(per hour|an hour|\/hr|hourly)\b/i.test(job.salary ?? ''),
  },
  {
    rule: 'Hide recruitment agency adverts',
    label: 'recruitment agency adverts',
    matches: (job) => /\b(recruit\w*|staffing|personnel|resourcing|talent solutions)\b/i.test(job.companyName),
  },
];

const MIN_MATCHES = 2; // a pattern must show up in at least this many deleted jobs...
const MIN_SHARE = 0.2; // ...and in at least this share of them, so one-off deletions don't create rules

/**
 * Look at the jobs a user deleted and suggest AI filter rules and companies to hide,
 * leaving out anything they already have.
 */
export function suggestFromDeletedJobs({
  deletedJobs,
  currentRules,
  hiddenCompanies,
}: {
  deletedJobs: Job[];
  currentRules: string;
  hiddenCompanies: string[];
}): { rules: RuleSuggestion[]; companies: CompanySuggestion[] } {
  const total = deletedJobs.length;
  if (total < MIN_MATCHES) return { rules: [], companies: [] };

  const rulesText = currentRules.toLowerCase();
  const rules = PATTERNS.map((pattern) => ({ pattern, count: deletedJobs.filter(pattern.matches).length }))
    .filter(({ pattern, count }) => count >= MIN_MATCHES && count / total >= MIN_SHARE && !rulesText.includes(pattern.rule.toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .map(({ pattern, count }) => ({ rule: pattern.rule, reason: `You deleted ${count} ${pattern.label}` }));

  const hidden = new Set(hiddenCompanies.map((c) => c.trim().toLowerCase()));
  const companyCounts = new Map<string, number>();
  for (const job of deletedJobs) {
    const name = job.companyName?.trim();
    if (!name || name === 'N/A' || hidden.has(name.toLowerCase())) continue;
    companyCounts.set(name, (companyCounts.get(name) ?? 0) + 1);
  }
  const companies = [...companyCounts.entries()]
    .filter(([, count]) => count >= MIN_MATCHES)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([company, count]) => ({ company, reason: `You deleted ${count} of their jobs` }));

  return { rules, companies };
}
