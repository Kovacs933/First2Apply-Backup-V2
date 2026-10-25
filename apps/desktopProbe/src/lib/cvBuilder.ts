import { CvProfile, GeneratedCv } from '@first2apply/core';

/** The parts of a found job the CV builder looks at. */
type SourceJob = { title: string; description?: string | null; tags?: string[] | null; status?: string };

/** Jobs the candidate saved ("archived" is the Saved tab) or applied to: the roles they really want. */
export const isChosenJob = (job: SourceJob) => job.status === 'archived' || job.status === 'applied';

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
  // not "Mental Health First Aid", which is its own qualification
  { skill: 'First aid', pattern: /(?<!mental health )\bfirst aid\b/i },
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

/**
 * The found jobs that match the role the candidate wants (all its words in the title, else any of them),
 * with the jobs they saved or applied to first. Saved jobs also count when the role is only in the advert
 * ("Employment Advisor" adverts that talk about job coaching): the candidate saved them, so they're relevant.
 */
export function jobsForRole<T extends SourceJob>(jobs: T[], targetRole: string): T[] {
  const words = roleWords(targetRole);
  if (words.length === 0) return [];
  const title = (job: T) => job.title.toLowerCase();
  let matching = jobs.filter((job) => words.every((w) => title(job).includes(w)));
  if (matching.length === 0) matching = jobs.filter((job) => words.some((w) => title(job).includes(w)));
  const savedRelated = jobs.filter(
    (job) =>
      isChosenJob(job) &&
      !matching.includes(job) &&
      words.some((w) => title(job).includes(w) || (job.description ?? '').toLowerCase().includes(w)),
  );
  return [...matching.filter(isChosenJob), ...savedRelated, ...matching.filter((job) => !isChosenJob(job))];
}

/**
 * Qualifications and training UK employers ask for, counted in the adverts like SKILLS, to show the candidate
 * what would strengthen their CV. Checks and licences (DBS, driving licence, ...) come from SKILLS.
 */
const QUALIFICATIONS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Degree', pattern: /\b(degree|graduate)\b/i },
  { name: 'GCSE (or equivalent) English and maths', pattern: /\bGCSEs?\b|functional skills|level 2 (english|maths)/i },
  { name: 'Level 2 in Health and Social Care', pattern: /level 2[^.\n]{0,40}(health and social care|adult care|care)/i },
  {
    name: 'Level 3 Diploma in Health and Social Care',
    pattern: /level 3[^.\n]{0,40}(health and social care|adult care)|\bNVQ\b[^.\n]{0,15}3[^.\n]{0,30}care/i,
  },
  { name: 'Information, Advice and Guidance (IAG) qualification', pattern: /\bIAG\b|information,? advice,? (and|&) guidance/i },
  { name: 'Careers guidance qualification (QCG / Level 6)', pattern: /\bQCG\b|career(s)? guidance (qualification|diploma)|level 6[^.\n]{0,25}guidance/i },
  {
    name: 'Level 3 Award in Education and Training',
    pattern: /award in education and training|\bPTLLS\b|\bAET\b|teaching qualification|training qualification/i,
  },
  { name: 'Assessor award (TAQA / CAVA)', pattern: /\bTAQA\b|\bCAVA\b|assessor (award|qualification)/i },
  { name: 'Supported employment qualification', pattern: /supported employment (qualification|certificate|level)|\bBASE\b/ },
  { name: 'Mental Health First Aid', pattern: /mental health first aid(er)?|\bMHFA\b/i },
  { name: 'Safeguarding training', pattern: /safeguarding (training|certificate|course|level)/i },
  {
    name: 'Positive behaviour support training (PBS / Team Teach / MAPA)',
    pattern: /positive behaviour(al)? support|\bPBS\b|team teach|\bMAPA\b/i,
  },
  { name: 'Autism training', pattern: /autism (awareness|training|qualification)/i },
  { name: 'Makaton or British Sign Language', pattern: /\bmakaton\b|\bBSL\b|british sign language/i },
  { name: 'Level 3 Supporting Teaching and Learning', pattern: /supporting teaching and learning|teaching assistant (level|qualification)/i },
  { name: 'Level 3 in Childcare / Early Years', pattern: /level 3[^.\n]{0,30}(childcare|early years)|\bEYFS\b/i },
  { name: 'CIPD qualification', pattern: /\bCIPD\b/ },
  { name: 'Management qualification (ILM / CMI)', pattern: /\bILM\b|\bCMI\b|management qualification/i },
  { name: 'PRINCE2 / project management qualification', pattern: /\bPRINCE2\b|\bAPM\b|\bPMP\b/ },
];

export type CvImprovement = EmployerSkill & { name: string; kind: 'Qualification' | 'Check or licence' | 'Skill' };

/**
 * What would strengthen the candidate's CV for this role: the qualifications, checks and skills the role's adverts
 * ask for that the candidate's details don't show yet, most asked-for first (saved jobs and person specs count extra,
 * as in findEmployerSkills). Suggestions to work towards only: nothing here is added to the CV.
 */
export function findCvImprovements(jobs: SourceJob[], profile: CvProfile, max = 8): CvImprovement[] {
  // everything the candidate has told us, to check a qualification against
  const own = [
    ...profile.skills,
    ...profile.education.flatMap((e) => [e.qualification, e.place]),
    ...(profile.qualifications ?? []).flatMap((q) => [q.qualification, q.place]),
  ].join('\n');
  const adverts = jobs.map((job) => ({
    text: [job.description ?? '', ...(job.tags ?? [])].join('\n'),
    spec: personSpecification(job.description ?? ''),
    chosen: isChosenJob(job),
  }));
  const count = (name: string, pattern: RegExp, kind: CvImprovement['kind']) => {
    const mentioning = adverts.filter((a) => pattern.test(a.text));
    const savedCount = mentioning.filter((a) => a.chosen).length;
    const essentialCount = mentioning.filter((a) => a.spec && pattern.test(a.spec)).length;
    return {
      name,
      skill: name,
      kind,
      jobCount: mentioning.length,
      savedCount,
      essentialCount,
      weight: mentioning.length + savedCount * 2 + essentialCount,
    };
  };
  return [
    ...QUALIFICATIONS.filter((q) => !q.pattern.test(own)).map((q) => count(q.name, q.pattern, 'Qualification')),
    ...SKILLS.filter((s) => !s.pattern.test(own) && !candidateHasSkill(profile, s.skill)).map((s) =>
      count(s.skill, s.pattern, s.skill in CREDENTIALS ? 'Check or licence' : 'Skill'),
    ),
  ]
    .filter((c) => c.jobCount > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .map(({ weight, ...improvement }) => improvement);
}

export type EmployerSkill = {
  skill: string;
  // adverts that mention it
  jobCount: number;
  // of those, the ones the candidate saved or applied to
  savedCount: number;
  // adverts that list it in the person specification / essential requirements
  essentialCount: number;
};

/**
 * The person specification part of an advert: everything after a heading like "Person specification",
 * "Essential criteria", "Requirements" or "About you". Empty when the advert has none.
 */
export function personSpecification(description: string): string {
  const match = description.match(
    /(person specification|essential (criteria|skills|requirements|experience)|(key )?requirements|what you('ll)? need|what we('re)? looking for|about you|you will have|the ideal candidate)/i,
  );
  return match?.index !== undefined ? description.slice(match.index) : '';
}

/**
 * The skills that matter most across the given job adverts. Each advert counts once, a job the candidate saved
 * or applied to counts three times (those are the roles they actually want), and a skill in an advert's person
 * specification counts extra, since that's what applications are shortlisted against.
 */
export function findEmployerSkills(jobs: SourceJob[], max = 15): EmployerSkill[] {
  const adverts = jobs.map((job) => {
    // not the title: "Job Coach" would otherwise count as asking for coaching in every advert
    const text = [job.description ?? '', ...(job.tags ?? [])].join('\n');
    return { text, spec: personSpecification(job.description ?? ''), chosen: isChosenJob(job) };
  });
  const counts = SKILLS.map(({ skill, pattern }) => {
    const mentioning = adverts.filter((a) => pattern.test(a.text));
    const savedCount = mentioning.filter((a) => a.chosen).length;
    const essentialCount = mentioning.filter((a) => a.spec && pattern.test(a.spec)).length;
    return {
      skill,
      jobCount: mentioning.length,
      savedCount,
      essentialCount,
      weight: mentioning.length + savedCount * 2 + essentialCount,
    };
  });
  return counts
    .filter((c) => c.jobCount > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .map(({ weight, ...skill }) => skill);
}

export type CvDataStrength = { level: 'starting' | 'building' | 'strong'; percent: number; tip: string };

/**
 * How much Foundation has to go on for this role. Around 30 minutes of searching and saving jobs gives it
 * enough: 20+ adverts for the role, 5+ of them saved, and some with a person specification.
 */
export function cvDataStrength(roleJobs: SourceJob[]): CvDataStrength {
  const saved = roleJobs.filter(isChosenJob).length;
  const withSpec = roleJobs.filter((job) => personSpecification(job.description ?? '')).length;
  const percent = Math.round(
    (Math.min(roleJobs.length, 20) / 20) * 50 + (Math.min(saved, 5) / 5) * 35 + (Math.min(withSpec, 5) / 5) * 15,
  );
  const level = percent >= 80 ? 'strong' : percent >= 40 ? 'building' : 'starting';
  const tip =
    roleJobs.length < 20
      ? `Foundation has ${roleJobs.length} ${roleJobs.length === 1 ? 'advert' : 'adverts'} for this role so far. Keep your searches running and check back: around 20 gives a reliable picture.`
      : saved < 5
        ? `Save the jobs you'd really apply for (${saved} saved so far). Around 5 lets Foundation fit your CV to the jobs you actually want.`
        : withSpec < 5
          ? 'Few of these adverts include a person specification yet. Open and save some full adverts so Foundation can match the essential criteria.'
          : 'Foundation has plenty to go on for this role.';
  return { level, percent, tip };
}

const sameSkill = (a: string, b: string) => {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
};

/** Whether the candidate listed this employer skill (loosely: "Excel" matches "Advanced Excel"). */
export const candidateHasSkill = (profile: CvProfile, skill: string) =>
  profile.skills.some((s) => s.trim() && sameSkill(s, skill));

/** Checks and licences: shown in their own section and sentence rather than as skills. */
const CREDENTIALS: Record<string, string> = {
  'DBS check': 'a DBS check',
  'Driving licence': 'a driving licence',
  'Right to work in the UK': 'the right to work in the UK',
  'First aid': 'a first aid certificate',
  'CSCS card': 'a CSCS card',
  'Forklift licence': 'a forklift licence',
  'HGV / Class 1 or 2': 'an HGV licence',
  'NMC registration': 'NMC registration',
  'HCPC registration': 'HCPC registration',
  'Care Certificate': 'the Care Certificate',
  'QTS (teaching)': 'QTS',
  'ACCA / CIMA / ACA': 'an accountancy qualification',
  'Electrical (18th Edition)': '18th Edition wiring regulations',
};

/** Everyday skills that read naturally in lower case mid-sentence ("strengths in teamwork and ..."). */
const COMMON_SKILLS = new Set(SKILLS.slice(0, 31).map((s) => s.skill).concat(['Patient care', 'Personal care']));
const inSentence = (skill: string) => (COMMON_SKILLS.has(skill) ? skill.toLowerCase() : skill);

/** The known skill (from SKILLS) a candidate's own wording refers to, if any. */
const knownSkill = (own: string) => SKILLS.find((s) => sameSkill(own, s.skill) || s.pattern.test(own));

const aOrAn = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/**
 * The earliest year in the candidate's job dates (undefined if none are given). Used as "working since 2021"
 * rather than a count of years, which would overstate experience with gaps or part-time work.
 */
function firstWorkYear(profile: CvProfile): number | undefined {
  const years = profile.experience
    .flatMap((e): string[] => (e.dates ?? '').match(/\b(19|20)\d{2}\b/g) ?? [])
    .map(Number);
  return years.length ? Math.min(...years) : undefined;
}

/**
 * Lay out a CV without AI, tailored to the role: a personal profile built around what the role's employers
 * ask for, only the skills those adverts mention (plus the candidate's own specialist ones), checks and
 * licences pulled out, and each job's most relevant points first.
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
  const rank = (skill: string) => {
    const known = knownSkill(skill)?.skill ?? skill;
    const index = employerSkills.findIndex((e) => sameSkill(skill, e.skill) || e.skill === known);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const isCredential = (skill: string) => {
    const known = knownSkill(skill)?.skill;
    return !!known && known in CREDENTIALS;
  };

  const ownSkills = [...new Set(profile.skills.map((s) => s.trim()).filter(Boolean))];
  const credentials = ownSkills.filter(isCredential).sort((a, b) => rank(a) - rank(b));
  const skills = ownSkills
    .filter((s) => !isCredential(s))
    // once we know what the role's adverts ask for, drop known skills none of them mention (e.g. React for a
    // Job Coach); skills we can't judge are the candidate's own specialisms, so they stay
    .filter((s) => employerSkills.length === 0 || rank(s) !== Number.MAX_SAFE_INTEGER || !knownSkill(s))
    .sort((a, b) => rank(a) - rank(b))
    // every skill the adverts ask for that the candidate has is always kept; their own extras fill up to 12
    .filter((s, i) => rank(s) !== Number.MAX_SAFE_INTEGER || i < 12);
  const strengths = skills.filter((s) => rank(s) !== Number.MAX_SAFE_INTEGER).slice(0, 3);

  const role = targetRole.trim();
  const jobs = profile.experience.filter((e) => e.title.trim() || e.employer.trim());
  const latest = jobs.find((e) => e.title.trim());
  const since = firstWorkYear(profile);
  const latestEducation = profile.education.find((e) => e.qualification.trim());

  // Only facts the candidate entered: their job, dates, skills, checks and the role they want. No claims about
  // character ("motivated", "reliable") or experience they didn't give.
  // e.g. "Assistant Job Coach at Lighthouse Futures Trust, working since 2021. Particular strengths in
  // safeguarding, communication, and training and mentoring. Has a DBS check and a driving licence. Now looking
  // to bring this experience to a Job Coach role in Leeds."
  const opening = latest
    ? `${latest.title.trim()}${latest.employer.trim() ? ` at ${latest.employer.trim()}` : ''}${since && since < new Date().getFullYear() ? `, working since ${since}` : ''}.`
    : latestEducation
      ? `${latestEducation.qualification.trim()}${latestEducation.place.trim() ? `, ${latestEducation.place.trim()}` : ''}.`
      : '';
  const strengthsLine = strengths.length ? `Particular strengths in ${joinList(strengths.map(inSentence))}.` : '';
  const credentialsLine = credentials.length
    ? `Has ${joinList(credentials.map((c) => CREDENTIALS[knownSkill(c)?.skill ?? ''] ?? c))}.`
    : '';
  const where = profile.location?.trim() ? ` in ${profile.location.trim()}` : '';
  const goal = role
    ? latest
      ? `Now looking to bring this experience to ${aOrAn(role)} ${role} role${where}.`
      : `Looking for a first ${role} role${where}.`
    : '';
  const summary = profile.summary?.trim() || [opening, strengthsLine, credentialsLine, goal].filter(Boolean).join(' ');

  // within each job, the points that show what employers ask for go first
  const relevance = (bullet: string) =>
    employerSkills.reduce((score, e, i) => {
      const pattern = SKILLS.find((s) => s.skill === e.skill)?.pattern;
      return pattern?.test(bullet) || bullet.toLowerCase().includes(e.skill.toLowerCase())
        ? score + (employerSkills.length - i)
        : score;
    }, 0);
  // paid jobs then volunteer roles: both give evidence for Relevant skills
  const volunteer = (profile.volunteering ?? []).filter((e) => e.title.trim() || e.employer.trim());
  const jobPoints = [...jobs, ...volunteer].map((e) =>
    (e.details ?? '')
      .split(/\n+/)
      .map((line) => line.replace(/^[\s•*-]+/, '').trim())
      .filter(Boolean)
      .map((bullet, i) => ({ bullet, i, score: relevance(bullet) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .map(({ bullet }) => bullet),
  );

  // Relevant skills (skills-based CV): the five that matter most for this role, ranked by what the role's adverts
  // and saved jobs ask for. The candidate's own skills come first; an employer skill they didn't list only shows
  // when their own job points show it. Each gets up to two of those points as evidence, never the same point twice.
  const used = new Set<string>();
  const evidenceFor = (skill: string) => {
    const pattern = knownSkill(skill)?.pattern;
    // the skill's own longer words, by stem: "Safeguarding and Risk Awareness" -> safegu, awaren
    const stems = skill
      .toLowerCase()
      .split(/[^a-z]+/)
      // words too general to show a skill on their own ("SEND support" isn't shown by "supported replenishment")
      .filter(
        (w) =>
          w.length >= 5 &&
          !['skills', 'management', 'support', 'supporting', 'working', 'awareness', 'ability', 'experience'].includes(w),
      )
      .map((w) => w.slice(0, 6));
    return jobPoints
      .flat()
      .filter((point) => !used.has(point))
      .map((point) => ({
        point,
        score: (pattern?.test(point) ? 2 : 0) + stems.filter((s) => point.toLowerCase().includes(s)).length,
      }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((p) => p.point);
  };
  const skillChoices = [
    ...skills,
    ...employerSkills
      .map((e) => e.skill)
      .filter((s) => !(s in CREDENTIALS) && !skills.some((own) => sameSkill(own, s))),
  ];
  const relevantSkills: Array<{ skill: string; points: string[] }> = [];
  for (const skill of skillChoices) {
    if (relevantSkills.length >= 5) break;
    const isOwn = skills.includes(skill);
    const points = evidenceFor(skill);
    if (!isOwn && points.length === 0) continue;
    points.forEach((p) => used.add(p));
    relevantSkills.push({ skill, points });
  }

  // points already shown under Relevant skills aren't repeated, but every role keeps at least one
  const toCvRole = (e: CvProfile['experience'][number], pointsIndex: number, maxBullets: number) => {
    const unused = jobPoints[pointsIndex].filter((p) => !used.has(p));
    const bullets = unused.length ? unused : jobPoints[pointsIndex].slice(0, 1);
    return { title: e.title.trim(), employer: e.employer.trim(), dates: e.dates?.trim() ?? '', bullets: bullets.slice(0, maxBullets) };
  };

  return {
    summary,
    skills,
    credentials,
    relevantSkills,
    experience: jobs.map((e, index) => toCvRole(e, index, index < 2 ? 4 : 2)),
    volunteering: volunteer.map((e, index) => toCvRole(e, jobs.length + index, 2)),
    education: profile.education
      .filter((e) => e.qualification.trim() || e.place.trim())
      .map((e) => ({ qualification: e.qualification.trim(), place: e.place.trim(), dates: e.dates?.trim() ?? '' })),
    qualifications: (profile.qualifications ?? [])
      .filter((e) => e.qualification.trim() || e.place.trim())
      .map((e) => ({ qualification: e.qualification.trim(), place: e.place.trim(), dates: e.dates?.trim() ?? '' })),
  };
}

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
// "Sep 2025 - Present · 2 mos", "2019 – 2022", "March 2020 to June 2023"
const DATE_RANGE = new RegExp(
  `^(?:${MONTH}\\s+)?(?:19|20)\\d{2}\\s*(?:-|–|—|to)\\s*(?:present|now|current|today|(?:${MONTH}\\s+)?(?:19|20)\\d{2})`,
  'i',
);
const SINGLE_DATE = new RegExp(`^(?:${MONTH}\\s+)?(?:19|20)\\d{2}$`, 'i');
const isDateLine = (line: string) => line.length <= 60 && DATE_RANGE.test(line);
const cleanDates = (line: string) => line.split('·')[0].trim();
const isLocationLine = (line: string) =>
  line.length <= 60 &&
  line.split(' ').length <= 8 &&
  /\b(england|scotland|wales|northern ireland|united kingdom|uk|on-site|hybrid|remote)\b/i.test(line);
const isNoise = (line: string) =>
  /^skills:|^(show (all|more)|see more|…\s*see more)|^(full-time|part-time|contract|internship|apprenticeship|self-employed|freelance|permanent|temporary)\b/i.test(
    line,
  );
const PLACE = /\b(university|college|school|academy|institute|sixth form|polytechnic)\b/i;

/** Jobs from a CV or LinkedIn "Experience" section: title and employer sit just above each date line. */
function parseExperience(block: string[]): CvProfile['experience'] {
  const dateLines = block.map((line, i) => (isDateLine(line) ? i : -1)).filter((i) => i >= 0);
  return dateLines.slice(0, 8).map((dateIndex, n) => {
    const from = n > 0 ? dateLines[n - 1] + 1 : 0;
    const header = block.slice(Math.max(from, dateIndex - 2), dateIndex).filter((l) => !isNoise(l) && !isLocationLine(l));
    let [title, employer] = header.length >= 2 ? header.slice(-2) : [header[0] ?? '', ''];
    if (!employer) {
      // "Job Coach | Lighthouse Futures Trust" or "Job Coach at Lighthouse Futures Trust"
      const parts = title.split(/\s+(?:\||at|–|—|-)\s+/);
      if (parts.length === 2) [title, employer] = parts;
    }
    const end = n + 1 < dateLines.length ? dateLines[n + 1] - 2 : block.length;
    const details = block
      .slice(dateIndex + 1, Math.max(dateIndex + 1, end))
      .filter((l) => !isNoise(l) && !isLocationLine(l) && !isDateLine(l));
    return {
      title: title.trim(),
      employer: employer.split('·')[0].trim(),
      dates: cleanDates(block[dateIndex]),
      details: details.join('\n'),
    };
  });
}

/** Qualifications from an "Education" section: each school/college/university with the line next to it. */
function parseEducation(block: string[]): CvProfile['education'] {
  const isDate = (l?: string) => !!l && (isDateLine(l) || SINGLE_DATE.test(l));
  const education: CvProfile['education'] = [];
  block.forEach((line, i) => {
    if (education.length >= 5 || !PLACE.test(line) || line.length > 80) return;
    const qualification = [block[i + 1], block[i - 1]].find(
      (l) => l && !PLACE.test(l) && !isDate(l) && !isNoise(l) && !/^(grade|activities)/i.test(l) && l.length <= 100,
    );
    const dates = block.slice(i + 1, i + 4).find(isDate);
    education.push({ qualification: qualification ?? '', place: line, dates: dates ? cleanDates(dates) : '' });
  });
  return education;
}

// a date or date range inside a line: "2021-2024", "May - December 2025", "Summer Term 2022"
const isDatePart = (part: string) => part.length <= 40 && part.split(' ').length <= 6 && /\b(?:19|20)\d{2}\b/.test(part);
const pipeParts = (line: string) =>
  line
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
// "Store Assistant| Marks & Spencer|May - December 2025| Leeds" or "Listening Volunteer Training|Samaritans"
const isPipeEntry = (line: string) => line.length <= 160 && !line.includes('@') && pipeParts(line).length >= 2;
const stripBullet = (line: string) => line.replace(/^[•·\-*▪●◦]\s*/, '').trim();
// "Previous Volunteer Roles", "Professional Training/Certificates": short titles between a finished sentence and an entry
const isSubheading = (line: string, previous?: string, next?: string) =>
  line.length <= 45 &&
  line.split(' ').length <= 6 &&
  /^[A-Z]/.test(line) &&
  !/[.,;:|]$/.test(line) &&
  (!previous || /[.!?:]$/.test(previous)) &&
  !!next &&
  isPipeEntry(next);

/**
 * Jobs and qualifications from CVs that put each one on a single line split by "|" (common in Canva-style templates):
 *   Store Assistant| Marks & Spencer|May - December 2025| Leeds, England   -> a job, then what you did below it
 *   Durham University |2021-2024|Durham, England                           -> a school, then the qualification below it
 *   Support Work in School and Colleges|Realise|Level 2                     -> a course or certificate (no dates)
 */
function parsePipeEntries(lines: string[], isHeading: (line: string) => boolean) {
  const experience: CvProfile['experience'] = [];
  const education: CvProfile['education'] = [];
  const qualifications: NonNullable<CvProfile['qualifications']> = [];
  const volunteering: NonNullable<CvProfile['volunteering']> = [];
  let section = '';
  const isTrainingSection = () => /training|certificat|qualification|course|licen[cs]e/.test(section);

  // the lines under an entry, up to the next entry or heading
  const bodyOf = (from: number) => {
    const body: string[] = [];
    for (let i = from; i < lines.length; i++) {
      const line = lines[i];
      // a "|" line without dates under a school is a list of subjects, not a new entry
      if ((isPipeEntry(line) && pipeParts(line).some(isDatePart)) || isHeading(line) || /^references\b/i.test(line)) break;
      if (isSubheading(line, lines[i - 1], lines[i + 1])) break;
      body.push(line);
    }
    return body;
  };

  lines.forEach((line, i) => {
    if (isHeading(line) || isSubheading(line, lines[i - 1], lines[i + 1])) section = line.toLowerCase();
    if (!isPipeEntry(line)) return;
    const parts = pipeParts(line);
    const dateIndex = parts.findIndex(isDatePart);

    const before = dateIndex === -1 ? parts : parts.slice(0, dateIndex);
    const dates = dateIndex === -1 ? '' : parts[dateIndex];

    // training courses and certificates go to Qualifications, kept apart from school and university.
    // Undated "|" lines are only trusted as courses under a matching heading.
    if (dateIndex === -1 || (isTrainingSection() && !PLACE.test(before[0]))) {
      if (!isTrainingSection() || qualifications.length >= 10) return;
      const [qualification, place = '', level] = before;
      qualifications.push({ qualification: level ? `${qualification} (${level})` : qualification, place, dates });
      return;
    }

    const body = bodyOf(i + 1).filter((l) => !isLocationLine(l) || l.split(' ').length > 3);

    if (before.length === 1 && PLACE.test(before[0])) {
      // the qualification is the lines under the school, up to a label such as "Relevant Modules:"
      const end = body.findIndex((l) => /:$/.test(l));
      const [first, ...rest] = (end === -1 ? body : body.slice(0, end)).map(stripBullet).filter(Boolean);
      const qualification = [first, rest.map((l) => pipeParts(l).join(', ')).join(', ')].filter(Boolean).join(' – ');
      if (education.length < 10) education.push({ qualification: qualification.slice(0, 150), place: before[0], dates });
      return;
    }

    // roles under a volunteering heading ("Previous Volunteer Roles"), or called a volunteer, go to Volunteering
    const isVolunteering = /volunt/.test(section) || /\bvolunteer/i.test(before[0] ?? '');
    const roles = isVolunteering ? volunteering : experience;
    if (before.length === 0 || roles.length >= 10) return;
    // wrapped lines join back into one point; a new point starts after a full stop, at a bullet,
    // or at a capital letter after a line that stopped well short of the page width
    const points: string[] = [];
    const fullWidth = Math.max(0, ...body.map((l) => l.length));
    body.forEach((l, n) => {
      const previous = body[n - 1] ?? '';
      const isNewPoint =
        points.length === 0 ||
        /^[•·\-*▪●◦]/.test(l) ||
        /[.!?:]$/.test(points[points.length - 1]) ||
        (/^[A-Z]/.test(l) && previous.length < fullWidth * 0.7);
      if (isNewPoint) points.push(stripBullet(l));
      else points[points.length - 1] += ` ${l}`;
    });
    roles.push({ title: before[0], employer: before[1] ?? '', dates, details: points.join('\n') });
  });

  return { experience, education, qualifications, volunteering };
}

// "L E E D S , U N I T E D K I N G D O M | 0 7 4 0 7 ..." -> "LEEDS,UNITEDKINGDOM|07407..."
const unspaceLetters = (line: string) => {
  const tokens = line.split(' ');
  return tokens.length >= 8 && tokens.filter((t) => t.length === 1).length / tokens.length > 0.8 ? tokens.join('') : line;
};
const titleCase = (value: string) =>
  value === value.toUpperCase() ? value.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : value;

/**
 * Pick out the easy-to-spot details from a CV or LinkedIn profile's text, to pre-fill the CV Builder.
 * Anything it isn't sure about is left out.
 */
export function parseCvText(text: string, pageTitle?: string): Partial<CvProfile> {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // LinkedIn repeats each line for screen readers
    .filter((l, i, all) => l !== all[i - 1]);

  // contact details are sometimes spaced out letter by letter
  const contactText = lines.map(unspaceLetters).join('\n');
  const email = contactText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0]?.toLowerCase();
  const phone = contactText
    .match(/(?:\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}|(?:\+44\s?|0)(?:\d\s?){9,10}/)?.[0]
    ?.trim();
  const linkedinUrl = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i)?.[0];

  // LinkedIn page titles look like "(3) Alex Taylor | LinkedIn"; a CV usually starts with the name
  const fromTitle = pageTitle?.replace(/^\(\d+\)\s*/, '').split(/\s[|–-]\s/)[0]?.trim();
  const looksLikeName = (value?: string) => !!value && /^[A-Za-z][A-Za-z' .-]{1,40}$/.test(value) && value.split(' ').length <= 4;

  // skills: the lines under a "Skills" heading, up to the next heading
  // compared without spaces, since PDFs sometimes space out headings ("E XPERIENCE")
  const squash = (line: string) => line.replace(/\s+/g, '').toLowerCase();
  const headings =
    /^(experience|workexperience|employment|employmenthistory|education|qualifications|languages|interests|hobbies|references|certifications|licen[cs]es|projects|volunteering|about|activity|recommendations|profile|summary|professionalsummary|personalstatement|personalprofile|careerprofile|careersummary|professionaltraining|training|courses)/;
  const isHeading = (line: string) => line.length <= 40 && headings.test(squash(line));

  // a CV usually starts with the name, but two-column layouts can put it lower down
  const nameLine = lines
    .slice(0, 30)
    .find((l) => looksLikeName(l) && l.split(' ').length >= 2 && !isHeading(l) && /^[A-Z]/.test(l));
  const fullName = looksLikeName(fromTitle)
    ? fromTitle
    : looksLikeName(lines[0])
      ? lines[0]
      : nameLine
        ? titleCase(nameLine)
        : undefined;
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
  // two-column CVs can list the headings together and the skills further down:
  // then take the first run of 3+ short phrases ("Coaching and Mentoring", "Relationship Building", ...)
  if (start !== -1 && !skills?.length) {
    const isPhrase = (l: string) =>
      l.length <= 45 &&
      l.split(' ').length <= 6 &&
      /^[A-Z]/.test(l) &&
      !/[\d|@:.,]/.test(l) &&
      !isHeading(l) &&
      l.toLowerCase() !== fullName?.toLowerCase() &&
      !PLACE.test(l);
    let run: string[] = [];
    for (const line of lines) {
      if (isPhrase(line)) run.push(line);
      else if (run.length >= 3) break;
      else run = [];
    }
    if (run.length >= 3) skills = run.slice(0, 20);
  }

  // the lines of a section, from its heading up to the next heading
  const sectionLines = (heading: RegExp) => {
    const index = lines.findIndex((l) => heading.test(squash(l)) && l.length <= 30);
    if (index === -1) return [];
    const block: string[] = [];
    for (const line of lines.slice(index + 1)) {
      if (headings.test(squash(line)) && line.length <= 30) break;
      if (/^(key|core|technical)?skills$/.test(squash(line))) break;
      block.push(line);
    }
    return block;
  };
  // one-line "Title | Employer | Dates" entries first, then the LinkedIn-style layout (title and employer above a date line)
  const pipeEntries = parsePipeEntries(lines, isHeading);
  const experience = pipeEntries.experience.length
    ? pipeEntries.experience
    : parseExperience(
        sectionLines(/^(work|professional|employment|career)?(experience|employment|employmenthistory|history)$/),
      ).filter((e) => e.title || e.employer);
  const education = pipeEntries.education.length
    ? pipeEntries.education
    : parseEducation(sectionLines(/^(education|qualifications|educationandqualifications)$/));
  // e.g. "Leeds, England, United Kingdom" near the top of a LinkedIn profile,
  // or the town in a CV's contact line ("Leeds, United Kingdom | 07... | name@...")
  const contactLine = contactText.split('\n').find((l) => l.includes('@') && l.includes('|'));
  const location =
    lines
      .slice(0, 25)
      .find((l) => /^[A-Z][A-Za-z .'-]+, (England|Scotland|Wales|Northern Ireland|United Kingdom|UK)\b/.test(l) && l.length <= 60)
      ?.split(',')[0]
      .trim() ??
    (contactLine &&
      pipeParts(contactLine)
        .map((p) => p.split(',')[0].trim())
        .find((p) => /^[A-Za-z][A-Za-z .'-]{1,30}$/.test(p)));

  return {
    ...(fullName && { fullName }),
    ...(email && { email }),
    ...(phone && { phone }),
    ...(location && { location: titleCase(location) }),
    ...(linkedinUrl && { linkedinUrl: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}` }),
    ...(skills?.length && { skills }),
    ...(experience.length && { experience }),
    ...(education.length && { education }),
    ...(pipeEntries.qualifications.length && { qualifications: pipeEntries.qualifications }),
    ...(pipeEntries.volunteering.length && { volunteering: pipeEntries.volunteering }),
  };
}

// a comma before the last "and" when an item has its own "and" ("safeguarding, training and mentoring, and teamwork")
const joinList = (items: string[]) =>
  items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')}${items.length > 2 && items.some((i) => / and /.test(i)) ? ',' : ''} and ${items[items.length - 1]}`;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** A complete, printable A4 HTML page for the CV (used for the preview and the PDF). */
export function renderCvHtml({ cv, profile }: { cv: GeneratedCv; profile: CvProfile }): string {
  const e = escapeHtml;
  const contact = [profile.email, profile.phone, profile.location, profile.linkedinUrl?.replace(/^https?:\/\/(www\.)?/, '')]
    .map((v) => v?.trim())
    .filter(Boolean) as string[];

  // Laid out like the University of Oxford Careers Service's skills-based CV: centred name and contact details,
  // grey rules between sections, a career profile, the top skills with evidence, then work and education
  const section = (title: string, body: string) => (body ? `<section><h2>${title}</h2>${body}</section>` : '');
  const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${e(i)}</li>`).join('')}</ul>` : '');
  // "Title, Employer" in bold with the dates on the right
  const heading = (main: string, dates?: string) =>
    `<div class="row"><strong>${e(main)}</strong>${dates ? `<strong class="dates">${e(dates)}</strong>` : ''}</div>`;

  // the five skills that matter most; each with its evidence when there is some, otherwise a plain bullet
  const topSkills = cv.relevantSkills?.length ? cv.relevantSkills : cv.skills.slice(0, 5).map((skill) => ({ skill, points: [] as string[] }));
  const withEvidence = topSkills.filter((s) => s.points.length);
  // every other skill on the candidate's list (which includes each "What employers want" skill they have) still
  // shows, on one line, so nothing employers ask for is left off; checks and licences are in the courses section
  const otherSkills = cv.skills.filter((s) => !topSkills.some((t) => t.skill === s));
  const relevantSkills =
    (withEvidence.length > 0
      ? topSkills.map((s) => `<div class="item"><h3>${e(s.skill)}</h3>${list(s.points)}</div>`).join('')
      : list(topSkills.map((s) => s.skill))) +
    (otherSkills.length ? `<p class="more"><strong>Other skills:</strong> ${otherSkills.map(e).join(', ')}</p>` : '');

  const roles = (items: GeneratedCv['experience']) =>
    items
      .map(
        (job) =>
          `<div class="item">${heading([job.title, job.employer].filter(Boolean).join(', '), job.dates)}${list(job.bullets)}</div>`,
      )
      .join('');
  const experience = roles(cv.experience);
  const volunteering = roles(cv.volunteering ?? []);
  // courses and certificates (no dates, not a school) go with the checks and licences, as in the Oxford example
  const PLACE_WORDS = /\b(university|college|school|academy|institute|sixth form|polytechnic)\b/i;
  const isCourse = (ed: GeneratedCv['education'][number]) => !ed.dates && !PLACE_WORDS.test(ed.place);
  const education = cv.education
    .filter((ed) => !isCourse(ed))
    .map(
      (ed) =>
        `<div class="item">${heading(ed.place || ed.qualification, ed.dates)}${ed.place && ed.qualification ? `<p>${e(ed.qualification)}</p>` : ''}</div>`,
    )
    .join('');
  const courses = [
    ...[...(cv.qualifications ?? []), ...cv.education.filter(isCourse)].map((q) =>
      [[q.qualification, q.place].filter(Boolean).join(', '), q.dates].filter(Boolean).join(' – '),
    ),
    ...(cv.credentials ?? []),
  ];

  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>${e(profile.fullName)} - CV</title>
<style>
  @page { size: A4; margin: 15mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; color: #000; font-size: 11pt; line-height: 1.35; background: #fff; }
  .page { max-width: 174mm; margin: 0 auto; }
  header { text-align: center; padding-bottom: 8px; }
  h1 { margin: 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .contact div { margin-top: 1px; }
  section { border-top: 1.5px solid #a6a6a6; margin-top: 10px; padding-top: 4px; }
  h2 { margin: 0 0 6px; font-size: 11.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
  h3 { margin: 8px 0 1px; font-size: 11pt; font-weight: bold; }
  p { margin: 0; }
  .item { margin-bottom: 8px; page-break-inside: avoid; }
  .row { display: flex; justify-content: space-between; gap: 16px; }
  .dates { white-space: nowrap; }
  ul { margin: 2px 0 0; padding-left: 22px; }
  li { margin: 1px 0; }
  .more { margin-top: 8px; }
</style></head>
<body><div class="page">
  <header>
    <h1>${e(profile.fullName || 'Your name')}</h1>
    ${contact.length ? `<div class="contact">${contact.map((c) => `<div>${e(c)}</div>`).join('')}</div>` : ''}
  </header>
  ${section('Career profile', cv.summary ? `<p>${e(cv.summary)}</p>` : '')}
  ${section('Relevant skills', relevantSkills)}
  ${section('Work experience', experience)}
  ${section('Volunteering', volunteering)}
  ${section('Education', education)}
  ${section('Relevant courses and certificates', list(courses))}
</div></body></html>`;
}
