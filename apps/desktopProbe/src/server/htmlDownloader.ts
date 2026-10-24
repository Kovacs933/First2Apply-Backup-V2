import { RateLimitError, WebPageRuntimeData, getExceptionMessage } from '@first2apply/core';
import { BrowserWindow, Session } from 'electron';
import { backOff } from 'exponential-backoff';

import { getLinkedinReactContextBuilder } from './browserHelpers';
import { sleep, waitRandomBetween } from './helpers';
import { ILogger } from './logger';
import { WorkerQueue } from './workerQueue';

const KNOWN_AUTHWALLS = ['authwall', 'login'];
// give up on a single page load after this long (some sites never fire the "loaded" event)
const PAGE_LOAD_TIMEOUT_MS = 45_000;
// how many times we try to load a page before reporting a failure
const PAGE_LOAD_ATTEMPTS = 4;

class PageLoadTimeoutError extends Error {}
class AuthwallError extends Error {}

/**
 * Electron rejects loadURL with ERR_ABORTED (-3) when a page redirects or changes its url while loading
 * (very common on job boards). The page is usually fine, so we don't treat it as a failure.
 */
function isAbortedNavigation(error: unknown) {
  const message = getExceptionMessage(error);
  return message.includes('ERR_ABORTED') || message.includes('(-3)');
}

/**
 * Wrapper over a headless window that can be used to download HTML.
 */
export class HtmlDownloader {
  private _isRunning = false;
  private _pool: BrowserWindowPool | undefined;
  private _logger: ILogger;
  private _numInstances: number;
  private _incognitoMode: boolean;

  /**
   * Class constructor.
   */
  constructor({
    logger,
    numInstances,
    incognitoMode,
  }: {
    logger: ILogger;
    numInstances: number;
    incognitoMode: boolean;
  }) {
    this._logger = logger;
    this._numInstances = numInstances;
    this._incognitoMode = incognitoMode;
  }

  /**
   * Initialize the headless window.
   */
  init() {
    this._pool = new BrowserWindowPool(this._numInstances, this._incognitoMode);
    this._isRunning = true;
  }

  /**
   * Get the Electron session used by this downloader's browser windows.
   */
  getSession(): Session {
    if (!this._pool) throw new Error('HtmlDownloader not initialized');
    return this._pool.getSession();
  }

  /**
   * Load the HTML of a given URL with concurrency support.
   *
   * Takes in a callback that will be called with the HTML content. Will be retried if it fails
   * with a new version of the window's HTML. Using a callback instead of returning the HTML directly
   * because we need to keep the window aquired until the callback is finished.
   */
  async loadUrl<T>({
    url,
    scrollTimes = 3,
    callback,
  }: {
    url: string;
    scrollTimes?: number;
    callback: (_: {
      html: string;
      webPageRuntimeData: WebPageRuntimeData;
      maxRetries: number;
      retryCount: number;
    }) => Promise<T>;
  }): Promise<T> {
    if (!this._pool) throw new Error('Pool not initialized');

    return this._pool.useBrowserWindow(async (window) => {
      await this._loadUrl(window, url, scrollTimes);

      const maxRetries = 1;
      let retryCount = 0;
      return backOff(
        async () => {
          // for linkedin, dump react context into a custom attribute for certain elements
          if (window.webContents.getURL().includes('linkedin.com')) {
            await window.webContents.executeJavaScript(getLinkedinReactContextBuilder()).catch((error) => {
              this._logger.error(`Failed to inject LinkedIn decorator: ${getExceptionMessage(error)}`);
            });
          }

          const html: string = await window.webContents.executeJavaScript('document.documentElement.innerHTML');

          // Read runtime data captured by the protocol handler (stored in main-process memory)
          const webPageRuntimeData: WebPageRuntimeData = {};

          return callback({ html, webPageRuntimeData, maxRetries, retryCount: retryCount++ });
        },
        {
          jitter: 'full',
          numOfAttempts: 1 + maxRetries,
          maxDelay: 5_000,
          startingDelay: 1_000,
          retry: () => {
            // perform retries only if the window is still running
            return this._isRunning;
          },
        },
      );
    });
  }

  /**
   * Close the headless window.
   */
  async close() {
    this._isRunning = false;
    return this._pool?.close();
  }

  /**
   * Load an URL and make sure to wait for the page to load.
   */
  private async _loadUrl(window: BrowserWindow, url: string, scrollTimes: number) {
    if (!this._isRunning) return '<html></html>';

    this._logger.info(`loading url: ${url} ...`);
    await backOff(
      async () => {
        let statusCode: number | undefined;
        window.webContents.once('did-navigate', (event, url, httpResponseCode) => {
          statusCode = httpResponseCode;
        });
        let timeoutHandle: NodeJS.Timeout | undefined;
        try {
          await Promise.race([
            window.loadURL(url).catch((error) => {
              if (!isAbortedNavigation(error)) throw error;
            }),
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                window.webContents.stop();
                reject(new PageLoadTimeoutError(`page load timed out after ${PAGE_LOAD_TIMEOUT_MS / 1000}s`));
              }, PAGE_LOAD_TIMEOUT_MS);
            }),
          ]);
        } finally {
          clearTimeout(timeoutHandle);
        }

        // handle rate limits
        const title = await window.webContents.executeJavaScript('document.title');
        if (statusCode === 429 || title?.toLowerCase().startsWith('just a moment')) {
          this._logger.debug(`429 status code detected: ${url}`);
          await waitRandomBetween(20_000, 40_000);
          throw new RateLimitError('rate limit exceeded');
        }

        // scroll to bottom a few times to trigger infinite loading
        for (let i = 0; i < scrollTimes; i++) {
          await window.webContents.executeJavaScript(
            `
              Array.from(document.querySelectorAll('*'))
                .filter(el => el.scrollHeight > el.clientHeight)
                .forEach(el => {
                  // Smooth scroll to the bottom
                  el.scrollTo({
                    top: el.scrollHeight,
                    behavior: 'smooth'
                  });
                });
            `,
          );
          await sleep(2_000);

          // check if page was redirected to a login page
          const finalUrl = window.webContents.getURL();
          if (KNOWN_AUTHWALLS.some((authwall) => finalUrl?.includes(authwall))) {
            this._logger.debug(`authwall detected: ${finalUrl}`);
            throw new AuthwallError('authwall');
          }
        }
      },
      {
        jitter: 'full',
        numOfAttempts: PAGE_LOAD_ATTEMPTS,
        startingDelay: 2_000,
        maxDelay: 15_000,
        retry: (error, attemptNumber) => {
          // retrying won't help if we are rate limited or the site wants a login
          if (error instanceof RateLimitError || error instanceof AuthwallError) {
            return false;
          }
          this._logger.debug(
            `retrying page load (${attemptNumber}/${PAGE_LOAD_ATTEMPTS}) for ${url}: ${getExceptionMessage(error)}`,
          );

          // perform retries only if the window is still running
          return this._isRunning;
        },
      },
    );

    this._logger.info(`finished loading url: ${url}`);
  }
}

/**
 * Class used to manage a pool of headless windows.
 */
class BrowserWindowPool {
  private _pool: Array<{
    id: number;
    window: BrowserWindow;
    isAvailable: boolean;
  }> = [];
  private _queue: WorkerQueue;

  /**
   * Class constructor.
   */
  constructor(instances: number, incognitoMode: boolean) {
    const partition = incognitoMode ? `incognito` : `persist:scraper`;

    for (let i = 0; i < instances; i++) {
      const window = new BrowserWindow({
        show: false,
        // set the window size
        width: 1600,
        height: 1200,
        webPreferences: {
          webSecurity: true,
          partition,
        },
      });

      // disable LinkedIn's passkey request, because it triggers an annoying popup
      window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        // if the request url matches the url which appears to be sending the passkey request
        if (details.url.includes('checkpoint/pk/initiateLogin')) {
          // never call the callback to block the request
        } else {
          callback({});
        }
      });

      this._pool.push({
        id: i,
        window,
        isAvailable: true,
      });
    }

    this._queue = new WorkerQueue(instances);
  }

  /**
   * Get the Electron session used by the pool's browser windows.
   */
  getSession(): Session {
    return this._pool[0].window.webContents.session;
  }

  /**
   * Get an available window and use it.
   */
  async useBrowserWindow<T>(fn: (window: BrowserWindow) => Promise<T>) {
    return this._queue.enqueue(() => {
      const worker = this._pool.find((w) => w.isAvailable);
      if (!worker) throw new Error('No available window found');
      worker.isAvailable = false;

      return fn(worker.window).finally(() => {
        worker.isAvailable = true;
      });
    });
  }

  /**
   * Wait until all windows are available and close them.
   */
  close() {
    return new Promise<void>((resolve) => {
      // wait until the queue is empty
      this._queue.on('empty', () => {
        this._pool.forEach((w) => w.window.close());

        // artificial delay to allow the window to close
        setTimeout(() => resolve(), 500);
      });

      // trigger the empty event if the queue is already empty
      this._queue.next();
    });
  }
}
