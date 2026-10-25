import { CvProfile, GeneratedCv } from '@first2apply/core';

/** The parts of a found job the CV builder looks at. */
type SourceJob = { title: string; description?: string | null; tags?: string[] | null };

/**
 * Skills and requirements UK employers commonly ask for. Each is counted in the job adverts Foundation found,
 * to show the candidate what matters most for the role they want.
 */
const SKILLS: Array<{ skill: string; pattern: RegExp }> = [
  // everyday / transferable
  { skill: 'Communication', pattern: /\bcommunicat(ion|ions|e|ing) skills?\b|\bcommunicator\b/i },
  { skill: 'Customer service', pattern: /\bcustomer (service|care|experience)\b/i },
  { skill: 'Teamwork', pattern: /\bteam ?(work|player)\b|\bwork(ing)? (well )?(as part of|within) a team\b/i },
  { skill: 'Problem solving', pattern: /\bproblem[- ]solving\b/i },
  { skill: 'Time management', pattern: /\btime management\b|\bprioriti[sz](e|ing)\b/i },
  { skill: 'Attention to detail', pattern: /\battention to detail\b|\bdetail[- ]oriented\b/i },
  { skill: 'Organisation', pattern: /\borgani[sz]ation(al)? skills\b|\bwell[- ]organi[sz]ed\b/i },
  { skill: 'Leadership', pattern: /\bleadership\b/i },
  { skill: 'Stakeholder management', pattern: /\bstakeholder(s)?( management| engagement)?\b/i },
  { skill: 'Project management', pattern: /\bproject management\b|\bmanag(e|ing) projects\b/i },
  { skill: 'Negotiation', pattern: /\bnegotiat(ion|e|ing)\b/i },
  { skill: 'Presentation skills', pattern: /\bpresentation skills\b|\bpresenting\b/i },
  { skill: 'Written communication', pattern: /\bwritten (and verbal )?communication\b|\breport writing\b/i },
  { skill: 'Training and mentoring', pattern: /\bmentor(ing)?\b|\bcoach(ing)?\b|\btraining (staff|others|colleagues)\b/i },
  { skill: 'Sales', pattern: /\bsales (experience|targets|skills)\b|\bselling\b/i },
  { skill: 'Account management', pattern: /\baccount management\b/i },
  { skill: 'Budgeting', pattern: /\bbudget(s|ing)?\b/i },
  { skill: 'Data analysis', pattern: /\bdata analy(sis|tics)\b|\banaly[sz]ing data\b/i },
  { skill: 'Report writing', pattern: /\breporting\b/i },
  { skill: 'Administration', pattern: /\badministrat(ion|ive)\b/i },
  { skill: 'Data entry', pattern: /\bdata entry\b/i },
  { skill: 'Scheduling and diary management', pattern: /\bdiary management\b|\bscheduling\b/i },
  { skill: 'Bookkeeping', pattern: /\bbookkeeping\b/i },
  { skill: 'Cash handling', pattern: /\bcash handling\b|\btill\b/i },
  { skill: 'Stock control', pattern: /\bstock (control|management)\b|\binventory\b/i },
  { skill: 'Health and safety', pattern: /\bhealth (and|&) safety\b|\bCOSHH\b/i },
  { skill: 'Safeguarding', pattern: /\bsafeguarding\b/i },
  { skill: 'Driving licence', pattern: /\b(full |clean )?(uk )?driving licen[cs]e\b|\bown (car|transport)\b/i },
  { skill: 'DBS check', pattern: /\bDBS\b/ },
  { skill: 'Right to work in the UK', pattern: /\bright to work in the uk\b/i },
  { skill: 'Bilingual / languages', pattern: /\bbilingual\b|\bfluent in\b|\bwelsh speak/i },
  // office software
  { skill: 'Microsoft Office', pattern: /\b(microsoft|ms) office\b|\bmicrosoft 365\b|\boffice 365\b/i },
  { skill: 'Excel', pattern: /\bexcel\b/i },
  { skill: 'Word', pattern: /\b(microsoft|ms) word\b/i },
  { skill: 'PowerPoint', pattern: /\bpowerpoint\b/i },
  { skill: 'Outlook', pattern: /\boutlook\b/i },
  { skill: 'Google Workspace', pattern: /\bgoogle (workspace|sheets|docs)\b/i },
  { skill: 'CRM systems', pattern: /\bCRM\b/ },
  { skill: 'Salesforce', pattern: /\bsalesforce\b/i },
  { skill: 'SAP', pattern: /\bSAP\b/ },
  { skill: 'Xero', pattern: /\bxero\b/i },
  { skill: 'Sage', pattern: /\bsage\b/i },
  // tech and data
  { skill: 'SQL', pattern: /\bSQL\b/i },
  { skill: 'Python', pattern: /\bpython\b/i },
  { skill: 'JavaScript', pattern: /\bjavascript\b/i },
  { skill: 'TypeScript', pattern: /\btypescript\b/i },
  { skill: 'Java', pattern: /\bjava\b(?!script)/i },
  { skill: 'C#', pattern: /\bC#|\.NET\b/i },
  { skill: 'React', pattern: /\breact(\.js|js)?\b/i },
  { skill: 'Node.js', pattern: /\bnode(\.js|js)?\b/i },
  { skill: 'PHP', pattern: /\bPHP\b/ },
  { skill: 'HTML and CSS', pattern: /\bHTML\b|\bCSS\b/ },
  { skill: 'AWS', pattern: /\bAWS\b|\bamazon web services\b/i },
  { skill: 'Azure', pattern: /\bazure\b/i },
  { skill: 'Google Cloud', pattern: /\bGCP\b|\bgoogle cloud\b/i },
  { skill: 'Docker', pattern: /\bdocker\b/i },
  { skill: 'Kubernetes', pattern: /\bkubernetes\b|\bk8s\b/i },
  { skill: 'Git', pattern: /\bgit(hub|lab)?\b/i },
  { skill: 'Agile / Scrum', pattern: /\bagile\b|\bscrum\b/i },
  { skill: 'Power BI', pattern: /\bpower ?bi\b/i },
  { skill: 'Tableau', pattern: /\btableau\b/i },
  { skill: 'Machine learning', pattern: /\bmachine learning\b|\bML\b/ },
  { skill: 'Cyber security', pattern: /\bcyber ?security\b|\binformation security\b/i },
  { skill: 'IT support', pattern: /\b(IT|technical) support\b|\bhelp ?desk\b|\bservice desk\b/i },
  { skill: 'Testing / QA', pattern: /\btesting\b|\bQA\b|\bquality assurance\b/i },
  { skill: 'UX / UI design', pattern: /\bUX\b|\bUI\b|\buser experience\b/i },
  { skill: 'Figma', pattern: /\bfigma\b/i },
  { skill: 'Adobe Creative Suite', pattern: /\badobe\b|\bphotoshop\b|\billustrator\b|\bindesign\b/i },
  // marketing
  { skill: 'Social media', pattern: /\bsocial media\b/i },
  { skill: 'SEO', pattern: /\bSEO\b/ },
  { skill: 'Content writing', pattern: /\bcontent (writing|creation)\b|\bcopywriting\b/i },
  { skill: 'Digital marketing', pattern: /\bdigital marketing\b/i },
  { skill: 'Google Analytics', pattern: /\bgoogle analytics\b|\bGA4\b/i },
  // finance
  { skill: 'Accounts payable / receivable', pattern: /\baccounts (payable|receivable)\b|\bpurchase ledger\b|\bsales ledger\b/i },
  { skill: 'Payroll', pattern: /\bpayroll\b/i },
  { skill: 'Financial reporting', pattern: /\bfinancial (reporting|statements)\b|\bmanagement accounts\b/i },
  { skill: 'ACCA / CIMA / ACA', pattern: /\bACCA\b|\bCIMA\b|\bACA\b|\bAAT\b/ },
  { skill: 'Compliance', pattern: /\bcompliance\b|\bregulat(ory|ions)\b/i },
  // health, care and education
  { skill: 'Patient care', pattern: /\bpatient care\b|\bpatients\b/i },
  { skill: 'Personal care', pattern: /\bpersonal care\b/i },
  { skill: 'NMC registration', pattern: /\bNMC\b/ },
  { skill: 'HCPC registration', pattern: /\bHCPC\b/ },
  { skill: 'Care Certificate', pattern: /\bcare certificate\b/i },
  { skill: 'First aid', pattern: /\bfirst aid\b/i },
  { skill: 'Medication administration', pattern: /\bmedication\b/i },
  { skill: 'QTS (teaching)', pattern: /\bQTS\b|\bqualified teacher status\b/i },
  { skill: 'SEN support', pattern: /\bSEN(D|CO)?\b|\bspecial educational needs\b/i },
  // trades, logistics, hospitality
  { skill: 'CSCS card', pattern: /\bCSCS\b/ },
  { skill: 'Forklift licence', pattern: /\bforklift\b|\bFLT\b|\bcounterbalance\b/i },
  { skill: 'HGV / Class 1 or 2', pattern: /\bHGV\b|\bclass (1|2|c|c\+e)\b|\bCPC\b/i },
  { skill: 'Warehouse operations', pattern: /\bwarehouse\b|\bpicking\b|\bpacking\b/i },
  { skill: 'Food hygiene', pattern: /\bfood (hygiene|safety)\b/i },
  { skill: 'Electrical (18th Edition)', pattern: /\b18th edition\b|\bNVQ level 3\b/i },
  { skill: 'Manual handling', pattern: /\bmanual handling\b/i },
];

const STOPWORDS = new Set(['and', 'the', 'for', 'with', 'job', 'jobs', 'role', 'uk', 'in', 'of', 'a', 'an', 'to', '-']);
const roleWords = (role: string) =>
  role
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

/** The found jobs that match the role the candidate wants (all its words in the title, else any of them). */
export function jobsForRole<T extends SourceJob>(jobs: T[], targetRole: string): T[] {
  const words = roleWords(targetRole);
  if (words.length === 0) return [];
  const title = (job: T) => job.title.toLowerCase();
  const all = jobs.filter((job) => words.every((w) => title(job).includes(w)));
  if (all.length > 0) return all;
  return jobs.filter((job) => words.some((w) => title(job).includes(w)));
}

export type EmployerSkill = { skill: string; jobCount: number };

/** The skills mentioned most across the given job adverts, with how many adverts mention each. */
export function findEmployerSkills(jobs: SourceJob[], max = 15): EmployerSkill[] {
  const counts = SKILLS.map(({ skill, pattern }) => ({
    skill,
    jobCount: jobs.filter((job) =>
      pattern.test([job.title, job.description ?? '', ...(job.tags ?? [])].join('\n')),
    ).length,
  }));
  return counts
    .filter((c) => c.jobCount > 0)
    .sort((a, b) => b.jobCount - a.jobCount)
    .slice(0, max);
}

const sameSkill = (a: string, b: string) => {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
};

/** Whether the candidate listed this employer skill (loosely: "Excel" matches "Advanced Excel"). */
export const candidateHasSkill = (profile: CvProfile, skill: string) =>
  profile.skills.some((s) => s.trim() && sameSkill(s, skill));

/**
 * Lay out a CV without AI: the candidate's own words, with the skills employers ask for most put first.
 */
export function buildTemplateCv({
  profile,
  targetRole,
  employerSkills,
}: {
  profile: CvProfile;
  targetRole: string;
  employerSkills: EmployerSkill[];
}): GeneratedCv {
  const ownSkills = profile.skills.map((s) => s.trim()).filter(Boolean);
  const rank = (skill: string) => {
    const index = employerSkills.findIndex((e) => sameSkill(skill, e.skill));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const skills = [...ownSkills].sort((a, b) => rank(a) - rank(b));
  const matched = skills.filter((s) => rank(s) !== Number.MAX_SAFE_INTEGER).slice(0, 3);

  // e.g. "Reporting Assistant at Leeds City Council, looking for a Data Analyst role. Skilled in SQL, Excel and Python."
  const latest = profile.experience.find((e) => e.title.trim());
  const role = targetRole.trim();
  const current = latest ? `${latest.title.trim()}${latest.employer.trim() ? ` at ${latest.employer.trim()}` : ''}` : '';
  const lookingFor = role ? `looking for ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role} role` : '';
  const opening = current && lookingFor ? `${current}, ${lookingFor}.` : current ? `${current}.` : lookingFor ? `${lookingFor[0].toUpperCase()}${lookingFor.slice(1)}.` : '';
  const summary =
    profile.summary?.trim() ||
    [opening, matched.length ? `Skilled in ${joinList(matched)}.` : ''].filter(Boolean).join(' ');

  return {
    summary,
    skills,
    experience: profile.experience
      .filter((e) => e.title.trim() || e.employer.trim())
      .map((e) => ({
        title: e.title.trim(),
        employer: e.employer.trim(),
        dates: e.dates?.trim() ?? '',
        bullets: (e.details ?? '')
          .split(/\n+/)
          .map((line) => line.replace(/^[\s•*-]+/, '').trim())
          .filter(Boolean),
      })),
    education: profile.education
      .filter((e) => e.qualification.trim() || e.place.trim())
      .map((e) => ({ qualification: e.qualification.trim(), place: e.place.trim(), dates: e.dates?.trim() ?? '' })),
  };
}

/**
 * Pick out the easy-to-spot details from a CV or LinkedIn profile's text, to pre-fill the CV Builder.
 * Anything it isn't sure about is left out.
 */
export function parseCvText(text: string, pageTitle?: string): Partial<CvProfile> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  const phone = text.match(/(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}|(?:\+44\s?|0)(?:\d\s?){9,10}/)?.[0]?.trim();
  const linkedinUrl = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i)?.[0];

  // LinkedIn page titles look like "(3) Alex Taylor | LinkedIn"; a CV usually starts with the name
  const fromTitle = pageTitle?.replace(/^\(\d+\)\s*/, '').split(/\s[|–-]\s/)[0]?.trim();
  const firstLine = lines[0];
  const looksLikeName = (value?: string) => !!value && /^[A-Za-z][A-Za-z' .-]{1,40}$/.test(value) && value.split(' ').length <= 4;
  const fullName = looksLikeName(fromTitle) ? fromTitle : looksLikeName(firstLine) ? firstLine : undefined;

  // skills: the lines under a "Skills" heading, up to the next heading
  // compared without spaces, since PDFs sometimes space out headings ("E XPERIENCE")
  const squash = (line: string) => line.replace(/\s+/g, '').toLowerCase();
  const headings =
    /^(experience|workexperience|employment|employmenthistory|education|qualifications|languages|interests|hobbies|references|certifications|licen[cs]es|projects|volunteering|about|activity|recommendations|profile|summary)/;
  const start = lines.findIndex((l) => /^(key|core|technical)?skills/.test(squash(l)) && l.length <= 25);
  let skills: string[] | undefined;
  if (start !== -1) {
    const block: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (headings.test(squash(line)) || block.length >= 30) break;
      block.push(line);
    }
    skills = [
      ...new Set(
        block
          .flatMap((l) => l.split(/[,•|·;]/))
          .map((s) => s.replace(/^[\s*-]+/, '').trim())
          // a skill is a few words; longer lines are sentences or several skills we can't split safely
          .filter((s) => s.length > 1 && s.length <= 40 && s.split(' ').length <= 4 && !/endorse|show all|see more/i.test(s)),
      ),
    ].slice(0, 20);
  }

  return {
    ...(fullName && { fullName }),
    ...(email && { email }),
    ...(phone && { phone }),
    ...(linkedinUrl && { linkedinUrl: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}` }),
    ...(skills?.length && { skills }),
  };
}

const joinList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** A complete, printable A4 HTML page for the CV (used for the preview and the PDF). */
export function renderCvHtml({ cv, profile }: { cv: GeneratedCv; profile: CvProfile }): string {
  const e = escapeHtml;
  const contact = [profile.email, profile.phone, profile.location, profile.linkedinUrl?.replace(/^https?:\/\/(www\.)?/, '')]
    .map((v) => v?.trim())
    .filter(Boolean) as string[];

  const section = (title: string, body: string) => (body ? `<section><h2>${title}</h2>${body}</section>` : '');
  const experience = cv.experience
    .map(
      (job) => `<div class="item">
  <div class="row"><strong>${e(job.title)}</strong>${job.dates ? `<span class="dates">${e(job.dates)}</span>` : ''}</div>
  ${job.employer ? `<div class="sub">${e(job.employer)}</div>` : ''}
  ${job.bullets.length ? `<ul>${job.bullets.map((b) => `<li>${e(b)}</li>`).join('')}</ul>` : ''}
</div>`,
    )
    .join('');
  const education = cv.education
    .map(
      (ed) => `<div class="item">
  <div class="row"><strong>${e(ed.qualification)}</strong>${ed.dates ? `<span class="dates">${e(ed.dates)}</span>` : ''}</div>
  ${ed.place ? `<div class="sub">${e(ed.place)}</div>` : ''}
</div>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>${e(profile.fullName)} - CV</title>
<style>
  @page { size: A4; margin: 16mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #1b2433; font-size: 10.5pt; line-height: 1.45; background: #fff; }
  .page { max-width: 178mm; margin: 0 auto; }
  h1 { margin: 0; font-size: 22pt; color: #1f3a5f; letter-spacing: 0.3px; }
  .contact { margin-top: 4px; color: #4a5568; font-size: 9.5pt; }
  .contact span + span::before { content: '  |  '; color: #c4cbd6; }
  section { margin-top: 14px; }
  h2 { margin: 0 0 6px; padding-bottom: 3px; font-size: 10.5pt; text-transform: uppercase; letter-spacing: 1.2px; color: #1f3a5f; border-bottom: 2px solid #e8a55a; }
  p { margin: 0; }
  .skills { display: flex; flex-wrap: wrap; gap: 4px 6px; }
  .skills span { padding: 1px 8px; border-radius: 10px; background: #eef2f7; font-size: 9.5pt; }
  .item { margin-bottom: 9px; page-break-inside: avoid; }
  .row { display: flex; justify-content: space-between; gap: 12px; }
  .dates { color: #4a5568; font-size: 9.5pt; white-space: nowrap; }
  .sub { color: #4a5568; }
  ul { margin: 3px 0 0; padding-left: 17px; }
  li { margin: 1px 0; }
</style></head>
<body><div class="page">
  <h1>${e(profile.fullName || 'Your name')}</h1>
  ${contact.length ? `<div class="contact">${contact.map((c) => `<span>${e(c)}</span>`).join('')}</div>` : ''}
  ${section('Profile', cv.summary ? `<p>${e(cv.summary)}</p>` : '')}
  ${section('Key skills', cv.skills.length ? `<div class="skills">${cv.skills.map((s) => `<span>${e(s)}</span>`).join('')}</div>` : '')}
  ${section('Experience', experience)}
  ${section('Education', education)}
</div></body></html>`;
}
