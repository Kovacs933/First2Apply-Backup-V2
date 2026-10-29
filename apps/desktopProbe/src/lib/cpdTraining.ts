import { CvProfile } from '@first2apply/core';

import { isChosenJob, personSpecification } from './cvBuilder';
import { removeCss } from './tidyDescription';

/** The parts of a saved job the training finder reads. */
export type TrainingSourceJob = {
  id: number;
  title: string;
  companyName: string;
  description?: string | null;
  tags?: string[] | null;
  status?: string;
};

/** What each UK qualification level is equal to (GOV.UK "What qualification levels mean"). */
export const LEVEL_MEANING: Record<number, string> = {
  1: 'equal to GCSE grades 3 to 1',
  2: 'equal to GCSE grades 9 to 4',
  3: 'equal to A level',
  4: 'equal to a higher national certificate (HNC)',
  5: 'equal to a higher national diploma (HND)',
  6: 'equal to a degree',
  7: "equal to a master's degree",
};

type CatalogueEntry = {
  name: string;
  // matched whatever the capitals ("Positive Behaviour Support", "positive behaviour support")
  pattern: RegExp;
  // an acronym that's an ordinary word in lower case ("BASE"), matched in capitals only
  acronym?: RegExp;
  level?: number;
  // what to type into the National Careers Service course search
  search: string;
  // one plain sentence on what it is; only for well known qualifications
  about?: string;
};

/**
 * Named UK qualifications, licences and training that adverts ask for, most specific first: an advert that says
 * "Level 3 Diploma in Adult Care" counts for that, not also for the general "Health and social care" entries.
 */
const CATALOGUE: CatalogueEntry[] = [
  // health and social care
  {
    name: 'Level 5 Diploma in Leadership and Management for Adult Care',
    pattern: /level 5[^.\n]{0,60}(leadership|management)[^.\n]{0,40}(adult care|social care|health)/i,
    level: 5,
    search: 'Diploma in Leadership and Management for Adult Care',
    about: 'For managers and senior staff in adult social care.',
  },
  {
    name: 'Level 3 Diploma in Adult Care',
    pattern: /level 3[^.\n]{0,40}(health and social care|adult (social )?care)|\b(NVQ|QCF|RQF)\b[^.\n]{0,15}(level )?3[^.\n]{0,30}care/i,
    level: 3,
    search: 'Diploma in Adult Care',
    about: 'The qualification for senior and lead adult care workers.',
  },
  {
    name: 'Level 2 Diploma in Care',
    pattern: /level 2[^.\n]{0,40}(health and social care|adult (social )?care|\bin care\b)|\b(NVQ|QCF|RQF)\b[^.\n]{0,15}(level )?2[^.\n]{0,30}care/i,
    level: 2,
    search: 'Diploma in Care',
    about: 'The qualification for care workers and support workers.',
  },
  {
    name: 'Care Certificate',
    pattern: /\bcare certificate\b/i,
    search: 'Care Certificate',
    about: 'The standards new health and social care workers in England are expected to meet.',
  },
  // employment support, advice and careers
  {
    name: 'Level 6 Diploma in Career Guidance and Development (QCG)',
    pattern: /\bQCG\b|level 6[^.\n]{0,30}career|career(s)? (guidance|development) (qualification|diploma)/i,
    level: 6,
    search: 'Diploma in Career Guidance and Development',
    about: 'The professional qualification for careers advisers.',
  },
  {
    name: 'Information, Advice and Guidance (IAG) Level 3 or 4',
    pattern: /\bIAG\b|information,? advice,? (and|&) guidance|advice and guidance (qualification|level)/i,
    level: 3,
    search: 'Advice and Guidance',
    about: 'Training in giving advice and guidance, often asked for in employment and careers support roles.',
  },
  {
    name: 'Supported employment qualification (BASE)',
    pattern: /supported employment (qualification|certificate|level|practice)/,
    acronym: /\bBASE\b/,
    search: 'Supported Employment',
  },
  {
    name: 'Training in Systematic Instruction (TSI)',
    pattern: /\bTSI\b|systematic instruction/i,
    search: 'Systematic Instruction',
    about: 'A step-by-step way of teaching job tasks, widely used by job coaches in supported employment.',
  },
  {
    name: 'Individual Placement and Support (IPS) training',
    pattern: /individual placement and support|\bIPS\b/i,
    search: 'Individual Placement and Support',
    about: 'The employment support model used in NHS mental health services.',
  },
  {
    name: 'Employability qualification',
    pattern: /employability (practice|qualification|award|certificate)/i,
    search: 'Employability',
  },
  // teaching, training and assessing
  {
    name: 'Level 5 Diploma in Education and Training (DET)',
    pattern: /diploma in (education and training|teaching)|\bDTLLS\b|\bDET\b/,
    level: 5,
    search: 'Diploma in Education and Training',
    about: 'A teaching qualification for further education and adult learning.',
  },
  {
    name: 'Level 4 Certificate in Education and Training',
    pattern: /certificate in education and training|\bCTLLS\b/i,
    level: 4,
    search: 'Certificate in Education and Training',
  },
  {
    name: 'Level 3 Award in Education and Training',
    // not "a relevant training qualification", which is usually about the job's own training (TSI for job coaches)
    pattern: /award in education and training|\bPTLLS\b|\bAET\b|teaching qualification/i,
    level: 3,
    search: 'Award in Education and Training',
    about: 'An introduction to teaching and training adults.',
  },
  {
    name: 'Level 3 Certificate in Assessing Vocational Achievement (TAQA)',
    pattern: /\bTAQA\b|\bCAVA\b|assessor (award|qualification)|assessing vocational/i,
    level: 3,
    search: 'Assessing Vocational Achievement',
  },
  {
    name: 'Level 4 Internal Quality Assurance (IQA)',
    pattern: /\bIQA\b|internal quality assur/i,
    level: 4,
    search: 'Internal Quality Assurance',
  },
  {
    name: 'Level 3 Supporting Teaching and Learning',
    pattern: /supporting teaching and learning|teaching assistant (level|qualification)/i,
    level: 3,
    search: 'Supporting Teaching and Learning',
  },
  {
    name: 'Level 3 Early Years Educator',
    pattern: /level 3[^.\n]{0,30}(childcare|early years)|early years educator/i,
    level: 3,
    search: 'Early Years Educator',
  },
  { name: 'Qualified Teacher Status (QTS)', pattern: /\bQTS\b|qualified teacher status/i, search: 'QTS' },
  // safeguarding, behaviour, mental health and communication
  {
    name: 'Designated Safeguarding Lead training',
    pattern: /designated safeguarding (lead|officer)|\bDSL\b/,
    search: 'Designated Safeguarding Lead',
  },
  {
    name: 'Safeguarding training (Level 2 or 3)',
    // any advert that expects you to understand safeguarding: training is how you show it
    pattern: /\bsafeguarding\b/i,
    search: 'Safeguarding',
  },
  {
    name: 'Mental Health First Aid',
    pattern: /mental health first aid(er)?|\bMHFA\b/i,
    search: 'Mental Health First Aid',
    about: "A short course in spotting and supporting someone who's struggling with their mental health.",
  },
  {
    name: 'Level 2 Certificate in Mental Health Awareness',
    // asking for it, or for supporting people with mental health needs (not "Mental Health" in an employer's name)
    pattern: /mental health (awareness|qualification|training|conditions?|needs|problems|difficulties|issues|challenges)|(supporting|support) people with mental health/i,
    level: 2,
    search: 'Mental Health Awareness',
  },
  {
    name: 'Level 2 Certificate in Understanding Autism',
    pattern: /autism (awareness|training|qualification)|understanding autism/i,
    level: 2,
    search: 'Understanding Autism',
  },
  {
    name: 'Positive Behaviour Support (PBS) training',
    pattern: /positive behaviour(al)? support|\bPBS\b/,
    search: 'Positive Behaviour Support',
  },
  { name: 'Team Teach', pattern: /team teach/i, search: 'Team Teach' },
  { name: 'MAPA (Management of Actual or Potential Aggression)', pattern: /\bMAPA\b/, search: 'MAPA' },
  { name: 'Makaton', pattern: /\bmakaton\b/i, search: 'Makaton' },
  {
    name: 'British Sign Language (BSL) Level 1 or 2',
    pattern: /\bBSL\b|british sign language/i,
    level: 1,
    search: 'British Sign Language',
  },
  // first aid, food and safety
  {
    name: 'Paediatric First Aid',
    pattern: /paediatric first aid/i,
    search: 'Paediatric First Aid',
  },
  {
    name: 'Emergency First Aid at Work (1 day)',
    pattern: /emergency first aid at work|\bEFAW\b/i,
    level: 3,
    search: 'Emergency First Aid at Work',
  },
  {
    name: 'First Aid at Work (3 days)',
    pattern: /(?<!emergency |mental health |paediatric )first aid (at work|certificate|qualification|trained|training)|\bFAW\b/i,
    level: 3,
    search: 'First Aid at Work',
  },
  {
    name: 'Level 2 Food Hygiene and Safety',
    pattern: /food (hygiene|safety)[^.\n]{0,30}(level 2|certificate)|level 2[^.\n]{0,30}food (hygiene|safety)/i,
    level: 2,
    search: 'Food Safety',
  },
  { name: 'IOSH Managing Safely', pattern: /\bIOSH\b/, search: 'IOSH Managing Safely' },
  { name: 'NEBOSH General Certificate', pattern: /\bNEBOSH\b/, level: 3, search: 'NEBOSH' },
  // office, HR, finance and management
  {
    name: 'GCSE English and maths (grade 4 / C) or Functional Skills Level 2',
    pattern: /\bGCSEs?\b[^.\n]{0,40}(english|maths)|functional skills|level 2 (english|maths)/i,
    level: 2,
    search: 'Functional Skills',
  },
  { name: 'CIPD Level 5 (HR or Learning and Development)', pattern: /\bCIPD\b[^.\n]{0,25}level 5|level 5[^.\n]{0,25}\bCIPD\b/, level: 5, search: 'CIPD Level 5' },
  { name: 'CIPD Level 3 (HR or Learning and Development)', pattern: /\bCIPD\b/, level: 3, search: 'CIPD Level 3' },
  { name: 'AAT Level 3 or 4 (accounting)', pattern: /\bAAT\b/, level: 3, search: 'AAT' },
  { name: 'ACCA, CIMA or ACA (chartered accountancy)', pattern: /\bACCA\b|\bCIMA\b|\bACA\b/, level: 7, search: 'ACCA' },
  { name: 'ILM or CMI Level 3 or 5 in Leadership and Management', pattern: /\bILM\b|\bCMI\b|management qualification/i, level: 3, search: 'Leadership and Management' },
  { name: 'PRINCE2 Foundation', pattern: /\bPRINCE ?2\b/i, search: 'PRINCE2' },
  { name: 'APM Project Fundamentals (PFQ)', pattern: /\bAPM\b|\bPFQ\b|\bPMQ\b/, search: 'Project Management' },
  { name: 'ICDL / ECDL (computer skills)', pattern: /\bICDL\b|\bECDL\b/, search: 'ICDL' },
  // IT and data
  { name: 'ITIL 4 Foundation', pattern: /\bITIL\b/, search: 'ITIL' },
  { name: 'CompTIA A+ / Network+ / Security+', pattern: /\bcomptia\b/i, search: 'CompTIA' },
  { name: 'Microsoft Power BI Data Analyst (PL-300)', pattern: /\bPL-300\b|power bi (certification|certified)/i, search: 'Power BI' },
  { name: 'Microsoft Azure Fundamentals (AZ-900)', pattern: /\bAZ-900\b|azure (certification|certified)/i, search: 'Azure' },
  // trades, logistics, security and hospitality
  { name: 'CSCS card', pattern: /\bCSCS\b/, search: 'CSCS' },
  { name: 'SMSTS or SSSTS (site safety)', pattern: /\bSMSTS\b|\bSSSTS\b/, search: 'SMSTS' },
  { name: '18th Edition Wiring Regulations (BS 7671)', pattern: /18th edition|\bBS ?7671\b/i, level: 3, search: '18th Edition' },
  { name: 'SIA licence (door supervisor, security or CCTV)', pattern: /\bSIA\b/, level: 2, search: 'Door Supervisor' },
  { name: 'Forklift (FLT) licence', pattern: /\bforklift\b|\bFLT\b|\bcounterbalance\b/i, search: 'Forklift' },
  { name: 'Driver CPC', pattern: /\bdriver CPC\b|\bCPC\b/, search: 'Driver CPC' },
  { name: 'Personal Licence (APLH, selling alcohol)', pattern: /personal licen[cs]e|\bAPLH\b/i, level: 2, search: 'Personal Licence Holders' },
  {
    name: 'Degree',
    // not "a high degree of", "360 degree" or "graduate scheme"
    pattern: /\b(?:a|relevant|university|bachelor'?s|undergraduate|honours|BA|BSc)\s+degree\b(?! of)|\bdegree[- ](?:level|educated|qualified)\b/i,
    level: 6,
    search: 'Degree',
  },
];

// "Level 3 Certificate in Counselling Skills", "NVQ Level 2 in Business Administration", "Diploma in Youth Work".
// Case matters: the subject starts with a capital, so "a certificate in the post" isn't a qualification.
const NAMED_QUALIFICATION =
  /\b(?:(?:[Ll]evel|L)\s?([1-7])\s+(?:[A-Za-z]+\s+){0,2}(?:[Aa]ward|[Cc]ertificate|[Dd]iploma|[Qq]ualification|NVQ|QCF|RQF)|(?:NVQ|QCF|RQF)\s+(?:[Ll]evel\s?)?([1-7])|(?:Award|Certificate|Diploma))\s+in\s+([A-Z][A-Za-z&' -]{3,60}?)(?=\s*[.;:,\n()/]|\s+(?:or|is|are|would|will|desirable|essential|preferred|required|with|to|as|from|at|and (?:a|an|the|experience|knowledge|ability|skills|willing))\b|\s*$)/g;

export type TrainingMention = {
  jobId: number;
  title: string;
  companyName: string;
  // where the advert asks for it: in its essential requirements, as desirable, or just mentioned
  strength: 'essential' | 'desirable' | 'mentioned';
  // the advert's sentence that mentions it
  quote: string;
};

export type TrainingRecommendation = {
  name: string;
  level?: number;
  about?: string;
  courseSearchUrl: string;
  mentions: TrainingMention[];
  essentialCount: number;
  desirableCount: number;
  // already in the candidate's CV Builder details
  onCv: boolean;
};

/** The sentence around a match, shortened to about 200 characters. */
function sentenceAround(text: string, index: number, length: number) {
  const before = text.lastIndexOf('\n', index);
  const startCandidates = [before, text.lastIndexOf('. ', index)].filter((i) => i >= 0);
  const start = startCandidates.length ? Math.max(...startCandidates) + 1 : 0;
  const endCandidates = [text.indexOf('\n', index + length), text.indexOf('. ', index + length)].filter((i) => i >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) + 1 : text.length;
  let sentence = text.slice(start, end).replace(/[*_#>]+/g, '').replace(/\s+/g, ' ').trim();
  if (sentence.length > 200) {
    const at = Math.max(0, index - start - 80);
    sentence = `${at > 0 ? '... ' : ''}${sentence.slice(at, at + 200).trim()} ...`;
  }
  return sentence;
}

function strengthOf(description: string, sentence: string, index: number): TrainingMention['strength'] {
  if (/\b(desirable|preferred|advantage(ous)?|bonus|ideally|nice to have)\b/i.test(sentence)) return 'desirable';
  if (/\b(essential|must|required|requirement|you will (need|have)|need to have|mandatory)\b/i.test(sentence)) return 'essential';
  // in the person specification, as something the candidate has ("Knowledge of safeguarding"), not a line about
  // the people the service supports ("people experiencing mental health challenges")
  const asksForIt =
    /\b(experience|knowledge|understanding|qualification|qualified|hold|holding|trained|training|certificate|certified|ability|able to|awareness|GCSEs?|grade|degree|level \d|licen[cs]e)\b/i;
  const spec = personSpecification(description);
  if (spec && index >= description.length - spec.length) {
    // the nearest "Essential" or "Desirable" heading above it decides; with neither, only a line that asks for it
    const above = description.slice(description.length - spec.length, index).toLowerCase();
    const essentialAt = above.lastIndexOf('essential');
    const desirableAt = above.lastIndexOf('desirable');
    if (desirableAt > essentialAt) return 'desirable';
    const isListItem = /^\s*(?:[-*·•●]|\d+[.)])\s/.test(sentence);
    if ((essentialAt >= 0 && isListItem) || asksForIt.test(sentence)) return 'essential';
  }
  return 'mentioned';
}

const entryPatterns = (entry: CatalogueEntry) => [
  new RegExp(entry.pattern.source, 'gi'),
  ...(entry.acronym ? [new RegExp(entry.acronym.source, 'g')] : []),
];

const courseSearchUrl = (term: string) =>
  `https://nationalcareers.service.gov.uk/find-a-course/searchcourse?searchTerm=${encodeURIComponent(term)}`;

/**
 * The training and qualifications the candidate's saved jobs ask for, so they can plan what to learn next (CPD).
 * Named qualifications from the list above come first; others an advert names ("Level 3 Certificate in Counselling
 * Skills") are added as they're written. Ranked by how many saved jobs ask for it, essential requirements counting
 * most. Only jobs on the Saved tab or applied to are read: they're the jobs the candidate actually wants.
 */
export function findTrainingRecommendations(jobs: TrainingSourceJob[], profile: CvProfile): TrainingRecommendation[] {
  const savedJobs = jobs.filter((job) => isChosenJob(job) && job.description?.trim());
  const own = [
    ...profile.skills,
    ...profile.education.flatMap((e) => [e.qualification, e.place]),
    ...(profile.qualifications ?? []).flatMap((q) => [q.qualification, q.place]),
  ].join('\n');

  const found = new Map<string, TrainingRecommendation>();
  const add = (key: string, base: Omit<TrainingRecommendation, 'mentions' | 'essentialCount' | 'desirableCount'>, mention: TrainingMention) => {
    const recommendation = found.get(key) ?? { ...base, mentions: [], essentialCount: 0, desirableCount: 0 };
    // one advert saved twice (the same job from two searches) counts once
    const sameJob = (m: TrainingMention) =>
      m.jobId === mention.jobId ||
      (m.title.toLowerCase() === mention.title.toLowerCase() && m.companyName.toLowerCase() === mention.companyName.toLowerCase());
    if (recommendation.mentions.some(sameJob)) return;
    recommendation.mentions.push(mention);
    if (mention.strength === 'essential') recommendation.essentialCount++;
    if (mention.strength === 'desirable') recommendation.desirableCount++;
    found.set(key, recommendation);
  };

  for (const job of savedJobs) {
    // some saved Indeed adverts still hold the page's CSS ("#react-native-html-content { ... }")
    const description = removeCss(job.description ?? '');
    const text = [description, ...(job.tags ?? [])].join('\n');
    const mentionAt = (index: number, length: number): TrainingMention => {
      const quote = sentenceAround(text, index, length);
      return {
        jobId: job.id,
        title: job.title,
        companyName: job.companyName,
        strength: strengthOf(description, quote, index),
        quote,
      };
    };

    // the parts of the advert already counted for a more specific qualification
    const counted: Array<[number, number]> = [];
    for (const entry of CATALOGUE) {
      const patterns = entryPatterns(entry);
      const match = patterns
        .flatMap((pattern) => [...text.matchAll(pattern)])
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .find((m) => !counted.some(([s, e]) => (m.index ?? 0) < e && (m.index ?? 0) + m[0].length > s));
      if (!match) continue;
      const start = match.index ?? 0;
      counted.push([start, start + match[0].length]);
      add(
        entry.name,
        {
          name: entry.name,
          level: entry.level,
          about: entry.about,
          courseSearchUrl: courseSearchUrl(entry.search),
          onCv: patterns.some((pattern) => new RegExp(pattern.source, pattern.flags.replace('g', '')).test(own)),
        },
        mentionAt(start, match[0].length),
      );
    }

    // other qualifications the advert names, written as the advert writes them
    for (const match of text.matchAll(NAMED_QUALIFICATION)) {
      const start = match.index ?? 0;
      if (counted.some(([s, e]) => start < e && start + match[0].length > s)) continue;
      const level = Number(match[1] ?? match[2]) || undefined;
      const subject = match[3].trim().replace(/\s+/g, ' ');
      const kind = match[0].match(/\b(award|certificate|diploma|nvq|qualification)\b/i)?.[1] ?? 'qualification';
      const name = `${level ? `Level ${level} ` : ''}${kind.toUpperCase() === 'NVQ' ? 'NVQ' : kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase()} in ${subject}`;
      add(
        name.toLowerCase(),
        {
          name,
          level,
          courseSearchUrl: courseSearchUrl(subject),
          onCv: own.toLowerCase().includes(subject.toLowerCase()),
        },
        mentionAt(start, match[0].length),
      );
    }
  }

  return [...found.values()].sort(
    (a, b) =>
      b.essentialCount * 3 + b.mentions.length + b.desirableCount - (a.essentialCount * 3 + a.mentions.length + a.desirableCount) ||
      a.name.localeCompare(b.name),
  );
}
