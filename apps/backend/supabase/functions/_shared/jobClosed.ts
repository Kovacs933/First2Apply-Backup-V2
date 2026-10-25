import { parseUkDate } from './parsers/postedDate.ts';

export const CLOSED_JOB_REASON = 'This job has closed and is no longer accepting applications.';

// what job boards show on the advert page once a job has been filled, taken down or has expired
const CLOSED_PHRASES = [
  /no longer accepting applications/,
  /this (?:job|vacancy|position|role|advert|listing|posting) (?:has|is) (?:now )?(?:expired|closed|been filled|been removed|no longer (?:available|active|open|advertised))/,
  /(?:job|vacancy|advert|listing) (?:is )?no longer (?:available|active|open|advertised)/,
  /this job has expired on indeed/,
  /applications? (?:for this (?:job|role|vacancy) )?(?:have|has) (?:now )?closed/,
  /the closing date (?:for this (?:job|vacancy|role) )?has (?:now )?passed/,
  /(?:job|vacancy) (?:not found|cannot be found|could not be found)/,
  /\bthis job (?:is )?closed\b/,
];

/**
 * Check a job's advert page (and its card's closing date) to see if the job is still open.
 * Returns why it's closed, or undefined if it looks open.
 */
export function detectClosedJob({ html, tags, now = new Date() }: { html?: string; tags?: string[]; now?: Date }) {
  // a closing date on the search results card ("Closes 23 October 2026") that has passed
  for (const tag of tags ?? []) {
    if (!/^clos/i.test(tag)) continue;
    const closes = parseUkDate(tag);
    if (closes && closes.getTime() < now.getTime()) return CLOSED_JOB_REASON;
  }

  if (!html) return undefined;
  // the visible text of the page, without scripts and styles (which mention these phrases in translations)
  const pageText = html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (CLOSED_PHRASES.some((phrase) => phrase.test(pageText))) return CLOSED_JOB_REASON;

  return undefined;
}
