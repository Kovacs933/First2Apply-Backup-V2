import { JobType } from '@first2apply/core';
import { DOMParser, Document, Element } from 'deno-dom-wasm';

import { JobSiteParseResult, ParsedJob } from './parserTypes.ts';
import { safeMapJobs } from './parserHelpers.ts';
import { parsePostedText } from './postedDate.ts';

/**
 * Parsers for UK job boards: Reed, Totaljobs (also CWJobs), CV-Library, Adzuna,
 * NHS Jobs, GOV.UK Work Hub, CharityJob, jobs.ac.uk, MyNewTerm, Gumtree and SimplyHired.
 *
 * Job ids are prefixed with the board name because the jobs table is unique per
 * (user, externalId) and plain numeric ids from two boards could collide.
 */

const EMPTY_LIST: JobSiteParseResult = { jobs: [], listFound: true, elementsCount: 0 };
const LIST_NOT_FOUND: JobSiteParseResult = { jobs: [], listFound: false, elementsCount: 0 };

/** Collapsed, trimmed text content of an element (undefined when empty). */
function text(el?: Element | null): string | undefined {
  const value = el?.textContent?.replace(/\s+/g, ' ').trim();
  return value || undefined;
}

/** Image src, ignoring lazy-load placeholders and turning protocol-relative urls into https ones. */
function imageSrc(img?: Element | null): string | undefined {
  const src = (img?.getAttribute('data-src') || img?.getAttribute('src'))?.trim();
  if (!src || src.startsWith('data:')) return undefined;
  return src.startsWith('//') ? `https:${src}` : src;
}

/** Guess the work arrangement from the location / tag texts shown on a job card. */
function detectJobType(...texts: (string | undefined)[]): JobType | undefined {
  const all = texts.filter(Boolean).join(' ').toLowerCase();
  if (!all) return undefined;
  if (all.includes('hybrid')) return 'hybrid';
  if (/\bremote\b|work from home|home[- ]based|home working/.test(all)) return 'remote';
  return 'onsite';
}

/** Pull a UK salary such as "£30,000 - £35,000 per annum" out of a longer piece of text. */
function extractGbpSalary(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(
    /£\s?[\d,.]+\s?[kK]?(?:\s*(?:-|–|to)\s*£\s?[\d,.]+\s?[kK]?)?(?:\s*(?:per|a|an|\/)\s*(?:year|annum|hour|day|week|month|hr))?/i,
  );
  return match?.[0].trim();
}

/** Some boards have no list element at all when a search returns nothing, so sniff the page text. */
function looksLikeNoResults(document: Document): boolean {
  const pageText = document.body?.textContent?.replace(/\s+/g, ' ') ?? '';
  return /no (?:matching )?(?:jobs|results|vacancies) (?:were )?(?:found|match)|didn['’]t match any|0 jobs found|we couldn['’]t find any|sorry, we (?:could not|couldn['’]t) find/i.test(
    pageText,
  );
}

function parseDocument(html: string): Document {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (!document) throw new Error('Could not parse html');
  return document;
}

function toResult(jobElements: Element[], parseJob: (el: Element) => ParsedJob | null): JobSiteParseResult {
  const jobs = safeMapJobs(jobElements, parseJob).filter((job): job is ParsedJob => !!job);
  return { jobs, listFound: true, elementsCount: jobElements.length };
}

/**
 * reed.co.uk
 */
export function parseReedJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('article[data-qa="job-card"]')) as Element[];
  if (jobElements.length === 0) {
    if (document.querySelector('[data-qa="alert-no-results-criteria"]') || looksLikeNoResults(document)) {
      return EMPTY_LIST;
    }
    return LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const titleEl = el.querySelector('a[data-qa="job-card-title"]');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    const id = titleEl?.getAttribute('data-id') || el.getAttribute('data-id')?.replace(/^job/, '');
    if (!title || !href || !id) return null;

    const companyName = text(el.querySelector('[data-qa="job-posted-by"] a'));
    if (!companyName) return null;
    // ex: "18 September by Exam Papers Plus", "Yesterday by ..."
    const postedAt = parsePostedText(text(el.querySelector('[data-qa="job-posted-by"]'))?.split(' by ')[0]);

    const salary = text(el.querySelector('[data-qa="job-metadata-salary"]'));
    const location = text(el.querySelector('[data-qa="job-metadata-location"]'));
    // the other metadata items are the contract type and work arrangement, ex: "Permanent, full-time", "Remote"
    const tags = (Array.from(el.querySelectorAll('[data-qa="job-metadata"] > li:not([data-qa])')) as Element[])
      .map((li) => text(li))
      .filter((t): t is string => !!t);

    return {
      siteId,
      externalId: `reed-${id}`,
      externalUrl: href,
      title,
      companyName,
      companyLogo: imageSrc(el.querySelector('img[data-qa="company-logo-image"]')),
      location,
      salary,
      jobType: detectJobType(location, ...tags),
      labels: [],
      tags,
      postedAt,
    };
  });
}

/**
 * totaljobs.com and the other boards on the same platform (cwjobs.co.uk).
 */
export function parseTotaljobsJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('article[data-at="job-item"]')) as Element[];
  if (jobElements.length === 0) {
    return looksLikeNoResults(document) ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const titleEl = el.querySelector('a[data-at="job-item-title"]');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    const id = el.getAttribute('id')?.replace(/^job-item-/, '') || href?.match(/job(\d+)$/)?.[1];
    if (!title || !href || !id) return null;

    const companyName = text(el.querySelector('[data-at="job-item-company-name"]'));
    if (!companyName) return null;

    const location = text(el.querySelector('[data-at="job-item-location"]'));
    const workFromHome = text(el.querySelector('[data-at*="work-from-home"]'));
    const postedAt = text(el.querySelector('[data-at="job-item-timeago"]'));

    return {
      siteId,
      externalId: `totaljobs-${id}`,
      externalUrl: href,
      title,
      companyName,
      companyLogo: imageSrc(el.querySelector('[data-at="company-logo"] img')),
      location,
      salary: text(el.querySelector('[data-at="job-item-salary-info"]')),
      jobType: detectJobType(location, workFromHome),
      labels: [],
      tags: [],
      postedAt: parsePostedText(postedAt),
    };
  });
}

/**
 * cv-library.co.uk
 */
export function parseCvLibraryJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const list = document.querySelector('[data-qa="job-list-pane"]') ?? document;
  const jobElements = Array.from(list.querySelectorAll('[itemprop="itemListElement"]')) as Element[];
  if (jobElements.length === 0) {
    return looksLikeNoResults(document) ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const titleEl = el.querySelector('a[data-qa="job-title-link"]');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    const id = href?.match(/\/job\/(\d+)/)?.[1];
    if (!title || !href || !id) return null;

    const companyName = text(el.querySelector('[data-qa^="job-card-company"]'));
    if (!companyName) return null;

    // ex: "City of London, London (3 miles)", followed by an "Also in other locations" toggle
    const locationEl = el.querySelector('[data-qa^="job-card-location"]');
    const location = text(locationEl?.querySelector('span') ?? locationEl)?.replace(/\s*\(\d+(?:\.\d+)? miles?\)$/i, '');
    const contractType = text(el.querySelector('[data-qa^="job-card-job-type"]'));

    return {
      siteId,
      externalId: `cvlibrary-${id}`,
      externalUrl: href,
      title,
      companyName,
      location,
      salary: text(el.querySelector('[data-qa^="job-card-salary"]')),
      jobType: detectJobType(location, contractType),
      labels: [],
      tags: contractType ? [contractType] : [],
    };
  });
}

/**
 * adzuna.co.uk
 */
export function parseAdzunaJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('article[data-aid]')) as Element[];
  if (jobElements.length === 0) {
    return looksLikeNoResults(document) ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const id = el.getAttribute('data-aid')?.trim();
    const titleEl = el.querySelector('h2 a');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    if (!id || !title || !href) return null;

    const companyName = text(el.querySelector('.ui-company'));
    if (!companyName) return null;

    const location = text(el.querySelector('.ui-location'))?.replace(/,$/, '');

    // adzuna shows its own estimate ("JOBSWORTH") when the advert has no salary
    const salaryText = text(el.querySelector('.ui-salary'));
    let salary = extractGbpSalary(salaryText);
    if (salary && /jobsworth/i.test(salaryText ?? '')) salary = `${salary} (estimate)`;

    return {
      siteId,
      externalId: `adzuna-${id}`,
      externalUrl: href,
      title,
      companyName,
      companyLogo: imageSrc(el.querySelector('.ui-logo-col img')),
      location,
      salary,
      jobType: detectJobType(location),
      labels: [],
      tags: [],
    };
  });
}

/**
 * jobs.nhs.uk
 */
export function parseNhsJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('li[data-test="search-result"]')) as Element[];
  if (jobElements.length === 0) {
    return looksLikeNoResults(document) ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const titleEl = el.querySelector('a[data-test="search-result-job-title"]');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    const id = href?.split('/').filter(Boolean).pop();
    if (!title || !href || !id) return null;

    // the heading holds the employer name followed by the address in a nested div
    const employerEl = el.querySelector('[data-test="search-result-location"] h3');
    const location = text(employerEl?.querySelector('.location-font-size'));
    let companyName = text(employerEl);
    if (companyName && location) companyName = companyName.replace(location, '').trim();
    if (!companyName) return null;

    const contractType = text(el.querySelector('[data-test="search-result-jobType"] strong'));
    const workingPattern = text(el.querySelector('[data-test="search-result-workingPattern"] strong'));
    const closingDate = text(el.querySelector('[data-test="search-result-closingDate"] strong'));
    const tags = [contractType, workingPattern, closingDate ? `Closes ${closingDate}` : undefined].filter(
      (t): t is string => !!t,
    );

    return {
      siteId,
      externalId: `nhs-${id}`,
      externalUrl: href,
      title,
      companyName,
      location,
      salary: text(el.querySelector('[data-test="search-result-salary"] strong')),
      jobType: detectJobType(location, workingPattern),
      labels: [],
      tags,
    };
  });
}

/**
 * jobs.service.gov.uk (GOV.UK Work Hub, which replaced "Find a job").
 */
export function parseWorkHubJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('[data-testid^="searchResultCard-"]')) as Element[];
  if (jobElements.length === 0) {
    return looksLikeNoResults(document) ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const id = el.getAttribute('data-testid')?.replace('searchResultCard-', '');
    const titleEl = el.querySelector('a[data-testid^="jobTitle-"]');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    if (!id || !title || !href) return null;

    // ex: <span>Jobandtalent</span><span> - Altrincham, Greater Manchester</span>
    const [companyEl, locationEl] = Array.from(
      el.querySelectorAll('[data-testid="searchResultCardEmployer"] > span'),
    ) as Element[];
    const companyName = text(companyEl);
    if (!companyName) return null;
    const location = text(locationEl)?.replace(/^-\s*/, '');

    const salary = (Array.from(el.querySelectorAll('p')) as Element[])
      .filter((p) => !p.getAttribute('data-testid'))
      .map((p) => text(p))
      .find((t) => !!t && t.includes('£'));
    const tags = (Array.from(el.querySelectorAll('[data-testid="searchResultsCardTags"] span')) as Element[])
      .map((span) => text(span))
      .filter((t): t is string => !!t);

    return {
      siteId,
      externalId: `workhub-${id}`,
      externalUrl: href,
      title,
      companyName,
      location,
      salary,
      jobType: detectJobType(location, ...tags),
      labels: [],
      tags,
    };
  });
}

/**
 * charityjob.co.uk
 */
export function parseCharityJobJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('article.job-card-wrapper[job-id]')) as Element[];
  if (jobElements.length === 0) {
    return looksLikeNoResults(document) ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const id = el.getAttribute('job-id')?.trim();
    const titleEl = el.querySelector('.job-title a');
    const title = text(titleEl) ?? text(el.querySelector('.job-title span'));
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    if (!id || !title || !href) return null;

    // the organisation line is "<charity>, <location>", the charity name is also the logo's title
    const logoLink = el.querySelector('.logo a');
    const organisation = text(el.querySelector('.organisation'));
    const companyName = logoLink?.getAttribute('title')?.trim() || organisation?.split(',')[0]?.trim();
    if (!companyName) return null;
    const location =
      organisation && organisation.startsWith(companyName)
        ? organisation.slice(companyName.length).replace(/^,\s*/, '').trim() || undefined
        : undefined;

    const salary = (Array.from(el.querySelectorAll('.job-summary-item')) as Element[])
      .map((item) => text(item))
      .find((t) => !!t && t.includes('£'));
    const postedAt = text(el.querySelector('.posted-item'));

    return {
      siteId,
      externalId: `charityjob-${id}`,
      externalUrl: href,
      title,
      companyName,
      companyLogo: imageSrc(logoLink?.querySelector('img')),
      location,
      salary,
      jobType: detectJobType(location),
      labels: [],
      tags: [],
      postedAt: parsePostedText(postedAt),
    };
  });
}

/**
 * Lighthouse Futures Trust (lighthousefuturestrust.org.uk/vacancies-2/). Its paid vacancies come from a
 * MyNewTerm widget the page loads with JavaScript; each one links to its own MyNewTerm job page.
 */
export function parseLighthouseFuturesTrustJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('.mnt-vacancy-content-item')) as Element[];
  if (jobElements.length === 0) {
    // the widget loaded but lists nothing: no vacancies right now; no widget at all: the page didn't finish loading
    return document.querySelector('#mnt-parent-container') ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const link = el.querySelector('a.orange-link-wrapper') ?? el.querySelector('a[href*="mynewterm.com"]');
    const href = link?.getAttribute('href')?.trim();
    const titleEl = el.querySelector('.orange-vacancy-title');
    // the title is followed by the reference number in <small>
    const reference = text(titleEl?.querySelector('small'));
    const title = text(titleEl)?.replace(reference ?? '', '').trim();
    if (!href || !title) return null;
    const externalUrl = href.startsWith('//') ? `https:${href}` : href;

    const details = (Array.from(el.querySelectorAll('dd')) as Element[]).map((dd) => ({
      icon: dd.querySelector('i')?.getAttribute('class') ?? '',
      value: text(dd),
    }));
    const location = details.find((d) => d.icon.includes('fa-map-marker'))?.value;
    const contract = details.find((d) => d.icon.includes('fa-clock'))?.value;
    const salary = details.find((d) => d.icon.includes('fa-gbp'))?.value ?? extractGbpSalary(text(el));
    const closes = (Array.from(el.querySelectorAll('div')) as Element[])
      .map((div) => text(div))
      .find((t) => !!t && /^\d+ Days? Remaining/i.test(t));

    return {
      siteId,
      externalId: `lighthouse-${reference ?? externalUrl.split('/').slice(-2).join('-')}`,
      externalUrl,
      title,
      companyName: 'Lighthouse Futures Trust',
      companyLogo: imageSrc(el.querySelector('img')),
      location,
      salary,
      jobType: detectJobType(location),
      labels: [],
      tags: [contract, closes?.split('•')[1]?.trim()].filter((t): t is string => !!t),
    };
  });
}

/**
 * mynewterm.com (schools, colleges and academy trusts). The results are loaded with JavaScript.
 */
export function parseMyNewTermJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('.list-item.job-viewer')) as Element[];
  if (jobElements.length === 0) {
    // the "No results found" box is always on the page, but hidden until a search comes back empty
    const noResults = document.querySelector('#list-box-no-search-results');
    const shown = noResults && !/display:\s*none/i.test(noResults.getAttribute('style') ?? '');
    return shown ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const titleEl = el.querySelector('a.job-title-card');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    const id = el.getAttribute('data-job-ads-id')?.trim() || href?.split('/').slice(-2).join('-');
    if (!title || !href || !id) return null;

    // ex: "St Peter's School 2-18, York, North Yorkshire": the school, then its town and county
    const parts = (text(el.querySelector('dt span')) ?? text(el.querySelector('a.job-title-card + p')))?.split(/,\s*/) ?? [];
    const companyName = (parts.length > 2 ? parts.slice(0, -2) : parts.slice(0, 1)).join(', ');
    if (!companyName) return null;
    const location = parts.length > 2 ? parts.slice(-2).join(', ') : parts[1];

    const details = (Array.from(el.querySelectorAll('dd')) as Element[]).map((dd) => ({
      icon: dd.querySelector('i')?.getAttribute('class') ?? '',
      value: text(dd),
    }));
    const contract = details.find((d) => d.icon.includes('fa-clock'))?.value;
    const salary = details.find((d) => d.icon.includes('fa-pound-sign') || d.icon.includes('fa-gbp'))?.value;
    // ex: "New • Apply by 10:00am, Wednesday 18th Nov, 2026 • Job start: January 2027"
    const closes = text(el.querySelector('.card-footer'))
      ?.match(/Apply by (?:[\d:.]+\s*[ap]m,\s*)?([^•]+)/i)?.[1]
      ?.trim();
    const tags = [contract, closes ? `Closes ${closes}` : undefined].filter((t): t is string => !!t);

    return {
      siteId,
      externalId: `mynewterm-${id}`,
      externalUrl: href.startsWith('//') ? `https:${href}` : href,
      title,
      companyName,
      companyLogo: imageSrc(el.querySelector('img[alt="logo"]')),
      location,
      salary,
      jobType: detectJobType(location, contract),
      labels: [],
      tags,
    };
  });
}

/**
 * gumtree.com jobs. Its "Results from outside your search" section is skipped.
 */
export function parseGumtreeJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = (Array.from(document.querySelectorAll('article[data-q="search-result"]')) as Element[]).filter(
    (el) => !el.closest('[data-q="nearby-results"]'),
  );
  if (jobElements.length === 0) {
    // an empty search still shows the results page (data-q="srp"), just with no results in it
    return document.querySelector('[data-q="srp"]') ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const href = el.querySelector('a[data-q="search-result-anchor"]')?.getAttribute('href')?.split('?')[0];
    const title = text(el.querySelector('[data-q="tile-title"]'));
    const id = href?.split('/').filter(Boolean).pop();
    if (!href || !title || !id) return null;

    // ex: <span>Permanent</span><span>Recruitment Equals One</span>, either of them may be missing
    const locationEl = el.querySelector('[data-q="tile-location"]');
    const details = (Array.from(locationEl?.nextElementSibling?.querySelectorAll('span') ?? []) as Element[])
      .map((span) => text(span))
      .filter((t): t is string => !!t);
    const companyName = details.find((d) => d.startsWith('Recruitment '))?.replace(/^Recruitment\s+/, '');
    if (!companyName) return null;
    const contract = details.find((d) => !d.startsWith('Recruitment '));
    const location = text(locationEl);

    return {
      siteId,
      externalId: `gumtree-${id}`,
      externalUrl: href.startsWith('/') ? `https://www.gumtree.com${href}` : href,
      title,
      companyName,
      companyLogo: imageSrc(el.querySelector('img[data-q="tile-large-logo"]')),
      location,
      salary: text(el.querySelector('[data-testid="price"]')),
      jobType: detectJobType(location, title),
      labels: [],
      tags: contract ? [contract] : [],
      postedAt: parsePostedText(text(el.querySelector('[data-q="tile-posted-date"]'))),
    };
  });
}

/**
 * simplyhired.co.uk
 */
export function parseSimplyHiredJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('[data-testid="searchSerpJob"]')) as Element[];
  if (jobElements.length === 0) {
    // ex: "We could not find any zzqxvjj jobs in Leeds"
    return /we could not find any/i.test(document.body?.textContent ?? '') || looksLikeNoResults(document)
      ? EMPTY_LIST
      : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const id = el.getAttribute('data-jobkey')?.trim();
    const titleEl = el.querySelector('[data-testid="searchSerpJobTitle"] a');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    if (!id || !title || !href) return null;

    const companyName = text(el.querySelector('[data-testid="companyName"]'));
    if (!companyName) return null;
    const location = text(el.querySelector('[data-testid="searchSerpJobLocation"]'));
    const jobTypes = (Array.from(el.querySelectorAll('[data-testid^="jobTypeChip"]')) as Element[])
      .map((chip) => text(chip))
      .filter((t): t is string => !!t);

    return {
      siteId,
      externalId: `simplyhired-${id}`,
      externalUrl: href.startsWith('/') ? `https://www.simplyhired.co.uk${href}` : href,
      title,
      companyName,
      location,
      salary: text(el.querySelector('[data-testid^="salaryChip"]')),
      jobType: detectJobType(location, ...jobTypes),
      labels: [],
      tags: jobTypes,
      // ex: "14d", "5h"
      postedAt: parsePostedText(text(el.querySelector('[data-testid="searchSerpJobDateStamp"]'))),
    };
  });
}

/**
 * jobs.ac.uk (universities, research and education).
 */
export function parseJobsAcUkJobs({ siteId, html }: { siteId: number; html: string }): JobSiteParseResult {
  const document = parseDocument(html);

  const jobElements = Array.from(document.querySelectorAll('.j-search-result__result[data-advert-id]')) as Element[];
  if (jobElements.length === 0) {
    return looksLikeNoResults(document) ? EMPTY_LIST : LIST_NOT_FOUND;
  }

  return toResult(jobElements, (el) => {
    const id = el.getAttribute('data-advert-id')?.trim();
    const titleEl = el.querySelector('.j-search-result__text > a');
    const title = text(titleEl);
    const href = titleEl?.getAttribute('href')?.split('?')[0];
    if (!id || !title || !href) return null;

    const companyName = text(el.querySelector('.j-search-result__employer'));
    if (!companyName) return null;

    const details = (Array.from(el.querySelectorAll('.j-search-result__text > div')) as Element[]).map((div) => text(div) ?? '');
    const location = details.find((d) => d.startsWith('Location:'))?.replace('Location:', '').trim();
    const salary = text(el.querySelector('.j-search-result__info'))?.replace(/^Salary:\s*/, '');
    const department = text(el.querySelector('.j-search-result__department'));
    const closes = text(el.querySelector('.j-search-result__date--blue'));
    const tags = [department, closes ? `Closes ${closes}` : undefined].filter((t): t is string => !!t);

    return {
      siteId,
      externalId: `jobsacuk-${id}`,
      externalUrl: href,
      title,
      companyName,
      location,
      salary,
      jobType: detectJobType(location),
      labels: [],
      tags,
    };
  });
}
