import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BrowserWindow, BrowserWindowHandle } from '@/components/browserWindow';
import { Icons } from '@/components/icons';
import { useError } from '@/hooks/error';
import {
  EmployerSkill,
  buildTemplateCv,
  candidateHasSkill,
  findEmployerSkills,
  jobsForRole,
  parseCvText,
  renderCvHtml,
} from '@/lib/cvBuilder';
import { CvBuilderState, loadCvBuilderState, saveCvBuilderState } from '@/lib/cvProfileStore';
import {
  CvSourceJob,
  generateCv,
  listJobsWithDescriptions,
  overlayBrowserPageText,
  readCvFile,
  saveCvPdf,
} from '@/lib/electronMainSdk';
import { cn } from '@/lib/utils';
import { CvProfile, GeneratedCv } from '@first2apply/core';
import { Button, Input, Label, Textarea, useToast } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';

type SavedState = CvBuilderState;

/**
 * CV builder: the candidate enters the role they want and their details, and Foundation builds a CV that puts first
 * what employers in their found jobs ask for, written with AI or laid out in a template.
 */
export function CvPage() {
  const { handleError } = useError();
  const { toast } = useToast();

  const [state, setState] = useState<SavedState>(loadCvBuilderState);
  const { targetRole, profile, existingCv, mode } = state;
  const update = (changes: Partial<SavedState>) => setState((current) => ({ ...current, ...changes }));
  const updateProfile = (changes: Partial<CvProfile>) => update({ profile: { ...profile, ...changes } });

  const [skillsText, setSkillsText] = useState(profile.skills.join(', '));
  const [foundJobs, setFoundJobs] = useState<CvSourceJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [cv, setCv] = useState<GeneratedCv | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => saveCvBuilderState(state), [state]);

  /**
   * Fill the empty fields from a CV or LinkedIn profile's text, and keep the full text for the AI.
   */
  const importText = (text: string, source: string, pageTitle?: string, extra: Partial<CvProfile> = {}) => {
    const found = { ...parseCvText(text, pageTitle), ...extra };
    const filled: Partial<CvProfile> = {};
    (['fullName', 'email', 'phone', 'linkedinUrl'] as const).forEach((key) => {
      if (found[key] && !profile[key]?.trim()) filled[key] = found[key];
    });
    if (found.skills?.length && profile.skills.length === 0) {
      filled.skills = found.skills;
      setSkillsText(found.skills.join(', '));
    }
    setState((current) => ({
      ...current,
      profile: { ...current.profile, ...filled },
      existingCv: [current.existingCv.trim(), `${source}:\n${text}`].filter(Boolean).join('\n\n'),
    }));
    toast({
      title: `${source} added`,
      description:
        Object.keys(filled).length > 0
          ? 'We filled in what we could below. Check it, and choose "Write it with AI" to use all of it.'
          : 'Choose "Write it with AI" below and it will use everything in it.',
    });
  };

  const onUploadCv = async () => {
    try {
      const file = await readCvFile();
      if (file) importText(file.text, `Your CV (${file.fileName})`);
    } catch (error) {
      handleError({ error, title: "Couldn't read your CV" });
    }
  };

  // LinkedIn: open the profile in the in-app browser (signed in there), then read the page
  const linkedinBrowserRef = useRef<BrowserWindowHandle>(null);
  const [linkedinInput, setLinkedinInput] = useState(profile.linkedinUrl ?? '');
  const onOpenLinkedin = async () => {
    const url = linkedinInput.trim();
    try {
      await linkedinBrowserRef.current?.open(
        /linkedin\.com\/in\//i.test(url) ? (url.startsWith('http') ? url : `https://${url}`) : 'https://www.linkedin.com/in/me/',
      );
    } catch (error) {
      handleError({ error, title: "Couldn't open LinkedIn" });
    }
  };
  const onImportLinkedin = async () => {
    try {
      const page = await overlayBrowserPageText();
      await linkedinBrowserRef.current?.finish();
      if (!/linkedin\.com\/in\//i.test(page.url)) {
        throw new Error('Open your own LinkedIn profile page first (linkedin.com/in/...), then click Import this profile.');
      }
      const profileUrl = page.url.split('?')[0];
      setLinkedinInput(profileUrl);
      importText(page.text, 'Your LinkedIn profile', page.title, { linkedinUrl: profileUrl });
    } catch (error) {
      handleError({ error, title: "Couldn't import your LinkedIn profile" });
    }
  };

  useEffect(() => {
    listJobsWithDescriptions()
      .then(setFoundJobs)
      .catch((error) => handleError({ error, title: "Couldn't load your jobs" }))
      .finally(() => setIsLoadingJobs(false));
  }, []);

  const roleJobs = useMemo(() => jobsForRole(foundJobs, targetRole), [foundJobs, targetRole]);
  const employerSkills = useMemo<EmployerSkill[]>(() => findEmployerSkills(roleJobs), [roleJobs]);

  const setSkills = (text: string) => {
    setSkillsText(text);
    updateProfile({ skills: text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) });
  };
  const addSkill = (skill: string) => setSkills(skillsText.trim() ? `${skillsText.trim().replace(/,$/, '')}, ${skill}` : skill);

  const canCreate = !!targetRole.trim() && !!profile.fullName.trim();

  const onCreate = async () => {
    setIsWriting(true);
    try {
      if (mode === 'template') {
        setCv(buildTemplateCv({ profile, targetRole, employerSkills }));
      } else {
        const written = await generateCv({
          targetRole,
          profile,
          existingCv,
          employerSkills,
          jobsAnalysed: roleJobs.length,
          sampleJobs: roleJobs.slice(0, 4).map((job) => ({
            title: job.title,
            companyName: job.companyName,
            description: job.description ?? '',
          })),
        });
        setCv(written);
      }
    } catch (error) {
      handleError({ error, title: "Couldn't create your CV" });
    } finally {
      setIsWriting(false);
    }
  };

  const cvHtml = cv ? renderCvHtml({ cv, profile }) : '';
  const onDownload = async () => {
    setIsSaving(true);
    try {
      const fileName = `${profile.fullName.trim() || 'My'} CV - ${targetRole.trim()}.pdf`.replace(/[\\/:*?"<>|]/g, '');
      const { saved } = await saveCvPdf({ html: cvHtml, fileName });
      if (saved) toast({ title: 'CV saved', description: 'Your CV has been saved as a PDF.' });
    } catch (error) {
      handleError({ error, title: "Couldn't save the PDF" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DefaultLayout className="flex flex-col space-y-12 p-6 md:p-10">
      <div className="space-y-3">
        <h1 className="w-fit text-2xl font-medium tracking-wide">CV Builder</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          Tell Foundation the job you want. It looks at the jobs it has found for you, works out what those employers
          ask for most, and builds a CV that puts your matching skills and experience first. Your details are only
          saved on this computer.
        </p>
      </div>

      {/* quick start: bring in what the candidate already has */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-medium">Get started faster</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring in your LinkedIn profile or your current CV, and Foundation fills in what it can.
        </p>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="linkedin-url" className="flex items-center gap-2">
              <Icons.linkedin className="h-5 w-5" />
              Link your LinkedIn
            </Label>
            <div className="flex gap-2">
              <Input
                id="linkedin-url"
                value={linkedinInput}
                placeholder="linkedin.com/in/your-name"
                onChange={(e) => setLinkedinInput(e.target.value)}
                className="min-w-0 bg-background"
              />
              <Button variant="default" className="shrink-0 gap-2" onClick={onOpenLinkedin}>
                <Icons.linkedin className="h-4 w-4" />
                Link LinkedIn
              </Button>
            </div>
          </div>
          <Button variant="outline" className="shrink-0" onClick={onUploadCv}>
            Upload your current CV
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          LinkedIn opens inside Foundation: sign in if asked, then click Import this profile. CVs can be PDF, Word
          (.docx) or text.
        </p>
      </section>

      <BrowserWindow
        ref={linkedinBrowserRef}
        onClose={() => {}}
        label="Your LinkedIn profile"
        customActionButton={{
          text: 'Import this profile',
          onClick: onImportLinkedin,
          tooltip: 'Bring this profile into the CV Builder',
        }}
      />

      {/* 1. target role + what employers want */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">1. What job do you want?</h2>
        <Input
          value={targetRole}
          placeholder="e.g. Data Analyst"
          onChange={(e) => update({ targetRole: e.target.value })}
          className="max-w-xl bg-card text-base"
        />
        {targetRole.trim() && (
          <div className="rounded-lg border border-border bg-card p-4">
            {isLoadingJobs ? (
              <p className="text-sm text-muted-foreground">Looking through your jobs ...</p>
            ) : roleJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No found jobs match "{targetRole.trim()}" yet. Add a search for this role on the Searches page, and once
                Foundation finds some jobs it can show what employers ask for. You can still create your CV now.
              </p>
            ) : (
              <>
                <h3 className="text-base font-medium">What employers want</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  From {roleJobs.length} {roleJobs.length === 1 ? 'job' : 'jobs'} Foundation found for this role. Only
                  add skills you really have.
                </p>
                <ul className="mt-3 divide-y divide-border">
                  {employerSkills.map(({ skill, jobCount }) => {
                    const hasIt = candidateHasSkill(profile, skill);
                    return (
                      <li key={skill} className="flex items-center justify-between gap-4 py-2">
                        <div>
                          <p className="text-sm font-medium">{skill}</p>
                          <p className="text-sm text-muted-foreground">
                            In {jobCount} of {roleJobs.length} adverts
                          </p>
                        </div>
                        {hasIt ? (
                          <span className="text-sm text-muted-foreground">On your CV</span>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => addSkill(skill)}>
                            I have this
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {/* 2. the candidate's details */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">2. About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={profile.fullName} onChange={(v) => updateProfile({ fullName: v })} />
          <Field label="Email" value={profile.email ?? ''} onChange={(v) => updateProfile({ email: v })} />
          <Field label="Phone" value={profile.phone ?? ''} onChange={(v) => updateProfile({ phone: v })} />
          <Field
            label="Town or city"
            value={profile.location ?? ''}
            placeholder="e.g. Leeds"
            onChange={(v) => updateProfile({ location: v })}
          />
          <Field
            label="LinkedIn profile"
            value={profile.linkedinUrl ?? ''}
            placeholder="linkedin.com/in/your-name"
            onChange={(v) => updateProfile({ linkedinUrl: v })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>A few lines about you</Label>
          <Textarea
            value={profile.summary ?? ''}
            placeholder="What you do, what you're good at, and what you're looking for. Leave blank and Foundation will write one."
            onChange={(e) => updateProfile({ summary: e.target.value })}
            className="bg-card"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Skills</Label>
          <Textarea
            value={skillsText}
            placeholder="Separate with commas, e.g. Excel, customer service, SQL"
            onChange={(e) => setSkills(e.target.value)}
            className="bg-card"
          />
        </div>

        <div className="space-y-3">
          <Label>Work experience (most recent first)</Label>
          {profile.experience.map((job, index) => (
            <div key={index} className="relative space-y-3 rounded-lg border border-border bg-card p-4">
              <RemoveButton
                onClick={() => updateProfile({ experience: profile.experience.filter((_, i) => i !== index) })}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Job title" value={job.title} onChange={(v) => setItem('experience', index, { title: v })} />
                <Field label="Employer" value={job.employer} onChange={(v) => setItem('experience', index, { employer: v })} />
                <Field
                  label="Dates"
                  value={job.dates ?? ''}
                  placeholder="e.g. Mar 2022 - present"
                  onChange={(v) => setItem('experience', index, { dates: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>What you did</Label>
                <Textarea
                  value={job.details ?? ''}
                  placeholder={'One thing per line, e.g.\nHandled 50+ customer queries a day\nTrained 3 new team members'}
                  onChange={(e) => setItem('experience', index, { details: e.target.value })}
                  className="min-h-[90px]"
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateProfile({ experience: [...profile.experience, { title: '', employer: '', dates: '', details: '' }] })
            }
          >
            <PlusIcon className="mr-1 h-4 w-4" /> Add a job
          </Button>
        </div>

        <div className="space-y-3">
          <Label>Education and qualifications</Label>
          {profile.education.map((ed, index) => (
            <div key={index} className="relative grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
              <RemoveButton
                onClick={() => updateProfile({ education: profile.education.filter((_, i) => i !== index) })}
              />
              <Field
                label="Qualification"
                value={ed.qualification}
                placeholder="e.g. BSc Economics, 2:1"
                onChange={(v) => setItem('education', index, { qualification: v })}
              />
              <Field
                label="School, college or university"
                value={ed.place}
                onChange={(v) => setItem('education', index, { place: v })}
              />
              <Field label="Dates" value={ed.dates ?? ''} onChange={(v) => setItem('education', index, { dates: v })} />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateProfile({ education: [...profile.education, { qualification: '', place: '', dates: '' }] })}
          >
            <PlusIcon className="mr-1 h-4 w-4" /> Add a qualification
          </Button>
        </div>
      </section>

      {/* 3. how to write it */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">3. How should Foundation write it?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeOption
            selected={mode === 'ai'}
            title="Write it with AI"
            description="AI rewrites your details into a polished CV aimed at this role, using the employers' wording where it truly fits. It never makes anything up."
            onSelect={() => update({ mode: 'ai' })}
          />
          <ModeOption
            selected={mode === 'template'}
            title="Use a template (no AI)"
            description="Your own words in a clean CV layout, with the skills employers ask for most put first. Nothing leaves your computer except the PDF you save."
            onSelect={() => update({ mode: 'template' })}
          />
        </div>
        {mode === 'ai' && (
          <div className="space-y-1.5">
            <Label>Your current CV and LinkedIn (the AI uses this too)</Label>
            <Textarea
              value={existingCv}
              placeholder="Paste the text of your current CV"
              onChange={(e) => update({ existingCv: e.target.value })}
              className="min-h-[120px] bg-card"
            />
          </div>
        )}
        <Button size="lg" className="mt-2 w-fit px-8 text-base" disabled={!canCreate || isWriting} onClick={onCreate}>
          {isWriting ? (
            <>
              <Icons.spinner2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'ai' ? 'Writing your CV ...' : 'Building your CV ...'}
            </>
          ) : cv ? (
            'Update my CV'
          ) : (
            'Create my CV'
          )}
        </Button>
        {!canCreate && <p className="text-sm text-muted-foreground">Enter the job you want and your name to start.</p>}
      </section>

      {/* 4. preview + download */}
      {cv && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">4. Your CV</h2>
            <Button size="lg" className="px-8 text-base" disabled={isSaving} onClick={onDownload}>
              {isSaving ? 'Saving ...' : 'Download PDF'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Check it carefully before you send it. Change anything above and click Update my CV.
          </p>
          <iframe
            title="CV preview"
            srcDoc={cvHtml}
            sandbox=""
            className="h-[1000px] w-full max-w-[820px] rounded-lg border border-border bg-white shadow-sm"
          />
        </section>
      )}
    </DefaultLayout>
  );

  function setItem<K extends 'experience' | 'education'>(
    key: K,
    index: number,
    changes: Partial<CvProfile[K][number]>,
  ) {
    updateProfile({
      [key]: profile[key].map((item, i) => (i === index ? { ...item, ...changes } : item)),
    } as Partial<CvProfile>);
  }
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="bg-card" />
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Remove"
      title="Remove"
      onClick={onClick}
      className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Cross2Icon className="h-4 w-4" />
    </button>
  );
}

function ModeOption({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'rounded-lg border bg-card p-4 text-left transition-colors',
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/60',
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
