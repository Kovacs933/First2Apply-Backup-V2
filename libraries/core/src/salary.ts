// a money amount as boards write it: "26700", "26,700.00", "27k", "14.5"
const AMOUNT = String.raw`\d[\d,]*(?:\.\d+)?\s?[kK]?`;

// an amount or range at the start, ex: "26700-27500", "Up to 30000 a year", "14.50 - 15.00 an hour",
// but not a length of time ("37 hours per week")
const LEADING_AMOUNT = new RegExp(
  String.raw`^((?:up to|from|circa|c\.)\s*)?(${AMOUNT})(?:(\s*(?:-|–|to)\s*)(${AMOUNT}))?(?=\s|$|[,(/])(?!\s*(?:hours?|hrs?|days?|weeks?|months?)\b)`,
  'i',
);

/** "26700" -> "26,700"; "27k" and "26,700.00" stay as they are. */
function withThousands(amount: string) {
  return /^\d{4,}$/.test(amount) ? Number(amount).toLocaleString('en-GB') : amount;
}

/**
 * Show a salary in pounds: some boards leave the currency out ("26700-27500") or write it as
 * "12.71 GBP Hourly". Salaries in another currency and ones without an amount ("Competitive",
 * "Main Pay Scale") are left as they are.
 */
export function formatSalary(salary: string): string {
  const text = salary.trim();
  if (!text || /[$€]|\b(?:USD|EUR)\b/.test(text)) return text;
  return fixHourlyPence(inPounds(text));
}

function inPounds(salary: string) {
  // "500.00 - 650.00 GBP Weekly" -> "500.00 - 650.00 Weekly", the £ is added below
  const text = salary.replace(/\s*\bGBP\b\s*/g, ' ').trim();
  if (text.includes('£')) return text;

  const range = text.match(LEADING_AMOUNT);
  if (!range) return text;
  const [whole, prefix = '', low, separator, high] = range;
  const pounds = `${prefix}£${withThousands(low)}${high ? `${separator}£${withThousands(high)}` : ''}`;
  return pounds + text.slice(whole.length);
}

/**
 * Jobs saved before Oct 2026 lost the decimal point in hourly pay ("£13.30 an hour" became "£1330/hr").
 * Nobody's hourly pay is four figures, so "£1330/hr" is shown as "£13.30/hr".
 */
function fixHourlyPence(salary: string) {
  if (!/\/\s?hr\b|\bhour|\bhourly\b|\bph\b/i.test(salary)) return salary;
  return salary.replace(/£(\d{2})(\d{2})(?![\d,.])/g, '£$1.$2');
}
