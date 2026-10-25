import { Job } from '@first2apply/core';

export type RuleSuggestion = { rule: string; reason: string };
export type CompanySuggestion = { company: string; reason: string };

/**
 * Patterns we look for in jobs the user deleted. Each one becomes an AI filter rule the user can add.
 */
const PATTERNS: Array<{ rule: string; label: string; matches: (job: Job) => boolean; example?: (job: Job) => string }> = [
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
    rule: 'Hide sales and commission-based roles',
    label: 'sales or commission-based roles',
    matches: (job) => /\b(sales|business development|commission|telesales)\b/i.test(job.title),
  },
  {
    rule: 'Hide night and shift work',
    label: 'night or shift roles',
    matches: (job) => /\b(night|nights|shift|weekend)\b/i.test([job.title, ...(job.tags ?? [])].join(' ')),
  },
  {
    rule: 'Hide recruitment agency adverts',
    label: 'recruitment agency adverts',
    matches: (job) => /\b(recruit\w*|staffing|personnel|resourcing|talent solutions)\b/i.test(job.companyName),
    example: (job) => job.companyName,
  },
];

const MIN_MATCHES = 2; // a pattern must show up in at least this many deleted jobs...
const MIN_SHARE = 0.2; // ...and in at least this share of them, so one-off deletions don't create rules
const MAX_SUGGESTIONS = 5; // keep it short so it's not overwhelming

// e.g. ' — like "Senior Data Analyst" and "Senior Developer"'
const examplesOf = (jobs: Job[], example: (job: Job) => string = (job) => job.title) => {
  const titles = [...new Set(jobs.map((job) => example(job)?.trim()).filter(Boolean))].slice(0, 2);
  if (titles.length === 0) return '';
  return ` — like ${titles.map((t) => `"${t}"`).join(' and ')}`;
};

/**
 * Look at the jobs a user deleted and suggest the 5 most likely AI filter rules and the 5 most likely companies
 * to hide, each with the reason, leaving out anything they already have.
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
  const rules = PATTERNS.map((pattern) => ({ pattern, matched: deletedJobs.filter(pattern.matches) }))
    .filter(
      ({ pattern, matched }) =>
        matched.length >= MIN_MATCHES &&
        matched.length / total >= MIN_SHARE &&
        !rulesText.includes(pattern.rule.toLowerCase()),
    )
    // most likely first: the patterns behind the biggest share of deletions
    .sort((a, b) => b.matched.length - a.matched.length)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ pattern, matched }) => ({
      rule: pattern.rule,
      reason: `${matched.length} of the ${total} jobs you deleted were ${pattern.label}${examplesOf(matched, pattern.example)}.`,
    }));

  const hidden = new Set(hiddenCompanies.map((c) => c.trim().toLowerCase()));
  const companyJobs = new Map<string, Job[]>();
  for (const job of deletedJobs) {
    const name = job.companyName?.trim();
    if (!name || name === 'N/A' || hidden.has(name.toLowerCase())) continue;
    companyJobs.set(name, [...(companyJobs.get(name) ?? []), job]);
  }
  const companies = [...companyJobs.entries()]
    .filter(([, jobs]) => jobs.length >= MIN_MATCHES)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_SUGGESTIONS)
    .map(([company, jobs]) => ({
      company,
      reason: `You deleted ${jobs.length} of their jobs${examplesOf(jobs)}.`,
    }));

  return { rules, companies };
}
