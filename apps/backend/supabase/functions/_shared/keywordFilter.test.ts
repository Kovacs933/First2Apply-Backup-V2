import { assertEquals } from '@std/assert';

import { findAvoidedWord, parseAvoidWords } from './keywordFilter.ts';

// written in the filters box in Oct 2026, after clicking the three example buttons
const RULES = `Hide jobs paying less than £30,000 a year
Hide senior, lead or manager roles
Only show remote or hybrid jobs
Avoid Warehouse, Hide senior,Avoid lead or manager roles, Avoid Nurse, Avoid recruiter, avoid solicitor, Avoid Healthcare`;

Deno.test('the "Avoid" and "Hide" words are read from the filters box, other rules are left to the AI', () => {
  assertEquals(parseAvoidWords(RULES), ['senior', 'lead', 'manager', 'warehouse', 'nurse', 'recruiter', 'solicitor', 'healthcare']);
  assertEquals(parseAvoidWords('Hide jobs paying less than £30,000 a year\nOnly show remote or hybrid jobs'), []);
  assertEquals(parseAvoidWords('No call centre jobs\nAvoid jobs as a driver / courier'), ['call centre', 'driver', 'courier']);
  assertEquals(parseAvoidWords(''), []);
});

Deno.test('job titles with an avoided word are found, whole words only', () => {
  const words = parseAvoidWords(RULES);
  assertEquals(findAvoidedWord('Solicitor - Family Law', words), 'solicitor');
  assertEquals(findAvoidedWord('Trainee Solicitors (Residential Property)', words), 'solicitor');
  assertEquals(findAvoidedWord('Senior Support Worker', words), 'senior');
  assertEquals(findAvoidedWord('Healthcare Assistant', words), 'healthcare');
  assertEquals(findAvoidedWord('Warehouse Operative', words), 'warehouse');
  assertEquals(findAvoidedWord('Team Leader', words), 'lead');
  assertEquals(findAvoidedWord('Leading Hand', words), undefined);
  assertEquals(findAvoidedWord('Nursery Practitioner', words), undefined);
  assertEquals(findAvoidedWord('Employment Advisor', words), undefined);
  assertEquals(findAvoidedWord('Recruitment Coordinator', words), undefined);
  assertEquals(findAvoidedWord('Call Centre Advisor', ['call centre']), 'call centre');
});
