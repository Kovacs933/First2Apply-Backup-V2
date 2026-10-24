import { JobSite } from '@first2apply/core';
import { assert, assertEquals, assertThrows } from '@std/assert';

import { getJobSite } from './jobListParser.ts';
import { cleanParsedJobs, safeMapJobs } from './parsers/parserHelpers.ts';

const linkedin = {
  id: 1,
  name: 'LinkedIn',
  urls: ['https://www.linkedin.com'],
  blacklisted_paths: ['/', '/jobs/'],
  provider: 'linkedin',
  deprecated: false,
} as unknown as JobSite;

Deno.test('getJobSite rejects a board home page with a friendly message', () => {
  const err = assertThrows(() =>
    getJobSite({ allJobSites: [linkedin], url: 'https://www.linkedin.com/jobs/', hasCustomJobsParsing: false }),
  ) as Error;
  assert(err.message.includes('home page'));
  assert(err.message.includes('Save Anyway'));
});

Deno.test('getJobSite accepts the home page when "Save Anyway" is used', () => {
  const site = getJobSite({
    allJobSites: [linkedin],
    url: 'https://www.linkedin.com/jobs/',
    hasCustomJobsParsing: false,
    skipSearchParamsCheck: true,
  });
  assertEquals(site.id, 1);
});

Deno.test('getJobSite accepts a normal search url', () => {
  const site = getJobSite({
    allJobSites: [linkedin],
    url: 'https://www.linkedin.com/jobs/search/?keywords=designer',
    hasCustomJobsParsing: false,
  });
  assertEquals(site.id, 1);
});

Deno.test('getJobSite explains unsupported sites in plain English', () => {
  const err = assertThrows(() =>
    getJobSite({ allJobSites: [linkedin], url: 'https://example.com/jobs?q=x', hasCustomJobsParsing: false }),
  ) as Error;
  assert(err.message.includes("isn't one of the supported job boards"));
});

Deno.test('safeMapJobs skips a card that throws', () => {
  const result = safeMapJobs([1, 2, 3], (n) => {
    if (n === 2) throw new Error('broken card');
    return n * 10;
  });
  assertEquals(result, [10, null, 30]);
});

Deno.test('cleanParsedJobs resolves relative urls, trims and removes duplicates', () => {
  const jobs = cleanParsedJobs(
    [
      { externalId: ' a1 ', externalUrl: '/jobs/a1', title: ' Designer ', companyName: 'Acme', location: 'London' },
      { externalId: 'a1', externalUrl: '/jobs/a1', title: 'Designer', companyName: 'Acme', location: 'London' },
      { externalId: 'a2', externalUrl: '/jobs/a2', title: 'designer', companyName: 'ACME', location: 'London' },
      { externalId: 'a3', externalUrl: '/jobs/a3', title: 'Designer', companyName: 'Acme', location: 'Leeds' },
      { externalId: '', externalUrl: '/jobs/x', title: 'No id', companyName: 'Acme' },
    ],
    'https://www.example.com/search?q=designer',
  );
  assertEquals(
    jobs.map((j) => j.externalId),
    ['a1', 'a3'],
  );
  assertEquals(jobs[0].externalUrl, 'https://www.example.com/jobs/a1');
  assertEquals(jobs[0].title, 'Designer');
});

import { removeCrossBoardDuplicates } from './crossBoardDedupe.ts';

Deno.test('removeCrossBoardDuplicates drops the same job seen on another board', () => {
  const existing = [{ externalId: 'li-1', title: 'Senior Designer', companyName: 'Acme Ltd', location: 'London, UK' }];
  const { jobs, duplicates } = removeCrossBoardDuplicates(
    [
      // same job on Indeed: different id, slightly different formatting
      { externalId: 'in-9', title: 'Senior Designer (Remote)', companyName: 'ACME', location: 'London' },
      // same title + company but a different city -> keep
      { externalId: 'in-10', title: 'Senior Designer', companyName: 'Acme', location: 'Manchester' },
      // exactly the same posting id -> left for the db to ignore, not counted as cross-board
      { externalId: 'li-1', title: 'Senior Designer', companyName: 'Acme Ltd', location: 'London, UK' },
      // brand new job -> keep
      { externalId: 'in-11', title: 'Product Manager', companyName: 'Acme', location: 'London' },
      // repeated twice in the same batch with different ids -> keep the first only
      { externalId: 'gd-1', title: 'Data Analyst', companyName: 'Beta Inc', location: null },
      { externalId: 'zr-1', title: 'Data analyst', companyName: 'Beta', location: 'Leeds' },
    ],
    existing,
  );
  assertEquals(
    duplicates.map((j) => j.externalId),
    ['in-9', 'zr-1'],
  );
  assertEquals(
    jobs.map((j) => j.externalId),
    ['in-10', 'li-1', 'in-11', 'gd-1'],
  );
});
