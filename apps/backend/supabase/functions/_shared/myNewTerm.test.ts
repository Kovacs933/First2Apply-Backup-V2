import { assert, assertEquals } from '@std/assert';

import { parseMyNewTermJobs } from './parsers/ukBoards.ts';

const resultsUrl = new URL('./__fixtures__/jobBoards/myNewTerm.html', import.meta.url);

Deno.test('MyNewTerm search results are read from the job cards', async () => {
  const result = parseMyNewTermJobs({ siteId: 28, html: await Deno.readTextFile(resultsUrl) });

  assert(result.listFound);
  assertEquals(result.jobs.length, 1);
  const [job] = result.jobs;
  assertEquals(job.title, 'Strength and Conditioning Coach');
  assertEquals(job.companyName, "St Peter's School 2-18");
  assertEquals(job.location, 'York, North Yorkshire');
  assertEquals(job.externalId, 'mynewterm-228971');
  assertEquals(job.externalUrl, 'https://mynewterm.com/jobs/121724/EDV-2026-SPS2-22917');
  assertEquals(job.salary, '£28,405.00 Annually (Actual)');
  assertEquals(job.companyLogo, 'https://d2x8e1qytet7wf.cloudfront.net/logo-121724.png');
  assertEquals(job.tags, ['Permanent | Full-Time', 'Closes Wednesday 18th Nov, 2026']);
});

Deno.test('MyNewTerm: an empty search shows "No results found", otherwise the results have not loaded yet', () => {
  const notLoaded = parseMyNewTermJobs({
    siteId: 28,
    html: '<div class="viewing-grid-search-results"></div><div id="list-box-no-search-results" style="display: none;">No results found</div>',
  });
  assertEquals(notLoaded.listFound, false);

  const noResults = parseMyNewTermJobs({
    siteId: 28,
    html: '<div class="viewing-grid-search-results"></div><div id="list-box-no-search-results" style="display: block;">No results found</div>',
  });
  assert(noResults.listFound);
  assertEquals(noResults.jobs.length, 0);
});
