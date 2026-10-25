import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BrowserWindow, BrowserWindowHandle } from '@/components/browserWindow';
import { Icons } from '@/components/icons';
import { useError } from '@/hooks/error';
import {
  EmployerSkill,
  buildTemplateCv,
  candidateHasSkill,
  cvDataStrength,
  findEmployerSkills,
  isChosenJob,
  jobsForRole,
  parseCvText,
  renderCvHtml,
} from '@/lib/cvBuilder';
import { SavedCv, cvFolders, loadCvLibrary, newCvId, saveCvLibrary } from '@/lib/cvLibraryStore';
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

// "Write it with AI" shows greyed out as Unavailable while this is false
const AI_WRITING_AVAILABLE = false as boolean;

/**
 * CV builder: the candidate enters the role they want and their details, and Foundation builds a CV that puts first
 * what employers in their found jobs ask for, written with AI or laid out in a template.
 */
export function CvPage() {
  const { handleError } = useError();
  const { toast } = useToast();

  const [state, setState] = useState<SavedState>(loadCvBuilderState);
  const { targetRole, profile, existingCv } = state;
  // AI writing is switched off for now, so a saved "ai" choice falls back to the template
  const mode: CvBuilderState['mode'] = AI_WRITING_AVAILABLE ? state.mode : 'template';
  const update = (changes: Partial<SavedState>) => setState((current) => ({ ...current, ...changes }));
  const updateProfile = (changes: Partial<CvProfile>) => update({ profile: { ...profile, ...changes } });

  const [skillsText, setSkillsText] = useState(profile.skills.join(', '));
  const [foundJobs, setFoundJobs] = useState<CvSourceJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [cv, setCv] = useState<GeneratedCv | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // a CV opened from My CVs shows with the details it was saved with
  const [openedProfile, setOpenedProfile] = useState<CvProfile | null>(null);
  const previewRef = useRef<HTMLElement>(null);

  // My CVs: saved CVs filed in folders, kept on this computer
  const [library, setLibrary] = useState<SavedCv[]>(loadCvLibrary);
  const [saveFolder, setSaveFolder] = useState('');
  const updateLibrary = (cvs: SavedCv[]) => {
    if (!saveCvLibrary(cvs)) {
      toast({ title: "Couldn't save", description: 'Foundation ran out of space for saved CVs. Delete some old ones.' });
      return false;
    }
    setLibrary(cvs);
    return true;
  };

  useEffect(() => saveCvBuilderState(state), [state]);

  /**
   * Fill the empty fields from a CV or LinkedIn profile's text, and keep the full text for the AI.
   */
  const importText = (text: string, source: string, pageTitle?: string, extra: Partial<CvProfile> = {}) => {
    const found = { ...parseCvText(text, pageTitle), ...extra };
    const filled: Partial<CvProfile> = {};
    (['fullName', 'email', 'phone', 'location', 'linkedinUrl'] as const).forEach((key) => {
      if (found[key] && !profile[key]?.trim()) filled[key] = found[key];
    });
    // jobs and qualifications from the CV are added after the ones already typed (empty rows are replaced),
    // skipping any that are already there
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const typedJobs = profile.experience.filter((e) => e.title.trim() || e.employer.trim());
    const newJobs = (found.experience ?? []).filter(
      (e) => !typedJobs.some((t) => same(t.title, e.title) && same(t.employer, e.employer)),
    );
    if (newJobs.length) filled.experience = [...typedJobs, ...newJobs];
    const typedEducation = profile.education.filter((e) => e.qualification.trim() || e.place.trim());
    const newEducation = (found.education ?? []).filter(
      (e) => !typedEducation.some((t) => same(t.qualification, e.qualification) && same(t.place, e.place)),
    );
    if (newEducation.length) filled.education = [...typedEducation, ...newEducation];
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
          ? 'We filled in what we could below. Check it before you create your CV.'
          : "We couldn't pick out any details from it. Fill them in below.",
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
        throw new Error('Open your own LinkedIn profile page first (linkedin.com/in/...), then click Add LinkedIn profile.');
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
  const savedRoleJobs = roleJobs.filter(isChosenJob).length;
  const strength = useMemo(() => cvDataStrength(roleJobs), [roleJobs]);

  const setSkills = (text: string) => {
    setSkillsText(text);
    updateProfile({ skills: text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) });
  };
  const addSkill = (skill: string) => setSkills(skillsText.trim() ? `${skillsText.trim().replace(/,$/, '')}, ${skill}` : skill);

  const canCreate = !!targetRole.trim() && !!profile.fullName.trim();

  const onCreate = async () => {
    setIsWriting(true);
    setOpenedProfile(null);
    try {
      if (mode === 'template') {
        setCv(buildTemplateCv({ profile, targetRole, employerSkills }));
        if (!profile.experience.some((e) => e.title.trim() || e.employer.trim())) {
          toast({
            title: 'Add your work experience',
            description:
              'Employers look at your experience first. Add your jobs (paid, voluntary or placements) in step 2 and create it again.',
          });
        }
      } else {
        const written = await generateCv({
          targetRole,
          profile,
          existingCv,
          employerSkills,
          jobsAnalysed: roleJobs.length,
          // saved jobs come first, so the AI writes for the jobs the candidate actually wants
          sampleJobs: roleJobs.slice(0, 6).map((job) => ({
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

  const cvHtml = cv ? renderCvHtml({ cv, profile: openedProfile ?? profile }) : '';
  const downloadPdf = async (html: string, owner: CvProfile, role: string) => {
    setIsSaving(true);
    try {
      const fileName = `${owner.fullName.trim() || 'My'} CV - ${role.trim()}.pdf`.replace(/[\\/:*?"<>|]/g, '');
      const { saved } = await saveCvPdf({ html, fileName });
      if (saved) toast({ title: 'CV saved', description: 'Your CV has been saved as a PDF.' });
    } catch (error) {
      handleError({ error, title: "Couldn't save the PDF" });
    } finally {
      setIsSaving(false);
    }
  };
  const onDownload = () => downloadPdf(cvHtml, openedProfile ?? profile, targetRole);

  const onSaveToLibrary = () => {
    if (!cv) return;
    const folder = saveFolder.trim() || targetRole.trim() || 'Other';
    const sameFolder = library.filter((c) => c.folder === folder).length;
    const saved: SavedCv = {
      id: newCvId(),
      name: `${targetRole.trim() || 'CV'}${sameFolder ? ` (${sameFolder + 1})` : ''}`,
      folder,
      targetRole: targetRole.trim(),
      createdAt: new Date().toISOString(),
      cv,
      profile: openedProfile ?? profile,
    };
    if (updateLibrary([saved, ...library])) {
      toast({ title: 'Saved to My CVs', description: `"${saved.name}" is in the ${folder} folder at the top of this page.` });
    }
  };
  const onOpenSaved = (saved: SavedCv) => {
    setCv(saved.cv);
    setOpenedProfile(saved.profile);
    setSaveFolder(saved.folder);
    update({ targetRole: saved.targetRole });
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };
  const changeSaved = (id: string, changes: Partial<SavedCv>) =>
    updateLibrary(library.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  const onDeleteSaved = (saved: SavedCv) => {
    if (window.confirm(`Delete "${saved.name}" from My CVs?`)) updateLibrary(library.filter((c) => c.id !== saved.id));
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

      {/* My CVs: one folder per role, so a CV can be picked for each application */}
      {library.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-medium">My CVs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The CVs you've saved, in a folder for each kind of job. They're kept on this computer.
          </p>
          <div className="mt-4 space-y-2">
            {cvFolders(library).map(({ folder, cvs }) => (
              <details key={folder} open className="rounded-md border border-border bg-background">
                <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium">
                  {folder} <span className="font-normal text-muted-foreground">({cvs.length})</span>
                </summary>
                <ul className="divide-y divide-border border-t border-border">
                  {cvs.map((saved) => (
                    <li key={saved.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                      <Input
                        value={saved.name}
                        aria-label="CV name"
                        onChange={(e) => changeSaved(saved.id, { name: e.target.value })}
                        className="h-8 min-w-[140px] flex-1 bg-card"
                      />
                      <Input
                        defaultValue={saved.folder}
                        aria-label="Folder"
                        title="Type a folder name to move this CV"
                        onBlur={(e) => e.target.value.trim() !== saved.folder && changeSaved(saved.id, { folder: e.target.value.trim() || 'Other' })}
                        className="h-8 w-36 bg-card"
                      />
                      <span className="text-xs text-muted-foreground">
                        {new Date(saved.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => onOpenSaved(saved)}>
                        Open
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSaving}
                        onClick={() =>
                          downloadPdf(renderCvHtml({ cv: saved.cv, profile: saved.profile }), saved.profile, saved.targetRole)
                        }
                      >
                        PDF
                      </Button>
                      <RemoveButtonInline onClick={() => onDeleteSaved(saved)} />
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* quick start: bring in what the candidate already has */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-medium">Get started faster</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring in your LinkedIn profile or your current CV, and Foundation fills in what it can.
        </p>
        <div className="mt-4 space-y-1.5">
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
              Add LinkedIn
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <Button variant="default" onClick={onUploadCv}>
          Upload your current CV
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">CVs can be PDF, Word (.docx) or text.</p>
      </section>

      <BrowserWindow
        ref={linkedinBrowserRef}
        onClose={() => {}}
        label="Your LinkedIn profile"
        customActionButton={{
          text: 'Add LinkedIn profile',
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
                No found jobs match "{targetRole.trim()}" yet. Add a search for this role on the Searches page, then use
                Foundation for about 30 minutes, saving the jobs you'd apply for. It uses those adverts to fit your CV
                to the role. You can still create your CV now.
              </p>
            ) : (
              <>
                <h3 className="text-base font-medium">What employers want</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Foundation compares your details with {roleJobs.length}{' '}
                  {roleJobs.length === 1 ? 'advert' : 'adverts'} for this role
                  {savedRoleJobs > 0 && `, including the ${savedRoleJobs} you saved or applied to`}, and gives the most
                  weight to the jobs you saved and to each advert's person specification, so your CV fits the jobs you
                  actually want. Only add skills you really have.
                </p>

                {/* how much it has to go on: about 30 minutes of searching and saving jobs gets it to "strong" */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {strength.level === 'strong'
                        ? 'Strong match data'
                        : strength.level === 'building'
                          ? 'Building up match data'
                          : 'Just getting started'}
                    </span>
                    <span className="text-muted-foreground">{strength.percent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${strength.percent}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{strength.tip}</p>
                </div>

                <ul className="mt-3 divide-y divide-border">
                  {employerSkills.map(({ skill, jobCount, savedCount, essentialCount }) => {
                    const hasIt = candidateHasSkill(profile, skill);
                    return (
                      <li key={skill} className="flex items-center justify-between gap-4 py-2">
                        <div>
                          <p className="text-sm font-medium">{skill}</p>
                          <p className="text-sm text-muted-foreground">
                            In {jobCount} of {roleJobs.length} adverts
                            {savedCount > 0 && ` · ${savedCount} you saved`}
                            {essentialCount > 0 && ` · in ${essentialCount} person ${essentialCount === 1 ? 'spec' : 'specs'}`}
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
            disabled={!AI_WRITING_AVAILABLE}
          />
          <ModeOption
            selected={mode === 'template'}
            title="Use a template (no AI)"
            description="Your own words in a clean CV layout, tailored to the role: a personal profile built around what employers ask for, only the relevant skills, and your most relevant experience first. Nothing leaves your computer except the PDF you save."
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
        <section ref={previewRef} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">4. Your CV</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={saveFolder}
                placeholder={`Folder: ${targetRole.trim() || 'Other'}`}
                aria-label="Folder to save in"
                onChange={(e) => setSaveFolder(e.target.value)}
                className="h-10 w-48 bg-card"
              />
              <Button size="lg" variant="outline" className="text-base" onClick={onSaveToLibrary}>
                Save to My CVs
              </Button>
              <Button size="lg" className="px-8 text-base" disabled={isSaving} onClick={onDownload}>
                {isSaving ? 'Saving ...' : 'Download PDF'}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Check it carefully before you send it. Change anything above and click Update my CV. Save a CV for each kind
            of job you apply for, and it's filed in a folder for that role in My CVs.
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

function RemoveButtonInline({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Delete"
      title="Delete"
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
  disabled = false,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'rounded-lg border bg-card p-4 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-border opacity-50'
          : selected
            ? 'border-primary ring-2 ring-primary/40'
            : 'border-border hover:border-primary/60',
      )}
    >
      <p className="font-medium">
        {title}
        {disabled && <span className="ml-2 text-sm font-normal text-muted-foreground">Unavailable</span>}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
