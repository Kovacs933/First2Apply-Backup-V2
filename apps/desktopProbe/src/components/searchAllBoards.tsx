import { useMemo, useState } from 'react';

import { useError } from '@/hooks/error';
import { BOARD_SEARCH_URL_BUILDERS } from '@/lib/boardSearchUrls';
import { scanLink } from '@/lib/electronMainSdk';
import { getExceptionMessage } from '@first2apply/core';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useLinks,
  useSites,
  useToast,
} from '@first2apply/ui';

import { DistanceSlider } from './distanceSlider';
import { Icons } from './icons';

/**
 * Lets a candidate type one job title + location and saves that search on every selected UK board,
 * instead of opening each board, searching and saving it one by one.
 */
export function SearchAllBoards({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { handleError } = useError();
  const { toast } = useToast();
  const { sites } = useSites();
  const { createLink } = useLinks();

  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [distanceMiles, setDistanceMiles] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasLocation = !!location.trim();

  // only boards that are still offered and whose search page can be built from a link
  const boards = useMemo(
    () => sites.filter((site) => !site.deprecated && BOARD_SEARCH_URL_BUILDERS[site.provider]),
    [sites],
  );
  const [selected, setSelected] = useState<Set<number> | null>(null);
  // every board starts ticked; untick the ones you don't want
  const selectedIds = selected ?? new Set(boards.map((b) => b.id));

  const toggle = (siteId: number, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(siteId);
    else next.delete(siteId);
    setSelected(next);
  };

  const onSubmit = async () => {
    setIsSubmitting(true);
    const search = { keywords, location, distanceMiles };
    const searchName = hasLocation
      ? `${keywords.trim()} within ${distanceMiles} miles of ${location.trim()}`
      : keywords.trim();
    const saved: string[] = [];
    const failed: string[] = [];

    try {
      for (const site of boards.filter((b) => selectedIds.has(b.id))) {
        try {
          const url = BOARD_SEARCH_URL_BUILDERS[site.provider]!(search);
          // no html: the search is saved straight away and its jobs are fetched by the scan below
          const link = await createLink({
            title: `${searchName} (${site.name})`,
            url,
            html: '',
            webPageRuntimeData: {},
            force: false,
          });
          saved.push(site.name);
          scanLink(link.id).catch(() => {
            // the regular background scan will retry it
          });
        } catch (error) {
          failed.push(`${site.name}: ${getExceptionMessage(error, true)}`);
        }
      }

      if (saved.length) {
        toast({
          title: `Searching ${saved.length} job boards for "${searchName}"`,
          description: 'New jobs will appear on the Jobs page in a minute or two.',
        });
      }
      if (failed.length) {
        handleError({ error: new Error(failed.join('\n')), title: `Couldn't save ${failed.length} of the searches` });
      }
      if (saved.length) {
        setKeywords('');
        setLocation('');
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium tracking-wide">Search every UK job board at once</DialogTitle>
          <DialogDescription>
            Tell us the job you want and where. Foundation saves the search on each board you tick and checks them
            all for new jobs, so you don't have to visit them one by one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="search-all-keywords">Job title or keywords</Label>
            <Input
              id="search-all-keywords"
              placeholder="data analyst"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="search-all-location">Town, city or postcode (optional)</Label>
            <Input
              id="search-all-location"
              placeholder="Manchester"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <DistanceSlider
          id="search-all-distance"
          label={`Distance from ${location.trim() || 'your location'}`}
          value={distanceMiles}
          onChange={setDistanceMiles}
          disabled={!hasLocation}
          hint={
            hasLocation
              ? "Boards that don't offer this exact distance use their nearest wider option or their maximum (Reed up to 50 miles, LinkedIn, Indeed and NHS Jobs up to 100). GOV.UK Find a Job and jobs.ac.uk don't support distance, so they use their own default area."
              : 'Add a town, city or postcode to choose a distance.'
          }
        />

        <div>
          <p className="mb-2 text-sm font-medium">Job boards</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {boards.map((site) => (
              <li key={site.id} className="flex items-center gap-2">
                <Checkbox
                  id={`search-all-site-${site.id}`}
                  checked={selectedIds.has(site.id)}
                  onCheckedChange={(checked) => toggle(site.id, checked === true)}
                />
                <Label htmlFor={`search-all-site-${site.id}`} className="font-normal">
                  {site.name}
                </Label>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!keywords.trim() || selectedIds.size === 0 || isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Icons.spinner2 className="h-4 w-4 animate-spin" />
                Saving searches...
              </>
            ) : (
              `Search ${selectedIds.size} boards`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
