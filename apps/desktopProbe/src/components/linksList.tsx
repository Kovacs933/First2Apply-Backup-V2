import { CopyIcon, Pencil1Icon, QuestionMarkCircledIcon, ReloadIcon, TrashIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';
import ReactTimeAgo from 'react-time-ago';

import { Link } from '@first2apply/core';
import { useSites } from '@first2apply/ui';
import { Avatar, AvatarFallback, AvatarImage } from '@first2apply/ui';
import { Button } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

import { LinkScanHealth } from '../lib/types';
import { EditLink } from './editLink';

const scrapeFailureThreshold = 3;

export function LinksList({
  links,
  onDeleteLink,
  onDebugLink,
  onUpdateLink,
  onScanLink,
  scanningLinkIds = new Set(),
  scanHealth = {},
}: {
  links: Link[];
  scanHealth?: Record<number, LinkScanHealth>;
  scanningLinkIds?: Set<number>;
  onScanLink: (linkId: number) => void;
  onDeleteLink: (linkId: number) => void;
  onDebugLink: (linkId: number) => void;
  onUpdateLink: (data: { linkId: number; title: string }) => Promise<void>;
}) {
  const { siteLogos, sites } = useSites();
  const sitesMap = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const [editedLink, setEditedLink] = useState<Link | null>(null);

  const isInFailureState = (link: Link) =>
    link.scrape_failure_count >= scrapeFailureThreshold || (scanHealth[link.id]?.consecutiveFailures ?? 0) >= 2;

  return (
    <>
      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:gap-6">
        {links.map((link) => {
          return (
            <li
              key={link.id}
              className={`flex cursor-pointer flex-col gap-4 rounded-lg border bg-card px-6 pb-6 pt-8 shadow-sm ${isInFailureState(link) ? 'border-destructive' : 'border-border'}`}
              onClick={() => {
                onDebugLink(link.id);
              }}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  className="h-12 w-12 cursor-pointer"
                  onClick={() => {
                    onDebugLink(link.id);
                  }}
                >
                  <AvatarImage src={siteLogos[link.site_id]} />
                  <AvatarFallback className="text-xl tracking-wider">LI</AvatarFallback>
                </Avatar>

                <div>
                  <p className="p-0 text-sm text-muted-foreground">{sitesMap.get(link.site_id)?.name}</p>
                  <p className="text-balance text-lg leading-6">{link.title}</p>
                </div>
              </div>

              {/* scan health: result of the most recent scan on this computer */}
              <ScanHealthLine health={scanHealth[link.id]} />

              {/* <p className="mb-4 mt-6 grow whitespace-pre-wrap text-pretty break-all text-xs text-muted-foreground">
              {link.url}
            </p> */}

              {/* dates above the buttons, so neither gets squashed in a narrow window */}
              <div className="mt-auto flex flex-col gap-3">
                <p className="text-xs font-light text-foreground/50">
                  {'Last successful check '}
                  <ReactTimeAgo date={new Date(link.last_scraped_at)} locale="en-US" />
                  {' · Added '}
                  <ReactTimeAgo date={new Date(link.created_at)} locale="en-US" />
                </p>

                {/* actions */}
                <div className="flex flex-wrap items-center justify-end gap-y-2">
                  {/* search this one again now */}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mr-auto rounded-full bg-secondary/50 px-3 text-sm transition-colors duration-200 ease-in-out hover:bg-secondary focus:bg-secondary"
                    disabled={scanningLinkIds.has(link.id)}
                    onClick={(evt) => {
                      evt.stopPropagation();
                      onScanLink(link.id);
                    }}
                  >
                    <ReloadIcon className={`mr-1.5 h-4 w-4 ${scanningLinkIds.has(link.id) ? 'animate-spin' : ''}`} />
                    {scanningLinkIds.has(link.id) ? 'Searching' : 'Search again'}
                  </Button>

                  {isInFailureState(link) && (
                    <Button
                      variant="secondary"
                      size="default"
                      className="rounded-full px-2 py-1 text-sm"
                      onClick={(evt) => {
                        evt.stopPropagation();
                        onDebugLink(link.id);
                      }}
                    >
                      <QuestionMarkCircledIcon className="h-5 w-5 text-primary" />
                    </Button>
                  )}

                  {/* Copy URL */}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="default"
                          className="ml-2 rounded-full bg-secondary/50 px-[9px] py-2 text-sm transition-colors duration-200 ease-in-out hover:bg-secondary focus:bg-secondary"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            navigator.clipboard.writeText(link.url);
                          }}
                        >
                          <CopyIcon className="h-[18px] w-[18px]" />
                        </Button>
                      </TooltipTrigger>

                      <TooltipContent side="left">Copy URL</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* edit search */}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="default"
                          className="ml-2 rounded-full bg-secondary/50 px-[9px] py-2 text-sm transition-colors duration-200 ease-in-out hover:bg-secondary focus:bg-secondary"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setEditedLink(link);
                          }}
                        >
                          <Pencil1Icon className="h-[18px] w-[18px]" />
                        </Button>
                      </TooltipTrigger>

                      <TooltipContent side="left">Edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    variant="destructive"
                    size="default"
                    className="ml-2 rounded-full bg-destructive/10 px-2 py-1 text-sm transition-colors duration-200 ease-in-out hover:bg-destructive/20 focus:bg-destructive/20"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      onDeleteLink(link.id);
                    }}
                  >
                    <TrashIcon className="h-5 w-5 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <EditLink
        isOpen={!!editedLink}
        link={editedLink}
        onUpdateLink={async (data) => {
          if (!editedLink) {
            return;
          }

          await onUpdateLink({ linkId: editedLink.id, title: data.title });
          setEditedLink(null);
        }}
        onCancel={() => {
          setEditedLink(null);
        }}
      />
    </>
  );
}

/**
 * One-line summary of the last scan of a search: OK + jobs found, or the reason it failed.
 */
function ScanHealthLine({ health }: { health?: LinkScanHealth }) {
  if (!health) {
    return <p className="text-xs text-muted-foreground">Not scanned on this computer yet.</p>;
  }

  if (health.lastError) {
    return (
      <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <p className="font-medium">
          {'Last scan failed '}
          <ReactTimeAgo date={new Date(health.lastScanAt)} locale="en-US" />
          {health.consecutiveFailures > 1 ? ` (${health.consecutiveFailures} times in a row)` : ''}
        </p>
        <p>{health.lastError}</p>
      </div>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      {'Last scan OK '}
      <ReactTimeAgo date={new Date(health.lastScanAt)} locale="en-US" />
      {` · ${health.lastNewJobsCount} new job${health.lastNewJobsCount === 1 ? '' : 's'}`}
      {` · ${health.totalNewJobsCount} found in total`}
    </p>
  );
}
