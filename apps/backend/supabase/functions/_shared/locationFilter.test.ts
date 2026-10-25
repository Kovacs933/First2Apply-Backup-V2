import { assert, assertEquals } from '@std/assert';

import { checkJobLocation, isOutsideUk } from './locationFilter.ts';

const leeds20 = { uk_only: true, location_center: 'LS6 2NU', location_radius_miles: 20 };

Deno.test('isOutsideUk spots US, Canadian and other countries', () => {
  for (const place of ['Chicago, IL', 'Tampa, FL', 'Roanoke, VA', 'Concord, MA', 'Toronto, ON', 'Berlin, Germany', 'Dublin, Ireland']) {
    assert(isOutsideUk(place), place);
  }
  for (const place of ['Leeds, England, United Kingdom', 'Belfast, Northern Ireland', 'Bradford', 'London Area, United Kingdom']) {
    assert(!isOutsideUk(place), place);
  }
});

// these call postcodes.io for real
Deno.test('checkJobLocation keeps jobs near LS6 2NU and hides far or foreign ones', async () => {
  const check = (location: string, jobType?: string) => checkJobLocation({ location, jobType, config: leeds20 });

  assertEquals((await check('Leeds, England, United Kingdom')).excluded, false);
  assertEquals((await check('Bradford, England, United Kingdom')).excluded, false);
  assertEquals((await check('Harrogate, North Yorkshire')).excluded, false);
  assertEquals((await check('Headingley, Leeds')).excluded, false);
  assertEquals((await check('LS1 4AP')).excluded, false);

  const london = await check('London, England, United Kingdom');
  assertEquals(london.excluded, true);
  assert(london.reason?.includes('miles from LS6 2NU'), london.reason);
  assertEquals((await check('Manchester Area, United Kingdom')).excluded, true);

  assertEquals((await check('Chicago, IL')).excluded, true);
  assertEquals((await check('Zurich')).excluded, true);

  // remote UK and unknown locations stay
  assertEquals((await check('United Kingdom (Remote)')).excluded, false);
  assertEquals((await check('Anywhere', 'remote')).excluded, false);
  assertEquals((await check('United Kingdom')).excluded, false);
  assertEquals((await check('')).excluded, false);
});

Deno.test('checkJobLocation with UK only and no distance keeps any UK place', async () => {
  const config = { uk_only: true, location_center: '', location_radius_miles: null };
  assertEquals((await checkJobLocation({ location: 'London, England, United Kingdom', config })).excluded, false);
  assertEquals((await checkJobLocation({ location: 'Chicago, IL', config })).excluded, true);
});

Deno.test('checkJobLocation does nothing when the filter is off, and keeps jobs if postcodes.io is down', async () => {
  const off = { uk_only: false, location_center: '', location_radius_miles: null };
  assertEquals((await checkJobLocation({ location: 'Chicago, IL', config: off })).excluded, false);

  const down = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
  assertEquals((await checkJobLocation({ location: 'Wakefield', config: leeds20, fetchFn: down })).excluded, false);
});
