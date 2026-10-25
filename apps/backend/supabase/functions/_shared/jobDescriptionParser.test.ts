import { SiteProvider } from '@first2apply/core';
import { assertEquals } from '@std/assert';

import { parseJobPageLocation } from './jobDescriptionParser.ts';

const jsonLd = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`;

Deno.test('parseJobPageLocation reads the schema.org JobPosting address', () => {
  const html = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    jobLocation: { '@type': 'Place', address: { addressLocality: 'Leeds', addressRegion: 'West Yorkshire', addressCountry: 'GB' } },
  });
  assertEquals(parseJobPageLocation({ provider: SiteProvider.reed, html }), 'Leeds, West Yorkshire, GB');
});

Deno.test('parseJobPageLocation handles @graph, several places and repeated names', () => {
  const html = jsonLd({
    '@graph': [
      { '@type': 'Organization', name: 'Acme' },
      {
        '@type': 'JobPosting',
        jobLocation: [
          { address: { addressLocality: 'London', addressRegion: 'London', addressCountry: { name: 'United Kingdom' } } },
          { address: { addressLocality: 'Manchester' } },
        ],
      },
    ],
  });
  assertEquals(parseJobPageLocation({ provider: SiteProvider.totaljobs, html }), 'London, United Kingdom / Manchester');
});

Deno.test('parseJobPageLocation gives Remote for telecommute jobs without an address', () => {
  const html = jsonLd({ '@type': 'JobPosting', jobLocationType: 'TELECOMMUTE' });
  assertEquals(parseJobPageLocation({ provider: SiteProvider.indeed, html }), 'Remote');
});

Deno.test('parseJobPageLocation falls back to the LinkedIn header', () => {
  const html = `<html><body><div class="job-details-jobs-unified-top-card__tertiary-description-container">
    Concord, MA (Hybrid) · 23 hours ago · 50 applicants</div></body></html>`;
  assertEquals(parseJobPageLocation({ provider: SiteProvider.linkedin, html }), 'Concord, MA');
});

Deno.test('parseJobPageLocation returns undefined when the page gives no location', () => {
  assertEquals(parseJobPageLocation({ provider: SiteProvider.reed, html: '<html><body>Hi</body></html>' }), undefined);
  assertEquals(parseJobPageLocation({ provider: SiteProvider.reed, html: '<script type="application/ld+json">{bad</script>' }), undefined);
});
