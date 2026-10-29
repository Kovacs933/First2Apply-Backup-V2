import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useError } from '@/hooks/error';
import { LEVEL_MEANING, TrainingRecommendation, findTrainingRecommendations } from '@/lib/cpdTraining';
import { isChosenJob } from '@/lib/cvBuilder';
import { loadCvBuilderState, saveCvBuilderState } from '@/lib/cvProfileStore';
import { CvSourceJob, listJobsWithDescriptions, openExternalUrl } from '@/lib/electronMainSdk';
import { cn } from '@/lib/utils';
import { Button, useToast } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';

const STRENGTH_LABEL = { essential: 'Essential', desirable: 'Desirable', mentioned: 'Mentioned' } as const;

/**
 * Future training (CPD): the qualifications and training the candidate's saved jobs ask for, so they know what to
 * learn next to be more hireable for the jobs they want, with a link to find a course for each.
 */
export function TrainingPage() {
  const { handleError } = useError();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<CvSourceJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // the CV Builder's details, to tell what the candidate already has
  const [cvState, setCvState] = useState(loadCvBuilderState);

  useEffect(() => {
    listJobsWithDescriptions()
      .then(setJobs)
      .catch((error) => handleError({ error, title: "Couldn't load your saved jobs" }))
      .finally(() => setIsLoading(false));
  }, []);

  const savedCount = useMemo(() => jobs.filter((job) => isChosenJob(job) && job.description?.trim()).length, [jobs]);
  const recommendations = useMemo(
    () => findTrainingRecommendations(jobs, cvState.profile),
    [jobs, cvState.profile],
  );
  const toDo = recommendations.filter((r) => !r.onCv);
  const alreadyHave = recommendations.filter((r) => r.onCv);

  // "I have this": adds it to the CV Builder's Qualifications, so it shows on the CV and moves to "Already on your CV"
  const onHaveIt = (name: string) => {
    const state = loadCvBuilderState();
    const typed = (state.profile.qualifications ?? []).filter((q) => q.qualification.trim() || q.place.trim());
    const next = { ...state, profile: { ...state.profile, qualifications: [...typed, { qualification: name, place: '', dates: '' }] } };
    saveCvBuilderState(next);
    setCvState(next);
    toast({ title: `${name} added to your CV details`, description: 'Add where and when you got it in the CV Builder.' });
  };

  return (
    <DefaultLayout className="flex flex-col space-y-10 p-6 md:p-10">
      <div className="space-y-3">
        <h1 className="w-fit text-2xl font-medium tracking-wide">Future training (CPD)</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          The qualifications and training that would make you more hireable for the jobs you've saved. Foundation reads
          each saved job's advert, finds what it asks for and lists it here, most asked for first. CPD (continuing
          professional development) is the learning you do to keep building your skills.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Reading your saved jobs ...</p>
      ) : savedCount === 0 ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-medium">Save some jobs first</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            On the Jobs page, save the jobs you'd apply for. Foundation then works out the training those employers ask
            for and shows it here.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/')}>
            Go to Jobs
          </Button>
        </section>
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-medium">Worth working towards</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                From the {savedCount} {savedCount === 1 ? 'job' : 'jobs'} you saved. "Essential" means an advert needs
                it to apply; "Desirable" means it gives you an edge.
              </p>
            </div>
            {toDo.length === 0 ? (
              <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                Your CV details already cover the qualifications your saved jobs ask for. Save more jobs to get more
                ideas.
              </p>
            ) : (
              <ul className="space-y-4">
                {toDo.map((recommendation) => (
                  <TrainingCard
                    key={recommendation.name}
                    recommendation={recommendation}
                    savedCount={savedCount}
                    onHaveIt={() => onHaveIt(recommendation.name)}
                  />
                ))}
              </ul>
            )}
          </section>

          {alreadyHave.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-medium">Already on your CV</h2>
              <p className="text-sm text-muted-foreground">Your saved jobs ask for these too, and your CV details show them.</p>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {alreadyHave.map(({ name, mentions }) => (
                  <li key={name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground">
                      In {mentions.length} of {savedCount} saved jobs
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="max-w-3xl text-sm text-muted-foreground">
            Find a course opens the National Careers Service (GOV.UK) course search, where you can filter by place,
            online learning and free courses.
          </p>
        </>
      )}
    </DefaultLayout>
  );
}

function TrainingCard({
  recommendation,
  savedCount,
  onHaveIt,
}: {
  recommendation: TrainingRecommendation;
  savedCount: number;
  onHaveIt: () => void;
}) {
  const { name, level, about, mentions, essentialCount, desirableCount, courseSearchUrl } = recommendation;
  return (
    <li className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-medium">{name}</h3>
          {level && LEVEL_MEANING[level] && (
            <p className="text-sm text-muted-foreground">
              Level {level}: {LEVEL_MEANING[level]}
            </p>
          )}
          {about && <p className="text-sm">{about}</p>}
          <p className="text-sm text-muted-foreground">
            In {mentions.length} of {savedCount} saved jobs
            {essentialCount > 0 && ` · essential in ${essentialCount}`}
            {desirableCount > 0 && ` · desirable in ${desirableCount}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => openExternalUrl(courseSearchUrl)}>
            Find a course
          </Button>
          <Button variant="outline" size="sm" onClick={onHaveIt}>
            I have this
          </Button>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-primary">
          Where your saved jobs ask for it
        </summary>
        <ul className="mt-2 space-y-3">
          {mentions.map((mention) => (
            <li key={mention.jobId} className="text-sm">
              <p>
                <span className="font-medium">{mention.title}</span>
                <span className="text-muted-foreground"> · {mention.companyName}</span>
                <span
                  className={cn(
                    'ml-2 rounded-full px-2 py-0.5 text-xs',
                    mention.strength === 'essential'
                      ? 'bg-primary/15 text-primary'
                      : mention.strength === 'desirable'
                        ? 'bg-muted text-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {STRENGTH_LABEL[mention.strength]}
                </span>
              </p>
              <p className="mt-0.5 italic text-muted-foreground">"{mention.quote}"</p>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
