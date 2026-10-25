import { Element } from 'deno-dom-wasm';

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const UNIT_MS: Record<string, number> = {
  minute: 60_000,
  min: 60_000,
  hour: 3_600_000,
  hr: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

/**
 * Turn how a job board shows a posting date ("Posted 3 days ago", "Just posted", "Yesterday",
 * "Posted 23 October 2026", "23/10/2026") into an ISO date. Undefined when the text has no posting date.
 * Relative dates are converted to a fixed date, so they don't go stale.
 */
export function parsePostedText(value: string | undefined | null, now = new Date()): string | undefined {
  if (!value) return undefined;
  const text = value.replace(/\s+/g, ' ').trim().toLowerCase();

  // "3 days ago", "30+ days ago", "posted 2 hours ago", "1 week ago"
  const relative = text.match(/(\d+)\+?\s*(minute|min|hour|hr|day|week|month)s?\s+ago/);
  if (relative) return new Date(now.getTime() - Number(relative[1]) * UNIT_MS[relative[2]]).toISOString();

  if (/\b(just posted|posted today|added today|new today|posted just now)\b/.test(text) || text === 'today') {
    return now.toISOString();
  }
  if (/\byesterday\b/.test(text)) {
    return new Date(now.getTime() - UNIT_MS.day).toISOString();
  }

  // "23 October 2026", "23rd Oct 2026", optionally after "posted"/"date posted"/"added"
  const longDate = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})/);
  if (longDate) {
    const month = MONTHS[longDate[2].slice(0, 4)] ?? MONTHS[longDate[2].slice(0, 3)];
    if (month !== undefined) return validDate(Number(longDate[3]), month, Number(longDate[1]), now);
  }

  // Glassdoor's short form: "4d", "30d+", "12h"
  const short = text.match(/^(\d+)\s?([dh])\+?$/);
  if (short) return new Date(now.getTime() - Number(short[1]) * (short[2] === 'd' ? UNIT_MS.day : UNIT_MS.hour)).toISOString();

  // "18 September" or "Date placed: 16 Oct" with no year (Reed, jobs.ac.uk): this year, or last year if that's ahead
  const dayMonth = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\b(?!\s*\d)/);
  if (dayMonth) {
    const month = MONTHS[dayMonth[2].slice(0, 4)] ?? MONTHS[dayMonth[2].slice(0, 3)];
    if (month !== undefined) {
      const day = Number(dayMonth[1]);
      return validDate(now.getUTCFullYear(), month, day, now) ?? validDate(now.getUTCFullYear() - 1, month, day, now);
    }
  }

  // "23/10/2026" (UK order)
  const shortDate = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (shortDate) {
    const year = Number(shortDate[3]) < 100 ? 2000 + Number(shortDate[3]) : Number(shortDate[3]);
    return validDate(year, Number(shortDate[2]) - 1, Number(shortDate[1]), now);
  }

  // ISO "2026-10-23" (e.g. from a <time datetime> attribute)
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), now);

  return undefined;
}

/** A date at noon UTC, or undefined when it's impossible or in the future. */
function validDate(year: number, month: number, day: number, now: Date): string | undefined {
  const date = new Date(Date.UTC(year, month, day, 12));
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== day) return undefined;
  // allow a day of slack for time zones; a later date is a closing date, not a posting date
  if (date.getTime() > now.getTime() + UNIT_MS.day) return undefined;
  return date.toISOString();
}

/**
 * A calendar date written the UK way ("23 October 2026", "23rd Oct 2026", "23/10/2026"), past or future.
 * Used for closing dates.
 */
export function parseUkDate(value: string | undefined | null, now = new Date()): Date | undefined {
  if (!value) return undefined;
  const text = value.toLowerCase();
  const longDate = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})/);
  const dayMonth = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\b/);
  const shortDate = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  let parts: [number, number, number] | undefined;
  if (longDate) {
    const month = MONTHS[longDate[2].slice(0, 4)] ?? MONTHS[longDate[2].slice(0, 3)];
    if (month !== undefined) parts = [Number(longDate[3]), month, Number(longDate[1])];
  } else if (dayMonth) {
    // "Closes 01 Nov": the nearest such date, so one from earlier this year counts as passed,
    // and early next year's isn't read as long gone
    const month = MONTHS[dayMonth[2].slice(0, 4)] ?? MONTHS[dayMonth[2].slice(0, 3)];
    if (month !== undefined) {
      let year = now.getUTCFullYear();
      if (Date.UTC(year, month, Number(dayMonth[1])) < now.getTime() - 180 * UNIT_MS.day) year += 1;
      parts = [year, month, Number(dayMonth[1])];
    }
  } else if (shortDate) {
    const year = Number(shortDate[3]) < 100 ? 2000 + Number(shortDate[3]) : Number(shortDate[3]);
    parts = [year, Number(shortDate[2]) - 1, Number(shortDate[1])];
  }
  if (!parts) return undefined;
  // end of the closing day, UK time is close enough to UTC for this
  const date = new Date(Date.UTC(parts[0], parts[1], parts[2], 23, 59));
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== parts[2] ? undefined : date;
}

/**
 * Find when a job was posted from its card on a search results page: a <time datetime> element,
 * or text like "Posted 3 days ago". Closing dates and other dates on the card are ignored.
 */
export function findPostedDate(card: Element, now = new Date()): string | undefined {
  const time = card.querySelector('time[datetime]');
  const fromTime = parsePostedText(time?.getAttribute('datetime'), now);
  if (fromTime) return fromTime;

  // look at each short piece of text on the card (e.g. "Date posted: 23 October 2026"),
  // so a closing date next to it isn't picked up
  const pieces = (Array.from(card.querySelectorAll('*')) as Element[])
    .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter((t) => t.length > 0 && t.length <= 60);

  for (const piece of pieces) {
    const lower = piece.toLowerCase();
    if (/clos|deadline|expir|apply by|\bends\b|start date|starts/.test(lower)) continue;
    const isDateText =
      /\bago\b|just posted|posted|added|placed|published|listed|^today$|^yesterday$|^new today$|^\d+\s?[dh]\+?$/.test(lower);
    if (!isDateText) continue;
    const parsed = parsePostedText(piece, now);
    if (parsed) return parsed;
  }
  return undefined;
}
