// bullet characters job boards use instead of real lists ("·      Working within the service guidance")
const BULLET = /^(?:[·•●▪◦‣∙⁃○■□➢➤►✓✔→*]|-(?!-)|–|\d{1,2}[.)])\s+/;
// lines that are just junk copied from the board's page
const JUNK = /^(apply now|apply for this job|save job|save|share|report this job|show more|show less|see more|read more|back to search results?)\.?$/i;

/**
 * Tidy a job description (markdown made from the board's HTML) so every job reads the same way:
 * real bullet lists, proper headings, no stray spacing or page junk.
 */
export function tidyDescription(markdown: string): string {
  const lines = markdown
    .replace(/\r/g, '')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\\([-*_.()[\]#+!])/g, '$1') // turndown escapes these; they only add noise here
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());

  const out: string[] = [];
  const push = (line: string, kind: 'text' | 'item' | 'heading') => {
    const previous = out[out.length - 1];
    // keep list items together, and put a blank line around everything else
    if (kind === 'item') {
      if (previous !== undefined && previous !== '' && !previous.startsWith('- ')) out.push('');
    } else if (previous !== undefined && previous !== '') {
      out.push('');
    }
    out.push(line);
  };

  for (const raw of lines) {
    if (!raw) continue;
    let line = raw.replace(/\.{2,}$/, '.');
    if (JUNK.test(line.replace(/[*_]/g, ''))) continue;

    // "**Principal Duties:**", "### Duties", "KEY RESPONSIBILITIES" -> one heading style
    const bold = line.match(/^(?:\*\*|__)(.+?)(?:\*\*|__):?$/);
    const markdownHeading = line.match(/^#{1,6}\s+(.+)$/);
    const shouting = /^[A-Z0-9 &/,'’()-]{4,60}:?$/.test(line) && /[A-Z]{3}/.test(line);
    const headingText = bold?.[1] ?? markdownHeading?.[1] ?? (shouting ? line : undefined);
    if (headingText && headingText.replace(/[*_:]/g, '').trim().length <= 80) {
      let heading = headingText.replace(/[*_]/g, '').replace(/:$/, '').trim();
      if (heading === heading.toUpperCase()) heading = heading.charAt(0) + heading.slice(1).toLowerCase();
      if (heading) push(`### ${heading}`, 'heading');
      continue;
    }

    if (BULLET.test(line)) {
      line = line.replace(BULLET, '').trim();
      if (line) push(`- ${line}`, 'item');
      continue;
    }

    push(line, 'text');
  }

  // drop a heading with nothing under it (the last line, or straight before another heading)
  return out
    .filter((line, i, all) => {
      if (!line.startsWith('### ')) return true;
      const next = all.slice(i + 1).find((l) => l !== '');
      return next !== undefined && !next.startsWith('### ');
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
