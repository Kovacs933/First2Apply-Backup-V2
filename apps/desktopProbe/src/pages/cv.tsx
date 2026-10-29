import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icons } from '@/components/icons';
import { useError } from '@/hooks/error';
import {
  EmployerSkill,
  buildTemplateCv,
  candidateHasSkill,
  findCvImprovements,
  profileStarters,
  suggestedStarter,
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
  countCvPages,
  generateCv,
  listJobsWithDescriptions,
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
  const navigate = useNavigate();

  const [state, setState] = useState<SavedState>(loadCvBuilderState);
  const { targetRole, profile, existingCv } = state;
  // AI writing is switched off for now, so a saved "ai" choice falls back to the template
  const mode: CvBuilderState['mode'] = AI_WRITING_AVAILABLE ? state.mode : 'template';
  const update = (changes: Partial<SavedState>) => setState((current) => ({ ...current, ...changes }));
  const updateProfile = (changes: Partial<CvProfile>) => update({ profile: { ...profile, ...changes } });
  // like Education, each starts with one empty box to fill in
  const qualifications = profile.qualifications?.length
    ? profile.qualifications
    : [{ qualification: '', place: '', dates: '' }];
  const volunteering = profile.volunteering?.length
    ? profile.volunteering
    : [{ title: '', employer: '', dates: '', details: '' }];

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
    (['fullName', 'email', 'phone', 'location'] as const).forEach((key) => {
      if (found[key] && !profile[key]?.trim()) filled[key] = found[key];
    });
    // jobs and qualifications from the CV are added after the ones already typed (empty rows are replaced),
    // skipping any that are already there
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const sameRole = (a: { title: string; employer: string }, b: { title: string; employer: string }) =>
      same(a.title, b.title) && same(a.employer, b.employer);
    const foundVolunteering = found.volunteering ?? [];
    // a volunteer role saved under Work experience before Volunteering had its own section moves across
    const typedJobs = profile.experience.filter(
      (e) => (e.title.trim() || e.employer.trim()) && !foundVolunteering.some((v) => sameRole(v, e)),
    );
    const newJobs = (found.experience ?? []).filter((e) => !typedJobs.some((t) => sameRole(t, e)));
    const movedToVolunteering = profile.experience.some((e) => foundVolunteering.some((v) => sameRole(v, e)));
    if (newJobs.length || movedToVolunteering) filled.experience = [...typedJobs, ...newJobs];
    const typedVolunteering = volunteering.filter((v) => v.title.trim() || v.employer.trim());
    const newVolunteering = foundVolunteering.filter((v) => !typedVolunteering.some((t) => sameRole(t, v)));
    if (newVolunteering.length) filled.volunteering = [...typedVolunteering, ...newVolunteering];
    const typedEducation = profile.education.filter((e) => e.qualification.trim() || e.place.trim());
    const newEducation = (found.education ?? []).filter(
      (e) => !typedEducation.some((t) => same(t.qualification, e.qualification) && same(t.place, e.place)),
    );
    if (newEducation.length) filled.education = [...typedEducation, ...newEducation];
    const typedQualifications = (profile.qualifications ?? []).filter((q) => q.qualification.trim() || q.place.trim());
    const newQualifications = (found.qualifications ?? []).filter(
      (q) => !typedQualifications.some((t) => same(t.qualification, q.qualification) && same(t.place, q.place)),
    );
    if (newQualifications.length) filled.qualifications = [...typedQualifications, ...newQualifications];
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

  // the uploaded CV's text as it sits in existingCv, so removing the file takes it out again
  const uploadedBlock = (cv: { fileName: string; text: string }) => `Your CV (${cv.fileName}):\n${cv.text}`;
  const withoutUploadedCv = (current: SavedState) =>
    current.uploadedCv ? current.existingCv.replace(uploadedBlock(current.uploadedCv), '').trim() : current.existingCv;

  const onUploadCv = async () => {
    try {
      const file = await readCvFile();
      if (!file) return;
      // a new upload replaces the previous file
      setState((current) => ({ ...current, existingCv: withoutUploadedCv(current), uploadedCv: undefined }));
      importText(file.text, `Your CV (${file.fileName})`);
      setState((current) => ({ ...current, uploadedCv: { fileName: file.fileName, text: file.text } }));
    } catch (error) {
      handleError({ error, title: "Couldn't read your CV" });
    }
  };

  // removes the file and its text; details already filled in below stay, since the candidate may have edited them
  const onRemoveCv = () =>
    setState((current) => ({ ...current, existingCv: withoutUploadedCv(current), uploadedCv: undefined }));

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
  // with no role typed in yet, suggestions come from all the jobs the candidate saved
  const savedJobs = useMemo(() => foundJobs.filter(isChosenJob), [foundJobs]);
  const improvementJobs = targetRole.trim() ? roleJobs : savedJobs;
  const improvements = useMemo(() => findCvImprovements(improvementJobs, profile), [improvementJobs, profile]);
  const addQualification = (name: string) => {
    const typed = qualifications.filter((q) => q.qualification.trim() || q.place.trim());
    updateProfile({ qualifications: [...typed, { qualification: name, place: '', dates: '' }] });
    toast({ title: `${name} added`, description: 'Add where and when you got it under Qualifications below.' });
  };

  // UK starter profiles filled in with the candidate's details, the one that fits the role first
  const starters = useMemo(() => {
    const ranked = employerSkills.map((e) => e.skill).filter((s) => candidateHasSkill(profile, s));
    const topSkills = [...ranked, ...profile.skills.filter((s) => !ranked.some((r) => r.toLowerCase() === s.toLowerCase()))];
    return profileStarters({ profile, targetRole, topSkills });
  }, [profile, targetRole, employerSkills]);
  const recommendedStarter = suggestedStarter(targetRole, starters);
  const orderedStarters = recommendedStarter
    ? [recommendedStarter, ...starters.filter((s) => s.id !== recommendedStarter.id)]
    : starters;
  const applyStarter = (id: string) => {
    const starter = starters.find((s) => s.id === id);
    if (!starter) return;
    if (profile.summary?.trim() && !window.confirm('Replace your professional summary with this template?')) return;
    updateProfile({ summary: starter.text });
  };

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
  // the preview marks where page 2 and 3 start; the PDF is made from cvHtml without the marks
  const previewHtml = cv ? renderCvHtml({ cv, profile: openedProfile ?? profile, showPageBreaks: true }) : '';

  // UK length standard: 1 page for entry level, up to 2 for experienced candidates (counted from the real PDF)
  const [pageCount, setPageCount] = useState<number | null>(null);
  useEffect(() => {
    if (!cvHtml) return setPageCount(null);
    let current = true;
    countCvPages({ html: cvHtml })
      .then((pages) => current && setPageCount(pages))
      .catch(() => current && setPageCount(null));
    return () => {
      current = false;
    };
  }, [cvHtml]);
  const isEntryLevel = useMemo(() => {
    const years = (openedProfile ?? profile).experience
      .flatMap((e): string[] => (e.dates ?? '').match(/\b(19|20)\d{2}\b/g) ?? [])
      .map(Number);
    return years.length === 0 || new Date().getFullYear() - Math.min(...years) < 2 || /graduate|trainee|apprentice|junior|entry/i.test(targetRole);
  }, [openedProfile, profile, targetRole]);
  const pageLimit = isEntryLevel ? 1 : 2;
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

      <section className="rounded-lg border border-border bg-card p-5">
        <Button variant="default" onClick={onUploadCv}>
          Upload your current CV
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">CVs can be PDF, Word (.docx) or text.</p>
        {state.uploadedCv && (
          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background py-1.5 pl-3 pr-1.5 text-sm">
            <span className="truncate">{state.uploadedCv.fileName}</span>
            <button
              type="button"
              aria-label={`Remove ${state.uploadedCv.fileName}`}
              title="Remove this CV"
              onClick={onRemoveCv}
              className="shrink-0 rounded p-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Cross2Icon className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {/* 1. target role + what employers want */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">1. What job do you want?</h2>
        <Input
          value={targetRole}
          placeholder="Data Analyst"
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

        {/* what the candidate doesn't have yet: only added to the CV when they click "I have this" */}
        {!isLoadingJobs && improvementJobs.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-base font-medium">What would strengthen your CV</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {targetRole.trim()
                ? 'Qualifications, checks and skills these adverts ask for that aren\'t in your details yet.'
                : `Qualifications, checks and skills the ${savedJobs.length} jobs you saved ask for that aren't in your details yet. Type the job you want above to focus these on one role.`}{' '}
              If you already have one, click I have this to add it. The rest are worth working towards: Future training
              (CPD) shows courses for them.
            </p>
            {improvements.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Your details already cover what these adverts ask for most.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {improvements.map(({ name, kind, jobCount, savedCount, essentialCount }) => (
                  <li key={name} className="flex items-center justify-between gap-4 py-2">
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        {kind} · in {jobCount} of {improvementJobs.length} {targetRole.trim() ? 'adverts' : 'saved jobs'}
                        {targetRole.trim() && savedCount > 0 && ` · ${savedCount} you saved`}
                        {essentialCount > 0 && ` · in ${essentialCount} person ${essentialCount === 1 ? 'spec' : 'specs'}`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => (kind === 'Qualification' ? addQualification(name) : addSkill(name))}
                    >
                      I have this
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="link" className="mt-1 h-auto px-0 text-sm" onClick={() => navigate('/training')}>
              See training and courses for the jobs you saved
            </Button>
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
            placeholder="Leeds"
            onChange={(v) => updateProfile({ location: v })}
          />
          {/* many UK employers filter on this, so it goes next to the contact details on the CV */}
          <div className="space-y-1.5">
            <Label htmlFor="right-to-work">Right to work in the UK</Label>
            <select
              id="right-to-work"
              value={profile.rightToWork ?? ''}
              onChange={(e) => updateProfile({ rightToWork: e.target.value as CvProfile['rightToWork'] })}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="">Don't show on my CV</option>
              <option value="British citizen">British citizen</option>
              <option value="Settled / pre-settled status">Settled / pre-settled status</option>
              <option value="Requires visa sponsorship">Requires visa sponsorship</option>
            </select>
          </div>
        </div>

        {/* professional summary: who you are, what you bring, what you want next (3 to 4 sentences) */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <Label htmlFor="profile-summary">Professional summary</Label>
              <p className="text-sm text-muted-foreground">
                3 to 4 sentences: who you are, what you bring, and the job you want next.
              </p>
            </div>
            <select
              aria-label="Start from a template"
              value=""
              onChange={(e) => applyStarter(e.target.value)}
              className="h-9 max-w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="">Start from a template ...</option>
              {orderedStarters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.id === recommendedStarter?.id ? ' (suggested)' : ''}
                </option>
              ))}
            </select>
          </div>
          <Textarea
            id="profile-summary"
            value={profile.summary ?? ''}
            placeholder="Leave blank and Foundation will write one from your details."
            onChange={(e) => updateProfile({ summary: e.target.value })}
            className="min-h-[96px] bg-card"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Skills</Label>
          <Textarea
            value={skillsText}
            placeholder="Separate with commas: Excel, customer service, SQL"
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Job title" value={job.title} onChange={(v) => setItem('experience', index, { title: v })} />
                <Field label="Company" value={job.employer} onChange={(v) => setItem('experience', index, { employer: v })} />
                <Field
                  label="Location"
                  value={job.location ?? ''}
                  placeholder="Leeds"
                  onChange={(v) => setItem('experience', index, { location: v })}
                />
                <Field
                  label="Dates"
                  value={job.dates ?? ''}
                  placeholder="Mar 2022 - Present"
                  onChange={(v) => setItem('experience', index, { dates: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>What you did</Label>
                <Textarea
                  value={job.details ?? ''}
                  placeholder={
                    'One achievement per line, starting with an action word and ending with the result:\nOrganised weekly activity sessions for 15 students, raising attendance\nAnalysed stock records each week, cutting ordering errors'
                  }
                  onChange={(e) => setItem('experience', index, { details: e.target.value })}
                  className="min-h-[90px]"
                />
                <BulletTip />
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
          <Label>Education</Label>
          {profile.education.map((ed, index) => (
            <div key={index} className="relative grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
              <RemoveButton
                onClick={() => updateProfile({ education: profile.education.filter((_, i) => i !== index) })}
              />
              <Field
                label="Qualification"
                value={ed.qualification}
                placeholder="BSc Economics, 2:1"
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
            <PlusIcon className="mr-1 h-4 w-4" /> Add education
          </Button>
        </div>

        {/* training courses and certificates, kept apart from school and university */}
        <div className="space-y-3">
          <Label>Qualifications</Label>
          {qualifications.map((q, index) => (
            <div key={index} className="relative grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
              <RemoveButton
                onClick={() => updateProfile({ qualifications: qualifications.filter((_, i) => i !== index) })}
              />
              <Field
                label="Qualification"
                value={q.qualification}
                placeholder="The Care Certificate"
                onChange={(v) => setQualification(index, { qualification: v })}
              />
              <Field
                label="Provider"
                value={q.place}
                placeholder="Voyage Care"
                onChange={(v) => setQualification(index, { place: v })}
              />
              <Field label="Dates" value={q.dates ?? ''} onChange={(v) => setQualification(index, { dates: v })} />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateProfile({ qualifications: [...qualifications, { qualification: '', place: '', dates: '' }] })}
          >
            <PlusIcon className="mr-1 h-4 w-4" /> Add a qualification
          </Button>
        </div>

        {/* unpaid roles, kept apart from paid work */}
        <div className="space-y-3">
          <Label>Volunteering</Label>
          {volunteering.map((role, index) => (
            <div key={index} className="relative space-y-3 rounded-lg border border-border bg-card p-4">
              <RemoveButton onClick={() => updateProfile({ volunteering: volunteering.filter((_, i) => i !== index) })} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Role" value={role.title} onChange={(v) => setVolunteering(index, { title: v })} />
                <Field label="Organisation" value={role.employer} onChange={(v) => setVolunteering(index, { employer: v })} />
                <Field label="Location" value={role.location ?? ''} onChange={(v) => setVolunteering(index, { location: v })} />
                <Field label="Dates" value={role.dates ?? ''} onChange={(v) => setVolunteering(index, { dates: v })} />
              </div>
              <div className="space-y-1.5">
                <Label>What you did</Label>
                <Textarea
                  value={role.details ?? ''}
                  placeholder="One achievement per line, starting with an action word and ending with the result"
                  onChange={(e) => setVolunteering(index, { details: e.target.value })}
                  className="min-h-[90px]"
                />
                <BulletTip />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateProfile({ volunteering: [...volunteering, { title: '', employer: '', dates: '', details: '' }] })
            }
          >
            <PlusIcon className="mr-1 h-4 w-4" /> Add volunteering
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
          {/* UK length standard: 1 page for entry level, up to 2 for experienced candidates */}
          {pageCount !== null && (
            <p
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                pageCount <= pageLimit
                  ? 'border-border bg-card text-muted-foreground'
                  : 'border-primary/50 bg-primary/10 text-foreground',
              )}
            >
              {pageCount <= pageLimit
                ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}: the right length for ${isEntryLevel ? 'an entry-level' : 'an experienced'} UK CV.`
                : pageCount > 2
                  ? `Your CV runs onto page ${pageCount}. UK CVs should be 2 pages at most: shorten older jobs or remove bullet points until it fits.`
                  : 'Your CV is 2 pages. For entry-level and graduate roles UK employers expect 1 page: keep your most relevant points and trim the rest.'}
            </p>
          )}
          <iframe
            title="CV preview"
            srcDoc={previewHtml}
            sandbox=""
            className="h-[1150px] w-full max-w-[840px] rounded-lg border border-border bg-white shadow-sm"
          />
        </section>
      )}
    </DefaultLayout>
  );

  function setQualification(index: number, changes: Partial<NonNullable<CvProfile['qualifications']>[number]>) {
    updateProfile({ qualifications: qualifications.map((q, i) => (i === index ? { ...q, ...changes } : q)) });
  }

  function setVolunteering(index: number, changes: Partial<NonNullable<CvProfile['volunteering']>[number]>) {
    updateProfile({ volunteering: volunteering.map((v, i) => (i === index ? { ...v, ...changes } : v)) });
  }

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

/** How to write CV bullet points the UK way: achievements and results, in UK spelling. */
function BulletTip() {
  return (
    <p className="text-xs text-muted-foreground">
      Focus on what you achieved and the result, with numbers where you can (how many people, how often, how much).
      Your CV uses UK spelling automatically (organised, analysed, maximised).
    </p>
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
