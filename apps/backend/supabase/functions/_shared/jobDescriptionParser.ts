import { DbSchema, Job, JobSite, SiteProvider, User } from '@first2apply/core';
import { SupabaseClient } from '@supabase/supabasefork';
import { DOMParser, Element } from 'https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts';
import turndown from 'turndown';

import { parseCustomJobDescription } from './customJobsParser.ts';
import { ILogger } from './logger.ts';

type SiteProviderQuerySelectors = {
  description: string[];
};

const SITE_PROVIDER_QUERY_SELECTORS: Record<SiteProvider, SiteProviderQuerySelectors> = {
  [SiteProvider.linkedin]: {
    description: [
      '.description__text .show-more-less-html__markup',
      '.jobs-box__html-content > .job-details-module__content',
      '.jobs-description__container .jobs-box__html-content',
      '.job-details-module.artdeco-card',
      'div[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]',
    ],
  },
  [SiteProvider.glassdoor]: {
    description: [
      '[data-brandviews*="jobview-description"]',
      '.JobDetails_JobDescriptionUpdates__uW_fK',
      '.JobDetails_jobDescription__uW_fK',
    ],
  },
  [SiteProvider.indeed]: {
    description: [
      '#JobDescriptionUpdatesText',
      '#jobDescriptionText',
      '.simple-job-description-html',
      'p.error-description',
    ],
  },
  [SiteProvider.remoteok]: {
    description: ['.description'],
  },
  [SiteProvider.weworkremotely]: {
    description: ['.lis-container__job__content__description'],
  },
  [SiteProvider.flexjobs]: {
    description: ['#job-description'], // paywalled
  },
  [SiteProvider.dice]: {
    description: [`#jobDescription`, '.job-description', '[class*="job-detail-description-module"]'],
  },
  [SiteProvider.bestjobs]: {
    description: ['div.relative.bg-surface div.p-4 div.mt-8.pt-8.border-t.border-input.prose'],
  },
  [SiteProvider.echojobs]: {
    description: ['#jobDescriptionText'],
  },
  [SiteProvider.remotive]: {
    description: ['section div.tw-mt-8 > div.left > div'],
  },
  [SiteProvider.remoteio]: {
    description: ['#job-description', '[data-testid="text-job-description"]'],
  },
  [SiteProvider.builtin]: {
    description: ['.job-post-item .container.py-lg .row > .col-12 > .position-relative'],
  },
  [SiteProvider.naukri]: {
    description: ['.description', '.styles_JDC__dang-inner-html__h0K4t'],
  },
  [SiteProvider.robertHalf]: {
    description: ['div[data-testid=job-description]'],
  },
  [SiteProvider.zipRecruiter]: {
    description: ['div.job-body', 'div.job_description', 'section.company_description'],
  },
  [SiteProvider.usaJobs]: {
    description: ['.apply-joa-defaults'],
  },
  [SiteProvider.talent]: {
    description: ['.sc-e78c1cd5-10.sc-e78c1cd5-11.sc-207c7d5e-10.dwTTNY.gdYndp.jkXeTb > p'],
  },
  [SiteProvider.hiringCafe]: {
    description: ['article.prose', 'article[class*="prose"]'],
  },
  [SiteProvider.reed]: {
    description: ['[data-qa="job-description"]', '[itemprop="description"]'],
  },
  [SiteProvider.totaljobs]: {
    description: ['[data-at="job-ad-content"]', '[data-at="section-text-jobDescription-content"]'],
  },
  [SiteProvider.cvLibrary]: {
    description: ['[class*="JobView_jobDescription"]', '.job__description'],
  },
  [SiteProvider.adzuna]: {
    description: ['section.adp-body', '.adp-body'],
  },
  [SiteProvider.nhsJobs]: {
    description: ['#maincontent .wrap-paragraphs'],
  },
  [SiteProvider.workHub]: {
    description: ['.rawHtmlContainer'],
  },
  [SiteProvider.charityJob]: {
    description: ['.job-description'],
  },
  [SiteProvider.jobsAcUk]: {
    description: ['#job-description'],
  },
  // read from the MyNewTerm page's JobPosting data instead (parseLighthouseFuturesTrustJobDescription)
  [SiteProvider.lighthouseFuturesTrust]: {
    description: ['.vacancy-description'],
  },
  [SiteProvider.custom]: {
    description: ['#job-description'],
  },
};

export type JobDescriptionUpdates = Partial<Pick<Job, 'description' | 'salary' | 'tags' | 'location'>>;

const turndownService = new turndown({
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

/**
 * Parse the job description from the HTML.
 */
export async function parseJobDescriptionUpdates({
  site,
  html,
  job,
  user,
  ...context
}: {
  site: JobSite;
  job: Job;
  html: string;
  user: User;

  // dependencies
  logger: ILogger;
  supabaseAdminClient: SupabaseClient<DbSchema, 'public'>;
}): Promise<JobDescriptionUpdates> {
  const updates = await parseProviderJobDescription({ site, html, job, user, ...context });
  // the job's own page is more reliable than the search results card, so prefer its location
  const location = parseJobPageLocation({ provider: site.provider, html });
  return location ? { ...updates, location } : updates;
}

async function parseProviderJobDescription({
  site,
  html,
  job,
  user,
  ...context
}: {
  site: JobSite;
  job: Job;
  html: string;
  user: User;
  logger: ILogger;
  supabaseAdminClient: SupabaseClient<DbSchema, 'public'>;
}): Promise<JobDescriptionUpdates> {
  switch (site.provider) {
    case SiteProvider.linkedin:
      return parseLinkedinJobDescription({ html });
    case SiteProvider.indeed:
      return parseIndeedJobDescription({ html });
    case SiteProvider.glassdoor:
      return parseGlassdoorJobDescription({ html });
    case SiteProvider.weworkremotely:
      return parseWeWorkRemotelyJobDescription({ html });
    case SiteProvider.remoteok:
      return parseRemoteOkJobDescription({ html });
    case SiteProvider.dice:
      return parseDiceJobDescription({ html });
    case SiteProvider.flexjobs:
      return parseFlexJobsJobDescription({ html });
    case SiteProvider.builtin:
      return parseBuiltInJobDescription({ html });
    case SiteProvider.bestjobs:
      return parseBestJobsJobDescription({ html });
    case SiteProvider.echojobs:
      return parseEchoJobsJobDescription({ html });
    case SiteProvider.remotive:
      return parseRemotiveJobDescription({ html });
    case SiteProvider.remoteio:
      return parseRemoteIoJobDescription({ html });
    case SiteProvider.naukri:
      return parseNaukriJobDescription({ html });
    case SiteProvider.robertHalf:
      return parseRobertHalfJobDescription({ html });
    case SiteProvider.zipRecruiter:
      return parseZipRecruiterJobDescription({ html });
    case SiteProvider.usaJobs:
      return parseUSAJobsJobDescription({ html });
    case SiteProvider.talent:
      return parseTalentJobDescription({ html });
    case SiteProvider.hiringCafe:
      return parseHiringCafeJobDescription({ html });
    case SiteProvider.nhsJobs:
      return parseNhsJobDescription({ html });
    case SiteProvider.reed:
    case SiteProvider.totaljobs:
    case SiteProvider.cvLibrary:
    case SiteProvider.adzuna:
    case SiteProvider.workHub:
    case SiteProvider.charityJob:
    case SiteProvider.jobsAcUk:
      return parseJobDescriptionWithSelectors({ provider: site.provider, html });
    case SiteProvider.lighthouseFuturesTrust:
      return parseLighthouseFuturesTrustJobDescription({ html });
    case SiteProvider.custom:
      return await parseCustomJobDescription({ html, user, job, ...context });
  }
}

/**
 * Read the job's location from its own page: the schema.org JobPosting data most job boards embed,
 * falling back to LinkedIn's header. Returns undefined when the page doesn't say.
 */
export function parseJobPageLocation({ provider, html }: { provider: SiteProvider; html: string }): string | undefined {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (!document) return undefined;

  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const location = jobPostingLocation(JSON.parse((script as Element).textContent));
      if (location) return location;
    } catch {
      // not valid JSON, try the next one
    }
  }

  if (provider === SiteProvider.linkedin) {
    // logged in: "Concord, MA · 23 hours ago · 50 applicants"; logged out: the first header bullet
    const header =
      document.querySelector('.job-details-jobs-unified-top-card__tertiary-description-container') ??
      document.querySelector('.job-details-jobs-unified-top-card__primary-description-container') ??
      document.querySelector('.topcard__flavor--bullet');
    const location = header?.textContent?.split('·')[0];
    if (location) return cleanLocation(location);
  }

  return undefined;
}

function jobPostingLocation(data: unknown): string | undefined {
  if (Array.isArray(data)) {
    for (const item of data) {
      const location = jobPostingLocation(item);
      if (location) return location;
    }
    return undefined;
  }
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  if (obj['@graph']) return jobPostingLocation(obj['@graph']);
  if (obj['@type'] !== 'JobPosting') return undefined;

  const places = Array.isArray(obj.jobLocation) ? obj.jobLocation : [obj.jobLocation];
  const names = places
    .map((place) => {
      const address = (place as { address?: Record<string, unknown> } | undefined)?.address;
      if (!address || typeof address !== 'object') return undefined;
      const country = address.addressCountry;
      const parts = [
        address.addressLocality,
        address.addressRegion,
        typeof country === 'object' && country ? (country as { name?: unknown }).name : country,
      ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
      // don't repeat e.g. "London, London"
      return Array.from(new Set(parts.map((part) => part.trim()))).join(', ') || undefined;
    })
    .filter((name): name is string => !!name);
  if (names.length) return cleanLocation(Array.from(new Set(names)).join(' / '));

  return obj.jobLocationType === 'TELECOMMUTE' ? 'Remote' : undefined;
}

function cleanLocation(location: string): string | undefined {
  const cleaned = location
    .replace(/\((remote|on-site|hybrid)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

/**
 * Extract common dom elements from the HTML.
 */
function extractCommonDomElements({ provider, html }: { provider: SiteProvider; html: string }) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (!document) throw new Error('Could not parse html');

  // extract description element
  const descriptionSelectors = SITE_PROVIDER_QUERY_SELECTORS[provider].description;
  let descriptionContainer: Element | null = null;
  for (const selector of descriptionSelectors) {
    const container = document.querySelector(selector);
    if (container && container.textContent.trim().length > 0) {
      descriptionContainer = container;
      break;
    }
  }

  return {
    document,
    descriptionContainer,
  };
}

/**
 * Parse a linkedin job description from the HTML.
 */
function parseLinkedinJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.linkedin,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    const sanitizedHtml = descriptionContainer.innerHTML
      .replaceAll(/<br><br><\/strong>/g, '</strong><br><br>')
      .replaceAll(/<br><\/strong>/g, '</strong><br>')
      .replaceAll(/(<br>)+<\/li>/g, '</li>');

    description = turndownService.turndown(sanitizedHtml);
  }

  return {
    description,
  };
}

/**
 * Parse a indeed job description from the HTML.
 */
function parseIndeedJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  // First try to extract from the global JavaScript object
  const updatesFromScriptTag = extractFromScriptTag();
  if (updatesFromScriptTag) {
    // If we found updates, use them
    return updatesFromScriptTag;
  }

  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.indeed,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    // TODO: get rid of the ** markdown in the description
    // turndownService.addRule("noBold", {
    //   filter: ["b"],
    //   replacement: function (content: string) {
    //     // Return the content wrapped in <strong> tags instead of Markdown bold syntax
    //     return "<strong>" + content + "</strong>";
    //   },
    // });
    // const sanitizedHtml = descriptionContainer.innerHTML
    //   .replace(/<b>/gi, "<strong>")
    //   .replace(/<\/b>/gi, "</strong>");

    description = turndownService.turndown(descriptionContainer.innerHTML).replace(/\*\s\s\n/gi, '*');
  }

  // helpers
  function extractFromScriptTag() {
    const document = new DOMParser().parseFromString(html, 'text/html');
    if (!document) return;

    // Find the <script> tags that assign `window._initialData`. Indeed can render multiple
    // of these, and some are plain JS object literals (not valid JSON), so try each one and
    // skip the ones that don't parse instead of failing the whole extraction.
    const initialDataScripts = (Array.from(document.querySelectorAll('script')) as Element[]).filter((script) =>
      script.textContent.includes('window._initialData'),
    );

    for (const script of initialDataScripts) {
      // strip the `window._initialData =` prefix and the trailing `;` to isolate the JSON string
      const textContent = script.textContent.trim();
      const jsonString = textContent.slice(
        textContent.indexOf('window._initialData={') + 'window._initialData='.length,
        textContent.lastIndexOf('}') + 1,
      );

      let globalData: any;
      try {
        globalData = JSON.parse(jsonString);
      } catch {
        // not valid JSON (e.g. a JS object literal) -> try the next script
        continue;
      }
      // Extract job data from the hostQueryExecutionResult
      const jobData = globalData?.hostQueryExecutionResult?.data?.jobData?.results?.[0]?.job;

      if (jobData) {
        let description: string | undefined;
        let salary: string | undefined;
        let tags: string[] = [];

        // Extract description - use the text version which is already clean
        if (jobData.description?.text) {
          description = jobData.description.text;
        } else if (jobData.description?.html) {
          // Fallback to HTML version and convert to markdown
          description = turndownService.turndown(jobData.description.html);
        }

        // Extract salary information
        if (globalData.salaryInfoModel) {
          const salaryModel = globalData.salaryInfoModel;
          if (salaryModel.salaryText) {
            salary = salaryModel.salaryText;
          } else if (salaryModel.salaryMin && salaryModel.salaryMax) {
            const currency =
              ({ USD: '$', GBP: '£', EUR: '€' } as Record<string, string>)[salaryModel.salaryCurrency] ?? '';
            const type =
              salaryModel.salaryType === 'HOURLY'
                ? ' per hour'
                : salaryModel.salaryType === 'YEARLY'
                  ? ' per year'
                  : '';
            salary = `${currency}${salaryModel.salaryMin} - ${currency}${salaryModel.salaryMax}${type}`;
          }
        }

        // Extract tags from various sources
        if (jobData.jobTypes) {
          tags.push(...jobData.jobTypes.map((type: { label: string }) => type.label));
        }

        if (jobData.benefits) {
          tags.push(...jobData.benefits.map((benefit: { label: string }) => benefit.label));
        }

        // Remove duplicates and clean up tags
        tags = Array.from(new Set(tags)).filter((tag) => tag && tag.length > 0);

        // Build metadata table
        const metadata: { [key: string]: string } = {};

        if (jobData.datePublished) {
          const datePosted = new Date(jobData.datePublished);
          metadata['Date Posted'] = datePosted.toLocaleDateString();
        }

        if (jobData.employer?.ugcStats?.ratings?.overallRating?.value) {
          const rating = jobData.employer.ugcStats.ratings.overallRating.value;
          const reviewCount = jobData.employer.ugcStats.globalReviewCount || 0;
          metadata['Company Rating'] = `${rating}/5 (${reviewCount.toLocaleString()} reviews)`;
        }

        // Create metadata section
        let metadataTable = '';
        if (Object.keys(metadata).length > 0) {
          metadataTable = '**Job Information:**\n\n';

          for (const [key, value] of Object.entries(metadata)) {
            metadataTable += `**${key}:** ${value}\n\n`;
          }

          metadataTable += '---\n\n';
        }

        // Prepend metadata table to description
        if (description) {
          description = metadataTable + description;
        }

        return {
          description,
          salary,
          tags: tags.length > 0 ? tags : undefined,
        };
      }
    }
  }

  return {
    description,
  };
}

/**
 * Parse a glassdoor job description from the HTML.
 */
function parseGlassdoorJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.glassdoor,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a RemoteOk job description from the HTML.
 */
function parseRemoteOkJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { document, descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.remoteok,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    const nodeToRemove = document.querySelector('.company_profile');
    if (nodeToRemove) {
      nodeToRemove.remove();
    }
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a WeWorkRemotely job description from the HTML.
 */
function parseWeWorkRemotelyJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.weworkremotely,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a Dice job description from the HTML.
 */
function parseDiceJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.dice,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a FlexJobs job description from the HTML.
 */
function parseFlexJobsJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.flexjobs,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a Bestjobs job description from the HTML.
 */
function parseBestJobsJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.bestjobs,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a Echojobs job description from the HTML.
 */
function parseEchoJobsJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.echojobs,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a Remotive job description from the HTML.
 */
function parseRemotiveJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const parseOwnHtml = ({ html }: { html: string }) => {
    const { descriptionContainer } = extractCommonDomElements({
      provider: SiteProvider.remotive,
      html,
    });
    let description: string | undefined;
    if (descriptionContainer) {
      description = turndownService.turndown(descriptionContainer.innerHTML) || 'job might be archived';
    }
    return { description };
  };

  // quite often, remotive redirects to an indeed job page so try to parse the description from there
  let description: string | undefined;
  const parsers = [
    parseOwnHtml, // try to parse the description from the remotive page first
    parseIndeedJobDescription,
    parseLinkedinJobDescription,
    parseTalentJobDescription,
  ];
  for (const parser of parsers) {
    const { description: parsedDescription } = parser({ html });
    if (parsedDescription) {
      description = parsedDescription;
      break;
    }
  }

  return {
    description,
  };
}

/**
 * Parse a Remoteio job description from the HTML.
 */
function parseRemoteIoJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.remoteio,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a BuiltIn job description from the HTML.
 */
function parseBuiltInJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.builtin,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a Naukri job description from the HTML.
 */
function parseNaukriJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.naukri,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a RobertHalf job description from the HTML.
 */
function parseRobertHalfJobDescription(_: { html: string }): JobDescriptionUpdates {
  // the entire JD is parsed from the list so no need to parse the description

  return {};
}

/**
 * Parse a ZipRecruiter job description from the HTML.
 */
function parseZipRecruiterJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.zipRecruiter,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a USAJobs job description from the HTML.
 */
function parseUSAJobsJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.usaJobs,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a Talent job description from the HTML.
 */
function parseTalentJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.talent,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a job description for boards that only need their description selectors (most UK boards).
 */
function parseJobDescriptionWithSelectors({
  provider,
  html,
}: {
  provider: SiteProvider;
  html: string;
}): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({ provider, html });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Lighthouse Futures Trust vacancies open on MyNewTerm, whose page carries the advert in its schema.org JobPosting
 * data (the description is HTML that has been escaped once more inside the JSON).
 */
function parseLighthouseFuturesTrustJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (!document) return {};
  const findPosting = (data: unknown): Record<string, unknown> | undefined => {
    if (Array.isArray(data)) return data.map(findPosting).find(Boolean);
    if (!data || typeof data !== 'object') return undefined;
    const obj = data as Record<string, unknown>;
    if (obj['@graph']) return findPosting(obj['@graph']);
    return obj['@type'] === 'JobPosting' ? obj : undefined;
  };
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    let posting: Record<string, unknown> | undefined;
    try {
      posting = findPosting(JSON.parse((script as Element).textContent));
    } catch {
      continue;
    }
    if (!posting || typeof posting.description !== 'string') continue;
    // "&lt;p&gt;..." -> "<p>..."
    const decoded = new DOMParser().parseFromString(`<div>${posting.description}</div>`, 'text/html')?.querySelector('div')
      ?.textContent;
    const value = (posting.baseSalary as { value?: { value?: unknown; unitText?: unknown } } | undefined)?.value;
    const salary =
      typeof value?.value === 'number'
        ? `£${value.value.toLocaleString('en-GB')}${value.unitText === 'YEAR' ? ' a year' : value.unitText === 'HOUR' ? ' an hour' : ''}`
        : undefined;
    return {
      description: decoded ? turndownService.turndown(decoded) : undefined,
      ...(salary && { salary }),
    };
  }
  return {};
}

/**
 * Parse an NHS Jobs advert. The page repeats every section twice (a mobile and a desktop
 * version), so the mobile copies are removed before converting it.
 */
function parseNhsJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.nhsJobs,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    (Array.from(descriptionContainer.querySelectorAll('.show-mobile')) as Element[]).forEach((el) => el.remove());
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}

/**
 * Parse a Hiring Cafe job description from the HTML.
 */
function parseHiringCafeJobDescription({ html }: { html: string }): JobDescriptionUpdates {
  const { descriptionContainer } = extractCommonDomElements({
    provider: SiteProvider.hiringCafe,
    html,
  });

  let description: string | undefined;
  if (descriptionContainer) {
    description = turndownService.turndown(descriptionContainer.innerHTML);
  }

  return {
    description,
  };
}
