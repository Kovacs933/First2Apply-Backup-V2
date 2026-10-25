import { Cross2Icon, MinusCircledIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

import { FiltersSkeleton } from '@/components/skeletons/filtersSkeleton';
import { useError } from '@/hooks/error';
import { suggestFromDeletedJobs } from '@/lib/deletedJobSuggestions';
import { getAiFilterConfig, listJobs, updateAiFilterConfig } from '@/lib/electronMainSdk';
import { Job } from '@first2apply/core';
import { Alert, AlertDescription, AlertTitle } from '@first2apply/ui';
import { Badge } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';

// one-click starting points for the AI rules box
const AI_RULE_EXAMPLES = [
  'Hide jobs paying less than £30,000 a year',
  'Hide senior, lead or manager roles',
  'Only show remote or hybrid jobs',
];

export function FiltersPage() {
  const { handleError } = useError();

  const [userAiInput, setUserAiInput] = useState<string>('');
  const [blacklistedCompanies, setBlacklistedCompanies] = useState<string[]>([]);
  const [addBlacklistedCompany, setAddBlacklistedCompany] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAllBlacklistedCompanies, setShowAllBlacklistedCompanies] = useState(false);
  const [deletedJobs, setDeletedJobs] = useState<Job[]>([]);
  // location filter (no AI): UK only, and how far from a town or postcode
  const [ukOnly, setUkOnly] = useState(false);
  const [locationCenter, setLocationCenter] = useState('');
  const [radiusMiles, setRadiusMiles] = useState<number | null>(null);

  /**
   * Load the AI filters from the user's profile, and the jobs they deleted (used to suggest rules).
   */
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        const config = await getAiFilterConfig();
        if (config) {
          setUserAiInput(config.chatgpt_prompt);
          setBlacklistedCompanies(config.blacklisted_companies);
          setUkOnly(!!config.uk_only);
          setLocationCenter(config.location_center ?? '');
          setRadiusMiles(config.location_radius_miles ?? null);
        }
      } catch (error) {
        handleError({ error, title: 'Failed to load your AI filters' });
      } finally {
        setIsLoading(false);
      }

      try {
        const { jobs } = await listJobs({ status: 'deleted', limit: 300 });
        setDeletedJobs(jobs);
      } catch (error) {
        // suggestions are a nice-to-have, the page works without them
        console.error(error);
      }
    };
    asyncLoad();
  }, []);

  // suggestions disappear as soon as they're added to the rules or hidden companies
  const suggestions = useMemo(
    () => suggestFromDeletedJobs({ deletedJobs, currentRules: userAiInput, hiddenCompanies: blacklistedCompanies }),
    [deletedJobs, userAiInput, blacklistedCompanies],
  );
  const addRule = (rule: string) =>
    setUserAiInput((current) => (current.trim() ? `${current.trimEnd()}\n${rule}` : rule));

  /**
   * Save the config to the database automatically, a moment after the user stops typing or clicking.
   */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSaved = useRef<string | null>(null);
  const configToSave = {
    chatgpt_prompt: userAiInput,
    blacklisted_companies: blacklistedCompanies,
    uk_only: ukOnly,
    location_center: locationCenter.trim(),
    location_radius_miles: radiusMiles,
  };
  useEffect(() => {
    if (isLoading) return;
    const snapshot = JSON.stringify(configToSave);
    // the first run after loading is what's already saved
    if (lastSaved.current === null || lastSaved.current === snapshot) {
      lastSaved.current = snapshot;
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        // AI filters are available to everyone in Foundation, no plan check
        await updateAiFilterConfig(configToSave);
        lastSaved.current = snapshot;
        setSaveStatus('saved');
      } catch (error) {
        setSaveStatus('idle');
        handleError({ error, title: 'Failed to save your AI filters' });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [isLoading, userAiInput, blacklistedCompanies, ukOnly, locationCenter, radiusMiles]);

  // save anything still waiting when the user leaves the page
  const latest = useRef(configToSave);
  latest.current = configToSave;
  useEffect(
    () => () => {
      if (lastSaved.current === null || lastSaved.current === JSON.stringify(latest.current)) return;
      updateAiFilterConfig(latest.current).catch((error) => console.error(error));
    },
    [],
  );

  if (isLoading) {
    return (
      <DefaultLayout className="flex flex-col p-6 md:p-10">
        <FiltersSkeleton />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout className="flex flex-col space-y-16 p-6 md:p-10">
      <div className="space-y-3">
        <h1 className="w-fit text-2xl font-medium tracking-wide">AI Job Filters</h1>
        <p className="max-w-3xl text-base text-muted-foreground">
          Hide the jobs you'd never apply for, so your Jobs list only shows ones worth your time. Foundation's AI reads
          every new job advert and checks it against the rules you write below.
        </p>
        <ol className="max-w-3xl list-decimal space-y-1 pl-5 text-base">
          <li>Write what you do and don't want in the first box, in plain English.</li>
          <li>That's it: your filters save automatically and apply to every new job from then on.</li>
        </ol>
      </div>

      <section>
        <h2 className="mb-1 text-lg font-medium">1. What are you looking for?</h2>
        <p className="mb-3 text-base text-muted-foreground">
          Be specific: say what to hide, not just what you like. Click an example to add it, then edit it to suit you.
        </p>

        <SuggestedForYou
          deletedCount={deletedJobs.length}
          emptyText="No rule suggestions right now. Keep deleting jobs you don't want and they'll appear here."
          items={suggestions.rules.map(({ rule, reason }) => ({
            key: rule,
            title: rule,
            reason,
            onAdd: () => addRule(rule),
          }))}
        />

        <div className="mb-3 flex flex-wrap gap-2">
          {AI_RULE_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-border bg-card px-3 py-1 text-sm hover:border-primary hover:text-primary"
              onClick={() => setUserAiInput((current) => (current.trim() ? `${current.trimEnd()}\n${example}` : example))}
            >
              + {example}
            </button>
          ))}
        </div>

        <div className="relative">
          <TextareaAutosize
            value={userAiInput}
            placeholder={'For example:\nHide jobs paying less than £30,000 a year\nHide senior, lead or manager roles\nOnly show remote or hybrid jobs'}
            autoFocus={true}
            onChange={(evt) => setUserAiInput(evt.target.value)}
            minRows={4}
            maxLength={5000}
            className="w-full resize-none rounded-md border border-border bg-card px-6 py-4 text-base ring-ring placeholder:text-muted-foreground focus:outline-none focus:ring-2"
          />
          <span className="absolute bottom-4 right-4 text-sm text-muted-foreground">{userAiInput.length}/5000</span>
        </div>

      </section>

      {/* location filter: checked without AI, so it's instant, free and always applied */}
      <section>
        <h2 className="mb-1 text-lg font-medium">2. Where do you want to work?</h2>
        <p className="mb-3 text-base text-muted-foreground">
          Foundation checks each job's location itself (no AI needed) and moves jobs outside your area to Filtered out,
          with the reason. Remote UK jobs are always kept.
        </p>
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <label className="flex cursor-pointer items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={ukOnly}
              onChange={(e) => setUkOnly(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Only show jobs in the UK
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Within</p>
              <select
                value={radiusMiles ?? ''}
                onChange={(e) => setRadiusMiles(e.target.value ? Number(e.target.value) : null)}
                className="h-10 rounded-md border border-border bg-background px-3 text-base"
              >
                <option value="">Any distance</option>
                {[5, 10, 15, 20, 30, 50, 75].map((miles) => (
                  <option key={miles} value={miles}>
                    {miles} miles
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <p className="text-sm font-medium">of your town or postcode</p>
              <Input
                value={locationCenter}
                onChange={(e) => setLocationCenter(e.target.value)}
                maxLength={60}
                className="bg-background text-base"
              />
            </div>
          </div>
          {radiusMiles && !locationCenter.trim() && (
            <p className="text-sm text-destructive/90">Enter your town or postcode to use the distance limit.</p>
          )}
        </div>
      </section>

      {/* HERE STARTS THE BLACKLISTING */}

      <section>
        <h2 className="mb-1 text-lg font-medium">3. Companies to hide</h2>
        <p className="mb-3 text-base text-muted-foreground">
          Type a company's name exactly as it appears on job adverts, then click Add company. You won't see their jobs
          again.
        </p>

        <SuggestedForYou
          deletedCount={deletedJobs.length}
          emptyText="No company suggestions right now. If you keep deleting jobs from the same company, it'll appear here."
          items={suggestions.companies.map(({ company, reason }) => ({
            key: company,
            title: `Hide ${company}`,
            reason,
            onAdd: () => setBlacklistedCompanies((current) => [...current, company]),
          }))}
        />

        <div className="flex w-full gap-2">
          <div className="relative flex-1">
            <Input
              value={addBlacklistedCompany}
              placeholder="Acme Recruitment Ltd"
              onChange={(evt) => setAddBlacklistedCompany(evt.target.value)}
              maxLength={100}
              className="bg-card px-6 pr-20 text-base ring-ring placeholder:text-base focus-visible:ring-2"
            />
            <span className="absolute bottom-2 right-4 text-sm text-muted-foreground">
              {addBlacklistedCompany.length}/100
            </span>
          </div>

          <Button
            variant="secondary"
            className="w-36 border border-border"
            onClick={() => {
              if (addBlacklistedCompany) {
                setBlacklistedCompanies([...blacklistedCompanies, addBlacklistedCompany]);
                setAddBlacklistedCompany('');
              }
            }}
          >
            Add company
          </Button>
        </div>

        <Alert className="mt-1.5 flex items-center gap-2 border-0 p-0">
          <AlertTitle className="mb-0">
            <MinusCircledIcon className="h-4 w-4 text-destructive/90" />
          </AlertTitle>
          <AlertDescription className="text-sm text-destructive/90">
            The name must match exactly (capital letters don't matter, spelling does). "Acme" won't hide "Acme Ltd".
          </AlertDescription>
        </Alert>

        <div className="mt-4">
          {blacklistedCompanies.length === 0 ? (
            <p className="text-muted-foreground">No companies hidden yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(showAllBlacklistedCompanies ? blacklistedCompanies : blacklistedCompanies.slice(0, 10)).map(
                (company) => (
                  <Badge
                    key={company}
                    className="flex items-center gap-2 border border-border bg-card py-1 pl-4 pr-2 text-base hover:bg-card"
                  >
                    {company}
                    <TooltipProvider delayDuration={500}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Cross2Icon
                            className="h-4 w-4 text-foreground"
                            onClick={() => setBlacklistedCompanies(blacklistedCompanies.filter((c) => c !== company))}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="mt-2 text-sm">
                          Remove
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Badge>
                ),
              )}
              {blacklistedCompanies.length > 10 && !showAllBlacklistedCompanies && (
                <Button variant="secondary" className="py-2" onClick={() => setShowAllBlacklistedCompanies(true)}>
                  See All
                </Button>
              )}
              {showAllBlacklistedCompanies && (
                <Button variant="secondary" className="py-2" onClick={() => setShowAllBlacklistedCompanies(false)}>
                  Show Less
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
        {saveStatus === 'saving' ? 'Saving ...' : saveStatus === 'saved' ? 'All changes saved' : 'Changes save automatically'}
      </p>
    </DefaultLayout>
  );
}

/**
 * The 5 most likely things to hide, based on the jobs the user deleted, each with the reason why.
 */
function SuggestedForYou({
  deletedCount,
  emptyText,
  items,
}: {
  deletedCount: number;
  emptyText: string;
  items: Array<{ key: string; title: string; reason: string; onAdd: () => void }>;
}) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <h3 className="text-base font-medium">Suggested for you</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {deletedCount < 2
            ? "Delete the jobs you're not interested in, and Foundation will suggest what to hide based on them."
            : emptyText}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Based on the {deletedCount} jobs you deleted. Click Add to use one.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {items.map(({ key, title, reason, onAdd }) => (
              <li key={key} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{reason}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={onAdd}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
