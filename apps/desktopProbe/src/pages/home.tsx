import { Link } from 'react-router-dom';

import { JobTabs } from '@/components/home/jobTabs';
import { Icons } from '@/components/icons';
import { JobsListSkeleton } from '@/components/home/jobsSkeleton';
import { SearchAllBoardsForm } from '@/components/searchAllBoards';
import { useLinks } from '@first2apply/ui';
import { Skeleton } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';

/**
 * Home page component.
 */
export function Home() {
  const { links, isLoading: isLoadingLinks } = useLinks();

  // Links are still loading
  if (isLoadingLinks) {
    return <Loading />;
  }

  // User has no links
  if (links.length === 0) {
    return <NoLinks />;
  }

  return (
    <DefaultLayout className="px-6 pt-6 md:px-10">
      <JobTabs />
    </DefaultLayout>
  );
}

/**
 * Links are still loading component.
 */
function Loading() {
  return (
    <DefaultLayout className="p-6 pb-0 md:px-10">
      <div className="mb-2 flex h-[68px] w-full animate-pulse flex-row gap-1 rounded-lg bg-[#E8A55A]/5 p-2">
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
      </div>

      <JobsListSkeleton />
    </DefaultLayout>
  );
}

/**
 * First-run setup, shown until the user has a search: one job title, town and distance becomes a search on every
 * UK board. Once the searches are saved the Jobs list replaces this screen.
 */
function NoLinks() {
  return (
    <DefaultLayout className="flex w-full max-w-[860px] flex-col gap-8 px-6 py-10 md:px-10">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* the Foundation logo and name in its gold and navy */}
        <h1 className="flex items-center gap-4 text-3xl font-semibold text-[#1F3A5F] dark:text-foreground sm:text-4xl md:text-5xl">
          <Icons.logo className="h-12 w-12 md:h-14 md:w-14" aria-hidden="true" />
          Foundation
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Tell Foundation the job you want and where. It saves the search on every UK job board and checks them all
          for new jobs, so you don't have to.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-1 text-xl font-medium">Set up your job search</h2>
        <p className="mb-4 text-sm text-muted-foreground">You can add more searches or change these any time.</p>
        <SearchAllBoardsForm />
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Want one particular board or a company's own careers page?{' '}
        <Link to="/links" className="text-primary underline hover:no-underline">
          Add a single search
        </Link>
      </p>
    </DefaultLayout>
  );
}
