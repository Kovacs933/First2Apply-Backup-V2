import { useEffect, useRef, useState } from 'react';

import { BrowserWindow, BrowserWindowHandle } from '@/components/browserWindow';
import { CreateLink } from '@/components/createLink';
import { LinksList } from '@/components/linksList';
import { LinksListSkeleton } from '@/components/skeletons/linksListSkeleton';
import { useAppState } from '@/hooks/appState';
import { useError } from '@/hooks/error';
import { getLinkScanHealth, scanAllLinks, scanLink } from '@/lib/electronMainSdk';
import { LinkScanHealth } from '@/lib/types';
import { throwError } from '@first2apply/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  useLinks,
} from '@first2apply/ui';
import { Button, toast } from '@first2apply/ui';

import { DefaultLayout } from './defaultLayout';

export function LinksPage() {
  const { handleError } = useError();
  const { isLoading, links, removeLink, updateLink, reloadLinks } = useLinks();
  const { isScanning } = useAppState();
  const browserWindowRef = useRef<BrowserWindowHandle>(null);
  const [currentDebugLinkId, setCurrentDebugLinkId] = useState<number | null>(null);
  const [scanHealth, setScanHealth] = useState<Record<number, LinkScanHealth>>({});

  // load the scan health of each search, and refresh it while this page is open
  useEffect(() => {
    let cancelled = false;
    const loadHealth = async () => {
      try {
        const health = await getLinkScanHealth();
        if (!cancelled) setScanHealth(health);
      } catch (error) {
        console.error(error);
      }
    };
    loadHealth();
    const interval = setInterval(loadHealth, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // reload links when a scan finishes, so "last successful check" stays fresh
  const wasScanning = useRef(isScanning);
  useEffect(() => {
    if (wasScanning.current && !isScanning) {
      reloadLinks().catch((error) => handleError({ error }));
      getLinkScanHealth()
        .then(setScanHealth)
        .catch((error) => console.error(error));
    }
    wasScanning.current = isScanning;
  }, [isScanning]);

  const handleScanAll = async () => {
    try {
      await scanAllLinks();
      toast({
        title: 'Scanning all searches ...',
        description: 'This runs in the background. You will be notified if there are new jobs.',
      });
    } catch (error) {
      handleError({ error });
    }
  };

  // refresh links on component mount
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        await reloadLinks();
      } catch (error) {
        handleError({ error });
      }
    };

    asyncLoad();
  }, []);

  // Delete an existing link
  const handleDeleteLink = async (linkId: number) => {
    try {
      await removeLink(linkId);
    } catch (error) {
      handleError({ error });
    }
  };

  // Delete every saved search (the jobs they already found are kept)
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const handleDeleteAllLinks = async () => {
    setIsDeletingAll(true);
    const count = links.length;
    try {
      for (const link of [...links]) {
        await removeLink(link.id);
      }
      toast({ title: `Deleted ${count} job ${count === 1 ? 'search' : 'searches'}` });
    } catch (error) {
      handleError({ error, title: 'Some searches could not be deleted' });
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Search one saved search again right now
  const [scanningLinkIds, setScanningLinkIds] = useState<Set<number>>(new Set());
  const handleSearchAgain = async (linkId: number) => {
    setScanningLinkIds((ids) => new Set(ids).add(linkId));
    try {
      await scanLink(linkId);
      await reloadLinks();
      setScanHealth(await getLinkScanHealth());
      toast({ title: 'Search finished', description: 'Any new jobs are now on your Jobs page.' });
    } catch (error) {
      handleError({ error, title: "Couldn't search again" });
    } finally {
      setScanningLinkIds((ids) => {
        const next = new Set(ids);
        next.delete(linkId);
        return next;
      });
    }
  };

  const handleDebugLink = async (linkId: number) => {
    try {
      await browserWindowRef.current?.open(links.find((l) => l.id === linkId)?.url ?? throwError('Link not found'));
      setCurrentDebugLinkId(linkId);
    } catch (error) {
      handleError({ error });
    }
  };

  const handleScanLink = async () => {
    try {
      const linkId = currentDebugLinkId ?? throwError('No link is being debugged');
      await scanLink(linkId);
      setCurrentDebugLinkId(null);
      await browserWindowRef.current?.finish();

      toast({
        title: 'Scanning URL in background ...',
        description: 'The link will be scanned in the background. You will be notified if there are new jobs.',
        // variant: 'success',
      });
    } catch (error) {
      handleError({ error });
    }
  };

  // update link
  const handleUpdateLink = async (data: { linkId: number; title: string }) => {
    try {
      // for now, we only update the title
      const link = links.find((l) => l.id === data.linkId) ?? throwError('Link not found');

      await updateLink(data.linkId, { title: data.title, url: link.url });
    } catch (error) {
      handleError({ error });
    }
  };

  if (isLoading) {
    return (
      <DefaultLayout className="p-6 md:p-10">
        <LinksListSkeleton />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout className="p-6 md:p-10">
      {/* wraps onto two rows when the window is narrow, so the title and buttons never squash together */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-[12rem] flex-col">
          <h1 className="whitespace-nowrap text-2xl font-medium tracking-wide">Job Searches</h1>
          {isScanning && <span className="text-xs text-muted-foreground">Scanning for new jobs ...</span>}
        </div>

        {links.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="px-6 text-base text-destructive hover:text-destructive"
                  disabled={isDeletingAll}
                >
                  {isDeletingAll ? 'Deleting ...' : 'Delete all'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all {links.length} job searches?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Foundation will stop checking these searches for new jobs. Jobs already found stay on your Jobs
                    page. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeleteAllLinks}
                  >
                    Yes, delete all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" size="lg" className="px-6 text-base" disabled={isScanning} onClick={handleScanAll}>
              {isScanning ? 'Searching ...' : 'Search all again'}
            </Button>
            <CreateLink />
          </div>
        )}
      </div>

      {links.length === 0 && (
        <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center">
          <h2 className="mb-10 w-3/5 whitespace-break-spaces break-normal text-center text-xl tracking-wide md:text-2xl xl:w-1/2">
            Foundation periodically visits your <span className="whitespace-nowrap font-medium">pre-configured</span>{' '}
            job searches and fetches the list of jobs. If there are new jobs since the last visit, you will be notified.
          </h2>

          <div className="flex w-fit gap-3">
            <CreateLink />
          </div>
        </div>
      )}

      {links.length > 0 && (
        <LinksList
          links={links}
          onDeleteLink={handleDeleteLink}
          onDebugLink={handleDebugLink}
          onUpdateLink={handleUpdateLink}
          onScanLink={handleSearchAgain}
          scanningLinkIds={scanningLinkIds}
          scanHealth={scanHealth}
        />
      )}

      <BrowserWindow
        ref={browserWindowRef}
        onClose={() => {}}
        customActionButton={{
          text: 'Retry',
          onClick: () => handleScanLink(),
          tooltip: 'Click to retry fetching jobs for this search',
        }}
      ></BrowserWindow>
    </DefaultLayout>
  );
}
