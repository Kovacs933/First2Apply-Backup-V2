import { assert, assertEquals } from '@std/assert';

import { parseJobDescriptionUpdates } from './jobDescriptionParser.ts';
import { TestLogger } from './logger.ts';
import { parseDoingGoodLeedsJobs } from './parsers/ukBoards.ts';

const resultsUrl = new URL('./__fixtures__/jobBoards/doingGoodLeeds.html', import.meta.url);

Deno.test('Doing Good Leeds jobs are read from the VAL jobs board', async () => {
  const result = parseDoingGoodLeedsJobs({ siteId: 31, html: await Deno.readTextFile(resultsUrl) });

  assert(result.listFound);
  assertEquals(result.jobs.length, 1);
  const [job] = result.jobs;
  assertEquals(job.title, 'Communities Development Manager');
  assertEquals(job.companyName, 'Epilepsy Action');
  assertEquals(job.location, 'Yeadon, Leeds, West Yorkshire, United Kingdom');
  assertEquals(job.externalId, 'doinggoodleeds-126238');
  assertEquals(
    job.externalUrl,
    'https://val.org.uk/job/epilepsy-action-yeadon-leeds-west-yorkshire-united-kingdom-9-communities-development-manager/',
  );
  assertEquals(job.tags, ['Full Time']);
  assertEquals(job.postedAt?.slice(0, 10), '2026-10-28');
});

Deno.test('Doing Good Leeds: "no listings" is an empty list, anything else has not loaded yet', () => {
  const empty = parseDoingGoodLeedsJobs({
    siteId: 31,
    html: '<ul class="job_listings"> <li class="no_job_listings_found">There are no listings matching your search.</li></ul>',
  });
  assert(empty.listFound);
  assertEquals(empty.jobs.length, 0);

  assertEquals(parseDoingGoodLeedsJobs({ siteId: 31, html: '<ul class="job_listings"></ul>' }).listFound, false);
});

Deno.test('Doing Good Leeds job page gives the description and the salary', async () => {
  const html = `<div class="pld-job-headinfo"><dl class="pld-job-fields">
      <div class="pld-job-field"><dt>Closing date</dt><dd>9 November 2026</dd></div>
      <div class="pld-job-field"><dt>Salary</dt><dd>£44,394.09 - £46,187.61</dd></div></dl></div>
    <div class="et_pb_module et_pb_post_content"><p><strong>Hours:</strong> Full-time 34.5 hours per week</p>
      <style>.et_pb_post_content p { margin: 0; }</style><ul><li>Lead community projects</li></ul></div>`;
  const updates = await parseJobDescriptionUpdates({
    site: { id: 31, provider: 'doingGoodLeeds' } as never,
    job: {} as never,
    user: {} as never,
    html,
    logger: new TestLogger(),
    supabaseAdminClient: {} as never,
  });

  assertEquals(updates.salary, '£44,394.09 - £46,187.61');
  assert(updates.description?.includes('**Hours:** Full-time 34.5 hours per week'));
  assert(/^-\s+Lead community projects$/m.test(updates.description ?? ''));
  // <style> blocks inside an advert are dropped, not shown as text
  assert(!updates.description?.includes('margin'));
});
