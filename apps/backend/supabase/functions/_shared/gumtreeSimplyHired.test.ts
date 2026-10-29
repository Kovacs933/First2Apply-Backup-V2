import { assert, assertEquals } from '@std/assert';

import { parseJobDescriptionUpdates } from './jobDescriptionParser.ts';
import { TestLogger } from './logger.ts';
import { parseGumtreeJobs, parseSimplyHiredJobs } from './parsers/ukBoards.ts';

const fixture = (name: string) => Deno.readTextFile(new URL(`./__fixtures__/jobBoards/${name}.html`, import.meta.url));

const describe = (provider: string, html: string) =>
  parseJobDescriptionUpdates({
    site: { id: 0, provider } as never,
    job: {} as never,
    user: {} as never,
    html,
    logger: new TestLogger(),
    supabaseAdminClient: {} as never,
  });

Deno.test('Gumtree jobs are read from the results, skipping "Results from outside your search"', async () => {
  const result = parseGumtreeJobs({ siteId: 29, html: await fixture('gumtree') });

  assert(result.listFound);
  assertEquals(
    result.jobs.map((job) => job.title),
    ['Housing Support Worker', 'Health Care Assistant'],
  );
  const [job, noContract] = result.jobs;
  assertEquals(job.companyName, 'Equals One');
  assertEquals(job.location, 'Leeds, West Yorkshire');
  assertEquals(job.externalId, 'gumtree-5419163851');
  assertEquals(job.externalUrl, 'https://www.gumtree.com/p/social-care-jobs/housing-support-worker/5419163851');
  assertEquals(job.salary, '£29,077 per year');
  assertEquals(job.tags, ['Permanent']);
  assert(job.postedAt);
  assertEquals(noContract.companyName, 'Exemplar Health Care');
  assertEquals(noContract.tags, []);
});

Deno.test('Gumtree: an empty results page is an empty list, anything else has not loaded yet', () => {
  const empty = parseGumtreeJobs({ siteId: 29, html: '<div data-q="srp"><div data-q="tabs"></div></div>' });
  assert(empty.listFound);
  assertEquals(empty.jobs.length, 0);

  assertEquals(parseGumtreeJobs({ siteId: 29, html: '<html><body></body></html>' }).listFound, false);
});

Deno.test('SimplyHired jobs are read from the results', async () => {
  const result = parseSimplyHiredJobs({ siteId: 30, html: await fixture('simplyHired') });

  assert(result.listFound);
  assertEquals(result.jobs.length, 1);
  const [job] = result.jobs;
  assertEquals(job.title, 'Support Worker Female Only');
  assertEquals(job.companyName, 'Action4care');
  assertEquals(job.location, 'Wakefield');
  assertEquals(job.externalId, 'simplyhired-_FOYHmBhvdQ1q21XOAm-PvI_R-BrWaJUr4d07aNW9r4yoliVZg5gdA');
  assertEquals(job.externalUrl, 'https://www.simplyhired.co.uk/job/_FOYHmBhvdQ1q21XOAm-PvI_R-BrWaJUr4d07aNW9r4yoliVZg5gdA');
  assertEquals(job.salary, '£12.87 - £13.37 an hour');
  assertEquals(job.tags, ['12 hour shift']);
  assert(job.postedAt);
});

Deno.test('SimplyHired: "We could not find any" is an empty list, anything else has not loaded yet', () => {
  const empty = parseSimplyHiredJobs({ siteId: 30, html: '<main><h1>0 zzqxvjj jobs in Leeds</h1><p>We could not find any zzqxvjj jobs in Leeds</p></main>' });
  assert(empty.listFound);
  assertEquals(empty.jobs.length, 0);

  assertEquals(parseSimplyHiredJobs({ siteId: 30, html: '<html><body></body></html>' }).listFound, false);
});

Deno.test('Gumtree and SimplyHired job descriptions come from the job page', async () => {
  const gumtree = await describe(
    'gumtree',
    '<div><h2>Description</h2><p itemprop="description">Housing Support Worker<br><br>Location: Leeds</p></div>',
  );
  assert(gumtree.description?.includes('Location: Leeds'));

  const simplyHired = await describe(
    'simplyHired',
    '<div data-testid="viewJobBodyJobFullDescriptionContent"><p><b>Please note we cannot offer COS.</b></p><ul><li>Cooking</li></ul></div>',
  );
  assert(simplyHired.description?.includes('**Please note we cannot offer COS.**'));
  assert(/^-\s+Cooking$/m.test(simplyHired.description ?? ''));
});
