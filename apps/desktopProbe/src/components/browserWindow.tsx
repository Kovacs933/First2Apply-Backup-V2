import { ArrowLeftIcon, ArrowRightIcon, Cross1Icon } from '@radix-ui/react-icons';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import {
  closeOverlayBrowserView,
  finishOverlayBrowserView,
  openOverlayBrowserView,
  overlayBrowserViewCanGoBack,
  overlayBrowserViewCanGoForward,
  overlayBrowserViewGoBack,
  overlayBrowserViewGoForward,
  overlayBrowserViewNavigate,
} from '@/lib/electronMainSdk';
import { OverlayBrowserViewResult } from '@/lib/types';
import { Button } from '@first2apply/ui';
import { Input } from '@first2apply/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';

export type BrowserWindowProps = {
  onClose: () => void;
  customActionButton: {
    text: string;
    onClick: () => void;
    tooltip?: string;
  };
  // optional: a short label before the address bar (e.g. "Job 2 of 7") and more buttons before the main one
  label?: string;
  extraActions?: Array<{ text: string; onClick: () => void; tooltip?: string }>;
};

export type BrowserWindowHandle = {
  open: (url: string) => void;
  finish: () => Promise<OverlayBrowserViewResult>;
};

/**
 * Component used to create a browser window with
 * back/forward buttons, URL bar, etc.  The component uses
 * Electron's WebContentsView class under the hood, but
 * does not expose it directly. Instead, it provides
 * methods to navigate, go back, go forward, and close
 * the window.
 *
 * This is not a standalone window like Electron's BrowserWindow,
 * but rather a view that can be embedded in an existing window.
 * The parent window is responsible for creating and managing
 * the BrowserWindow instance.
 */
export const BrowserWindow = forwardRef<BrowserWindowHandle, BrowserWindowProps>(
  ({ onClose, customActionButton, label, extraActions = [] }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);

    useEffect(() => {
      // Listen for URL changes from the main process
      const removeListener = window.electron.on('browser-view-url-changed', (_, newUrl) => {
        if (typeof newUrl === 'string') {
          setCurrentUrl(newUrl);
        }
      });

      return () => {
        // close the overlay browser view when the component unmounts
        closeOverlayBrowserView().catch((error) => {
          console.error('Error closing browser view on unmount:', error);
        });

        // @ts-expect-error -- cleanup ---
        if (typeof removeListener === 'function') return removeListener();
      };
    }, []);

    // periodically check if we can go back/forward
    useEffect(() => {
      let intervalId: NodeJS.Timeout;

      const checkNavigationState = async () => {
        try {
          const back = await overlayBrowserViewCanGoBack();
          const forward = await overlayBrowserViewCanGoForward();
          setCanGoBack(back);
          setCanGoForward(forward);
        } catch (error) {
          console.error('Error checking navigation state:', error);
        }
      };

      if (isOpen) {
        // check immediately and then start interval
        checkNavigationState();
        intervalId = setInterval(checkNavigationState, 300);
      }

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }, [isOpen]);

    useImperativeHandle(ref, () => ({
      open: async (url: string) => {
        console.log('Opening URL in browser window:', url);
        setCurrentUrl(url);
        // show the header bar straight away, so it's never missing above the page
        setIsOpen(true);
        try {
          await openOverlayBrowserView(url);
        } catch (error) {
          setIsOpen(false);
          throw error;
        }
      },
      finish: async () => {
        const result = await finishOverlayBrowserView();
        setIsOpen(false);
        return result;
      },
    }));

    if (!isOpen) {
      return null;
    }

    const handleClose = async () => {
      try {
        await closeOverlayBrowserView();
        setIsOpen(false);
        onClose();
      } catch (error) {
        console.error('Error closing browser window:', error);
      }
    };

    return (
      // above the sidebar (z-50), which would otherwise show through the header bar
      <div className="justify-left fixed bottom-0 left-0 right-0 top-0 z-[60]">
        <div className="flex h-[50px] w-full items-center border-b bg-background px-4">
          {/* a clear way back to the app, e.g. once LinkedIn is signed in */}
          <Button
            variant="outline"
            className="mr-2 shrink-0 gap-1.5 px-3"
            title="Close this page and go back to Foundation"
            onClick={() => handleClose()}
          >
            <Cross1Icon className="h-4 w-4" />
            <span className="hidden md:inline">Back to Foundation</span>
          </Button>

          <div className="flex gap-2" id="navigation-buttons">
            <div id="back-button" className="rounded-full">
              <Button variant="ghost" size="icon" disabled={!canGoBack} onClick={() => overlayBrowserViewGoBack()}>
                <ArrowLeftIcon className="h-7 w-7 rounded-full" />
              </Button>
            </div>
            <div id="fwd-button" className="rounded-full">
              <Button
                variant="ghost"
                size="icon"
                disabled={!canGoForward}
                onClick={() => overlayBrowserViewGoForward()}
              >
                <ArrowRightIcon className="h-7 w-7 rounded-full" />
              </Button>
            </div>
          </div>

          {label && (
            <span className="ml-2 max-w-[30%] shrink-0 truncate text-sm font-medium" title={label}>
              {label}
            </span>
          )}

          <div id="url-input" className="ml-2 w-full min-w-0">
            <Input
              type="text"
              onClick={(e) => (e.target as HTMLInputElement).select()}
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  overlayBrowserViewNavigate(currentUrl);
                }
              }}
            />
          </div>

          {extraActions.map((action) => (
            <Button
              key={action.text}
              variant="outline"
              className="ml-2 shrink-0"
              title={action.tooltip}
              onClick={() => action.onClick()}
            >
              {action.text}
            </Button>
          ))}

          {/* custom action button */}
          <div className="ml-2 shrink-0">
            <TooltipProvider delayDuration={500}>
              <Tooltip>
                <TooltipTrigger className="flex gap-3" asChild>
                  <Button variant="default" onClick={() => customActionButton.onClick()}>
                    {customActionButton.text}
                  </Button>
                </TooltipTrigger>

                {customActionButton.tooltip && (
                  <TooltipContent side="left" className="text-base 2xl:hidden">
                    {customActionButton.tooltip}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* whitespace container */}
        <div className="h-full w-full bg-current"></div>
      </div>
    );
  },
);
