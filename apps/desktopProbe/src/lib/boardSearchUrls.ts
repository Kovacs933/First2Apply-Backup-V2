import { SiteProvider } from '@first2apply/core';

/** distanceMiles only applies when a location is given. */
export type BoardSearch = { keywords: string; location: string; distanceMiles?: number };

/** "Milton Keynes" -> "milton-keynes", the format UK boards use in their search page paths. */
function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Query string from the non-empty values only. */
function query(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]?.trim());
  return new URLSearchParams(entries.map(([key, value]) => [key, value.trim()])).toString();
}

/** Append a query string to an address that may not have one yet. */
function withQuery(url: string, params: Record<string, string | undefined>) {
  const qs = query(params);
  return qs ? `${url}?${qs}` : url;
}

/**
 * Distance options each board accepts, in miles (checked on the live sites in Oct 2026).
 * `any` means the board takes any whole number of miles.
 */
const DISTANCE_OPTIONS: Partial<Record<SiteProvider, number[] | 'any'>> = {
  [SiteProvider.linkedin]: [5, 10, 25, 50, 100],
  [SiteProvider.indeed]: [0, 5, 10, 15, 25, 35, 50, 100],
  [SiteProvider.reed]: [0, 1, 3, 5, 10, 15, 20, 30, 50],
  [SiteProvider.totaljobs]: [5, 10, 20, 30, 50, 100],
  [SiteProvider.cvLibrary]: [1, 2, 5, 7, 10, 15, 20, 25, 35, 50, 75, 100, 250, 500, 750],
  [SiteProvider.adzuna]: 'any',
  [SiteProvider.nhsJobs]: [5, 10, 20, 30, 50, 100],
  [SiteProvider.charityJob]: 'any',
  // GOV.UK Work Hub ignores distance in its search links, and jobs.ac.uk returns a blank page
  // when a distance is added to a link (its own form also sends map coordinates)
};

/**
 * The distance to send to a board: the requested miles rounded up to the board's next option
 * (or its largest one), or undefined when there's no location or the board has no distance setting.
 */
export function boardDistance(provider: SiteProvider, search: BoardSearch): string | undefined {
  const options = DISTANCE_OPTIONS[provider];
  if (!options || !search.location.trim() || search.distanceMiles === undefined) return undefined;
  const miles = Math.max(0, Math.round(search.distanceMiles));
  if (options === 'any') return String(Math.max(1, miles));
  return String(options.find((option) => option >= miles) ?? options[options.length - 1]);
}

/**
 * The distance setting in each board's search page address, for searches saved from the board itself.
 */
const DISTANCE_URL_PARAMS: Array<{ host: RegExp; provider: SiteProvider; param: string }> = [
  { host: /(^|\.)linkedin\.com$/, provider: SiteProvider.linkedin, param: 'distance' },
  { host: /(^|\.)indeed\.com$/, provider: SiteProvider.indeed, param: 'radius' },
  { host: /(^|\.)reed\.co\.uk$/, provider: SiteProvider.reed, param: 'proximity' },
  { host: /(^|\.)(totaljobs\.com|cwjobs\.co\.uk)$/, provider: SiteProvider.totaljobs, param: 'radius' },
  { host: /(^|\.)cv-library\.co\.uk$/, provider: SiteProvider.cvLibrary, param: 'distance' },
  { host: /(^|\.)adzuna\.co\.uk$/, provider: SiteProvider.adzuna, param: 'd' },
  { host: /(^|\.)jobs\.nhs\.uk$/, provider: SiteProvider.nhsJobs, param: 'distance' },
  { host: /(^|\.)charityjob\.co\.uk$/, provider: SiteProvider.charityJob, param: 'radius' },
];

function distanceParamFor(url: string) {
  try {
    const { hostname } = new URL(url);
    return DISTANCE_URL_PARAMS.find(({ host }) => host.test(hostname));
  } catch {
    return undefined;
  }
}

/** Whether we can set the distance on a search page address from this board. */
export function supportsDistance(url: string) {
  return !!distanceParamFor(url);
}

/** The distance (miles) already set in a search page address, if any. */
export function distanceInUrl(url: string): number | undefined {
  const match = distanceParamFor(url);
  if (!match) return undefined;
  const value = Number(new URL(url).searchParams.get(match.param));
  return Number.isFinite(value) && new URL(url).searchParams.has(match.param) ? value : undefined;
}

/** The search page address with its distance set to the board's nearest option to `miles`. */
export function withDistance(url: string, miles: number): string {
  const match = distanceParamFor(url);
  if (!match) return url;
  const distance = boardDistance(match.provider, { keywords: '', location: 'set', distanceMiles: miles });
  if (!distance) return url;
  const updated = new URL(url);
  updated.searchParams.set(match.param, distance);
  return updated.toString();
}

/**
 * Builds the search results page address for each board that supports searching straight from a link,
 * so one job title + location (+ distance) can be turned into a saved search on every board at once.
 */
export const BOARD_SEARCH_URL_BUILDERS: Partial<Record<SiteProvider, (search: BoardSearch) => string>> = {
  [SiteProvider.linkedin]: (s) =>
    // f_TPR=r604800: posted in the last week
    `https://www.linkedin.com/jobs/search/?${query({
      keywords: s.keywords,
      location: s.location || 'United Kingdom',
      distance: boardDistance(SiteProvider.linkedin, s),
      f_TPR: 'r604800',
    })}`,
  [SiteProvider.indeed]: (s) =>
    // fromage=7: posted in the last 7 days
    `https://uk.indeed.com/jobs?${query({ q: s.keywords, l: s.location, radius: boardDistance(SiteProvider.indeed, s), fromage: '7' })}`,
  [SiteProvider.reed]: (s) =>
    withQuery(
      s.location.trim()
        ? `https://www.reed.co.uk/jobs/${slug(s.keywords)}-jobs-in-${slug(s.location)}`
        : `https://www.reed.co.uk/jobs/${slug(s.keywords)}-jobs`,
      { proximity: boardDistance(SiteProvider.reed, s) },
    ),
  [SiteProvider.totaljobs]: (s) =>
    withQuery(
      s.location.trim()
        ? `https://www.totaljobs.com/jobs/${slug(s.keywords)}/in-${slug(s.location)}`
        : `https://www.totaljobs.com/jobs/${slug(s.keywords)}`,
      { radius: boardDistance(SiteProvider.totaljobs, s) },
    ),
  [SiteProvider.cvLibrary]: (s) =>
    withQuery(
      s.location.trim()
        ? `https://www.cv-library.co.uk/${slug(s.keywords)}-jobs-in-${slug(s.location)}`
        : `https://www.cv-library.co.uk/${slug(s.keywords)}-jobs`,
      { distance: boardDistance(SiteProvider.cvLibrary, s) },
    ),
  [SiteProvider.adzuna]: (s) =>
    `https://www.adzuna.co.uk/jobs/search?${query({ q: s.keywords, w: s.location, d: boardDistance(SiteProvider.adzuna, s) })}`,
  [SiteProvider.workHub]: (s) =>
    `https://www.jobs.service.gov.uk/jobs/search?${query({ keywords: s.keywords, location: s.location })}`,
  [SiteProvider.nhsJobs]: (s) =>
    `https://www.jobs.nhs.uk/candidate/search/results?${query({
      keyword: s.keywords,
      location: s.location,
      distance: boardDistance(SiteProvider.nhsJobs, s),
    })}`,
  [SiteProvider.charityJob]: (s) =>
    `https://www.charityjob.co.uk/jobs?${query({ keywords: s.keywords, location: s.location, radius: boardDistance(SiteProvider.charityJob, s) })}`,
  [SiteProvider.jobsAcUk]: (s) =>
    `https://www.jobs.ac.uk/search/?${query({ keywords: s.keywords, location: s.location })}`,
};
