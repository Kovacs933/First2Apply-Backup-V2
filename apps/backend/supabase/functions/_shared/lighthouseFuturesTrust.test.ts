import { assert, assertEquals } from '@std/assert';

import { parseJobDescriptionUpdates } from './jobDescriptionParser.ts';
import { TestLogger } from './logger.ts';
import { parseLighthouseFuturesTrustJobs } from './parsers/ukBoards.ts';

const vacanciesUrl = new URL('./__fixtures__/jobBoards/lighthouseFuturesTrust.html', import.meta.url);

Deno.test('Lighthouse Futures Trust vacancies are read from the MyNewTerm widget', async () => {
  const result = parseLighthouseFuturesTrustJobs({ siteId: 27, html: await Deno.readTextFile(vacanciesUrl) });

  assert(result.listFound);
  assertEquals(result.jobs.length, 1);
  const [job] = result.jobs;
  assertEquals(job.title, 'Supported Intern Job Coach');
  assertEquals(job.companyName, 'Lighthouse Futures Trust');
  assertEquals(job.externalId, 'lighthouse-EDV/2026/LFT/37524');
  assertEquals(
    job.externalUrl,
    'https://mynewterm.com/school/Lighthouse-Futures-Trust/146090/EDV-2026-LFT-37524/Supported-Intern-Job-Coach',
  );
  assertEquals(job.location, 'Carlton House, 3-5 Alma Road, Leeds, West Yorkshire, LS6 2AH');
  assert(job.salary?.startsWith('£27,770.00 Annually'));
  assertEquals(job.tags, ['Permanent | Full-Time', 'Apply by Midnight, Sunday 1st Nov, 2026']);
});

Deno.test('Lighthouse Futures Trust: no widget means the page did not finish loading', () => {
  const notLoaded = parseLighthouseFuturesTrustJobs({ siteId: 27, html: '<html><body><p>Current Vacancies</p></body></html>' });
  assertEquals(notLoaded.listFound, false);

  const noVacancies = parseLighthouseFuturesTrustJobs({
    siteId: 27,
    html: '<html><body><div id="mnt-parent-container"><p>No vacancies</p></div></body></html>',
  });
  assert(noVacancies.listFound);
  assertEquals(noVacancies.jobs.length, 0);
});

Deno.test('Lighthouse Futures Trust job description comes from the MyNewTerm JobPosting data', async () => {
  // MyNewTerm escapes the description's HTML once more inside the JSON
  const posting = {
    '@context': 'http://schema.org',
    '@graph': [
      {
        '@type': 'JobPosting',
        title: 'Supported Intern Job Coach',
        description: '&lt;p&gt;Lighthouse Futures Trust is a specialist post-16 college in Leeds.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Support interns at work&lt;/li&gt;&lt;/ul&gt;',
        baseSalary: { '@type': 'MonetaryAmount', currency: 'GBP', value: { '@type': 'QuantitativeValue', value: 27770, unitText: 'YEAR' } },
        jobLocation: { '@type': 'Place', address: { addressLocality: 'Leeds', addressRegion: 'West Yorkshire', addressCountry: 'UK' } },
      },
    ],
  };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(posting)}</script></head><body></body></html>`;

  const updates = await parseJobDescriptionUpdates({
    site: { id: 27, provider: 'lighthouseFuturesTrust' } as never,
    job: {} as never,
    user: {} as never,
    html,
    logger: new TestLogger(),
    supabaseAdminClient: {} as never,
  });

  assert(updates.description?.includes('Lighthouse Futures Trust is a specialist post-16 college in Leeds.'));
  assert(/^-\s+Support interns at work$/m.test(updates.description ?? ''));
  assertEquals(updates.salary, '£27,770 a year');
  assertEquals(updates.location, 'Leeds, West Yorkshire, UK');
});
