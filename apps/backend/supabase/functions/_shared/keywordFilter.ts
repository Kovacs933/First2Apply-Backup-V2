/**
 * The "Avoid ..." / "Hide ..." words in the AI filters box, checked against the job title without AI,
 * so they work for everyone, instantly and for free. The AI still reads the whole box afterwards.
 *
 * ex: "Avoid Warehouse, Hide senior, lead or manager roles, avoid solicitor"
 *   -> ["warehouse", "senior", "lead", "manager", "solicitor"]
 */
export function parseAvoidWords(rules: string): string[] {
  const words: string[] = [];
  let inAvoidRule = false;

  for (const raw of rules.split(/[\n,;]+/)) {
    const piece = raw.trim().replace(/\.$/, '');
    if (!piece) continue;

    const avoid = piece.match(/^(?:avoid|hide|exclude|no|don'?t show|do not show)\s+(.+)$/i);
    // "Hide senior, lead or manager roles": the words after a comma still belong to the "Hide"
    const continues = !avoid && inAvoidRule && piece.split(/\s+/).length <= 4;
    if (!avoid && !continues) {
      inAvoidRule = false;
      continue;
    }

    const rest = avoid ? avoid[1] : piece;
    // salary, distance and other rules are for the AI ("Hide jobs paying less than £30,000 a year")
    if (/\d|£|\b(?:paying|pay|salary|less|more|than|under|over|below|above|miles|remote|hybrid)\b/i.test(rest)) {
      inAvoidRule = false;
      continue;
    }
    inAvoidRule = true;

    for (const part of rest.split(/\s+(?:or|and)\s+|\s*\/\s*|\s*&\s*/i)) {
      const word = part
        .toLowerCase()
        .replace(/^(?:any|all|the|jobs?|roles?)\s+(?:(?:as|in|for|with|at)\s+)?(?:an?\s+)?/, '')
        .replace(/\s+(?:roles?|jobs?|positions?|vacancies|vacancy|work|posts?)$/, '')
        .replace(/["'“”]/g, '')
        .trim();
      if (word.length >= 3 && !words.includes(word)) words.push(word);
    }
  }
  return words;
}

/** The first avoided word in the job title ("Solicitor", "Trainee Solicitors"), or undefined. */
export function findAvoidedWord(title: string, words: string[]): string | undefined {
  const lowerTitle = title.toLowerCase();
  return words.find((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // whole words only, plural too: "nurse" matches "Nurses", not "Nursery"; "lead" matches "Team Leader"
    return new RegExp(`(?:^|[^a-z])${escaped}(?:s|es|ers?)?(?:$|[^a-z])`).test(lowerTitle);
  });
}
