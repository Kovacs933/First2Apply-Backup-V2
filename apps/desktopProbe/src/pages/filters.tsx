import { Cross2Icon, MinusCircledIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

import { FiltersSkeleton } from '@/components/skeletons/filtersSkeleton';
import { useError } from '@/hooks/error';
import { suggestFromDeletedJobs } from '@/lib/deletedJobSuggestions';
import { getAdvancedMatchingConfig, listJobs, updateAdvancedMatchingConfig } from '@/lib/electronMainSdk';
import { Job } from '@first2apply/core';
import { Alert, AlertDescription, AlertTitle } from '@first2apply/ui';
import { Badge } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';
import { useToast } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';

// one-click starting points for the AI rules box
const AI_RULE_EXAMPLES = [
  'Hide jobs paying less than £30,000 a year',
  'Hide senior, lead or manager roles',
  'Only show remote or hybrid jobs',
];

export function FiltersPage() {
  const { handleError } = useError();
  const { toast } = useToast();

  const [userAiInput, setUserAiInput] = useState<string>('');
  const [blacklistedCompanies, setBlacklistedCompanies] = useState<string[]>([]);
  const [addBlacklistedCompany, setAddBlacklistedCompany] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAllBlacklistedCompanies, setShowAllBlacklistedCompanies] = useState(false);
  const [deletedJobs, setDeletedJobs] = useState<Job[]>([]);

  /**
   * Load the advanced matching filters from the user's profile, and the jobs they deleted
   * (used to suggest rules).
   */
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        const config = await getAdvancedMatchingConfig();
        if (config) {
          setUserAiInput(config.chatgpt_prompt);
          setBlacklistedCompanies(config.blacklisted_companies);
        }
      } catch (error) {
        handleError({ error, title: 'Failed to load advanced matching filters' });
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
   * Save the config to the database.
   */
  const onSave = async () => {
    try {
      const updatedConfig = await updateAdvancedMatchingConfig({
        chatgpt_prompt: userAiInput,
        blacklisted_companies: blacklistedCompanies,
      });
      setUserAiInput(updatedConfig.chatgpt_prompt);
      setBlacklistedCompanies(updatedConfig.blacklisted_companies);
      // advanced matching is available to everyone in Foundation, no plan check
      toast({ title: 'Advanced matching filters saved' });
    } catch (error) {
      handleError({ error, title: 'Failed to save advanced matching filters' });
    }
  };

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
          <li>
            Click <span className="font-medium">Save filters</span>. They apply to every new job from then on.
          </li>
        </ol>
      </div>

      {/* suggestions based on the jobs the user deleted */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-medium">Suggested for you</h2>
        {suggestions.rules.length === 0 && suggestions.companies.length === 0 ? (
          <p className="text-base text-muted-foreground">
            {deletedJobs.length < 2
              ? "Delete the jobs you're not interested in, and Foundation will suggest what to hide based on them."
              : 'No new suggestions right now. Keep deleting jobs you don’t want and suggestions will appear here.'}
          </p>
        ) : (
          <>
            <p className="mb-3 text-base text-muted-foreground">
              Based on the {deletedJobs.length} jobs you deleted. Click one to add it, then press Save filters.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.rules.map(({ rule, reason }) => (
                <button
                  key={rule}
                  type="button"
                  title={reason}
                  className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-left text-sm hover:border-primary hover:bg-primary/10"
                  onClick={() => addRule(rule)}
                >
                  + {rule} <span className="text-muted-foreground">({reason.toLowerCase()})</span>
                </button>
              ))}
              {suggestions.companies.map(({ company, reason }) => (
                <button
                  key={company}
                  type="button"
                  title={reason}
                  className="rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1 text-left text-sm hover:border-destructive"
                  onClick={() => setBlacklistedCompanies((current) => [...current, company])}
                >
                  + Hide {company} <span className="text-muted-foreground">({reason.toLowerCase()})</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-medium">1. What are you looking for?</h2>
        <p className="mb-3 text-base text-muted-foreground">
          Be specific: say what to hide, not just what you like. Click an example to add it, then edit it to suit you.
        </p>

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

      {/* HERE STARTS THE BLACKLISTING */}

      <section>
        <h2 className="mb-1 text-lg font-medium">2. Companies to hide</h2>
        <p className="mb-3 text-base text-muted-foreground">
          Type a company's name exactly as it appears on job adverts, then click Add company. You won't see their jobs
          again.
        </p>

        <div className="flex w-full gap-2">
          <div className="relative flex-1">
            <Input
              value={addBlacklistedCompany}
              placeholder="e.g. Acme Recruitment Ltd"
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

      <Button className="ml-auto w-36" onClick={onSave}>
        Save filters
      </Button>
    </DefaultLayout>
  );
}
