import { AiFilterConfig } from '@first2apply/core';

/**
 * Location filter (no AI): hides jobs outside the UK, and jobs further than the user's chosen distance from
 * a town or postcode. Places are looked up with postcodes.io (free, no key, UK only).
 */

type Point = { latitude: number; longitude: number };
type Fetch = typeof fetch;

const UK_WORDS = /\b(uk|u\.k\.|united kingdom|england|scotland|wales|northern ireland|great britain|gb)\b/i;

// ", IL" style US state and Canadian province codes, plus country names, that show a job isn't in the UK
const US_STATES =
  'AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY';
const CA_PROVINCES = 'AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT';
const NON_UK_CODE = new RegExp(`,\\s*(${US_STATES}|${CA_PROVINCES})\\b`);
const NON_UK_WORDS =
  /\b(united states|usa|u\.s\.|america|canada|ireland(?<!northern ireland)|dublin|australia|new zealand|india|germany|france|spain|italy|netherlands|belgium|switzerland|austria|poland|portugal|sweden|norway|denmark|finland|singapore|philippines|south africa|nigeria|kenya|uae|dubai|united arab emirates|mexico|brazil)\b/i;

/** Whether a job location is clearly outside the UK ("Chicago, IL", "Toronto, ON", "Berlin, Germany"). */
export function isOutsideUk(location: string): boolean {
  if (/northern ireland/i.test(location)) return false;
  return NON_UK_CODE.test(location) || NON_UK_WORDS.test(location);
}

const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

// bigger places first, so "Bradford" is the city, not a suburb of Manchester with the same name
const PLACE_RANK = ['City', 'Town', 'Other Settlement', 'Suburban Area', 'Village', 'Hamlet'];

const cache = new Map<string, Point | null>();

async function lookUp(url: string, fetchFn: Fetch): Promise<unknown> {
  const res = await fetchFn(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`postcodes.io returned ${res.status}`);
  return (await res.json()).result ?? null;
}

/**
 * Where a town, postcode or postcode area is (e.g. "Leeds", "LS6 2NU", "LS6"). Null when it isn't a UK place.
 * Throws if postcodes.io can't be reached, so a network problem never hides a job.
 */
export async function geocodeUkPlace(query: string, fetchFn: Fetch = fetch): Promise<Point | null> {
  const text = query.trim();
  if (!text) return null;
  const key = text.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  let point: Point | null = null;
  const postcode = text.match(POSTCODE);
  if (postcode) {
    point = (await lookUp(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode[1] + postcode[2])}`, fetchFn)) as Point | null;
  } else if (OUTCODE.test(text)) {
    point = (await lookUp(`https://api.postcodes.io/outcodes/${encodeURIComponent(text)}`, fetchFn)) as Point | null;
  } else {
    const places = ((await lookUp(`https://api.postcodes.io/places?q=${encodeURIComponent(text)}&limit=10`, fetchFn)) ??
      []) as Array<Point & { name_1: string; local_type: string }>;
    const rank = (type: string) => (PLACE_RANK.includes(type) ? PLACE_RANK.indexOf(type) : PLACE_RANK.length);
    point =
      places
        .filter((p) => p.name_1.toLowerCase() === key)
        .sort((a, b) => rank(a.local_type) - rank(b.local_type))[0] ?? null;
  }

  const result = point ? { latitude: point.latitude, longitude: point.longitude } : null;
  cache.set(key, result);
  return result;
}

/** Where a job's location text is: a postcode in it, else its first place name that's a UK place. */
async function geocodeJobLocation(location: string, fetchFn: Fetch): Promise<Point | null> {
  const postcode = location.match(POSTCODE);
  if (postcode) return geocodeUkPlace(postcode[0], fetchFn);

  const parts = location
    .replace(/\((remote|hybrid|on-site)\)/gi, '')
    .split(/[,/|]| - /)
    .map((part) =>
      part
        .replace(/\b(greater|area|city of|metropolitan|region|hybrid|remote|on-site)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((part) => part && !UK_WORDS.test(part) && !/^(west|south|north|east) yorkshire$/i.test(part));
  for (const part of parts.slice(0, 3)) {
    const point = await geocodeUkPlace(part, fetchFn);
    if (point) return point;
  }
  return null;
}

/** Miles between two points, as the crow flies. */
export function milesBetween(a: Point, b: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Whether to hide a job because of where it is, with the reason shown in the Filtered out tab.
 * Jobs with no location, UK-wide or remote UK jobs are kept, as is anything when postcodes.io can't be reached.
 */
export async function checkJobLocation({
  location,
  jobType,
  config,
  fetchFn = fetch,
}: {
  location?: string | null;
  jobType?: string | null;
  config: Pick<AiFilterConfig, 'uk_only' | 'location_center' | 'location_radius_miles'>;
  fetchFn?: Fetch;
}): Promise<{ excluded: boolean; reason?: string }> {
  const radius = config.location_radius_miles ?? null;
  const center = config.location_center?.trim() ?? '';
  const limitDistance = !!radius && radius > 0 && !!center;
  if (!config.uk_only && !limitDistance) return { excluded: false };

  const where = location?.trim() ?? '';
  if (!where) return { excluded: false };
  if (isOutsideUk(where)) return { excluded: true, reason: `${where} is outside the UK.` };

  const isRemote = jobType === 'remote' || /\bremote\b/i.test(where);
  if (isRemote) return { excluded: false };

  try {
    const point = await geocodeJobLocation(where, fetchFn);
    if (!point) {
      // not a UK place postcodes.io knows, and doesn't say UK: most likely abroad
      return UK_WORDS.test(where) ? { excluded: false } : { excluded: true, reason: `${where} doesn't look like a UK location.` };
    }
    if (limitDistance) {
      const home = await geocodeUkPlace(center, fetchFn);
      if (home) {
        const miles = milesBetween(home, point);
        if (miles > radius!) {
          return { excluded: true, reason: `${where} is about ${Math.round(miles)} miles from ${center} (your limit is ${radius}).` };
        }
      }
    }
  } catch {
    // postcodes.io unreachable: keep the job rather than hide it by mistake
  }
  return { excluded: false };
}
