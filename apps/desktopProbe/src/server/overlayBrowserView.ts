import { OverlayBrowserViewResult } from '@/lib/types';
import { WebPageRuntimeData } from '@first2apply/core';
import { BrowserWindow, WebContentsView, dialog } from 'electron';

import { AutofillDetails, buildAutofillScript } from './autofillScript';
import { getLinkedinReactContextBuilder } from './browserHelpers';

function isGoogleSignIn(url: string): boolean {
  try {
    return new URL(url).hostname === 'accounts.google.com';
  } catch {
    return false;
  }
}

/**
 * Class used to render a WebContentsView on top of the main window
 * to be used as a browser window. The UI (back/forward buttons, URL bar, etc)
 * should be implemented in React.
 */
export class OverlayBrowserView {
  private _mainWindow?: BrowserWindow;
  private _searchView?: WebContentsView;
  private _resizeListener?: () => void;
  private _autofill?: AutofillDetails;

  /**
   * Turn the Apply assistant's form filling on (with the candidate's details) or off (null).
   */
  setAutofill(details: AutofillDetails | null) {
    this._autofill = details ?? undefined;
  }

  /**
   * Fill the candidate's details into the current page, including forms embedded from other sites.
   * Returns how many boxes were filled.
   */
  async autofill(): Promise<number> {
    if (!this._searchView || !this._autofill) return 0;
    const script = buildAutofillScript(this._autofill);
    const frames = this._searchView.webContents.mainFrame.framesInSubtree;
    const counts = await Promise.all(
      frames.map((frame) => frame.executeJavaScript(script).then((n) => Number(n) || 0).catch(() => 0)),
    );
    return counts.reduce((sum, n) => sum + n, 0);
  }

  /**
   * The visible text of the current page (used to import a LinkedIn profile into the CV Builder).
   */
  async pageText(): Promise<{ url: string; title: string; text: string }> {
    if (!this._searchView) throw new Error('The browser is not open');
    const webContents = this._searchView.webContents;
    const text: string = await webContents.executeJavaScript('document.body ? document.body.innerText : ""');
    return { url: webContents.getURL(), title: webContents.getTitle(), text };
  }

  /**
   * Set the parent main window.
   */
  setMainWindow(mainWindow: BrowserWindow) {
    this._mainWindow = mainWindow;
  }

  /**
   * Open the browser view.
   */
  open(url: string) {
    if (!this._mainWindow) {
      throw new Error('Main window is not set');
    }
    // a view left open (e.g. from another page) would otherwise sit there without its header bar,
    // so reuse it for the new page
    if (this._searchView) {
      this.navigate(url);
      return;
    }

    this._searchView = new WebContentsView({
      webPreferences: {
        // the partition here is shared with the main window, so that cookies and local storage are shared
        partition: 'persist:scraper',
      },
    });

    // set the bounds of the view to be the same as the main window
    this._updateSearchViewBounds();

    // Add resize listener
    this._resizeListener = this._updateSearchViewBounds.bind(this);
    this._mainWindow.on('resize', this._resizeListener);

    // Listen for navigation events and send the new URL to the renderer
    const sendUrlUpdate = (_event: Event, newUrl: string) => {
      this._mainWindow?.webContents.send('browser-view-url-changed', newUrl);
    };
    this._searchView.webContents.on('did-navigate', sendUrlUpdate);
    this._searchView.webContents.on('did-navigate-in-page', sendUrlUpdate);

    // Google blocks sign-in inside Electron apps ("This browser or app may not be secure"),
    // so stop "Sign in with Google" here and explain instead of showing Google's error page
    this._searchView.webContents.setWindowOpenHandler(({ url }) => {
      if (isGoogleSignIn(url)) {
        this._showGoogleSignInMessage();
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });
    this._searchView.webContents.on('will-navigate', (event, url) => {
      if (isGoogleSignIn(url)) {
        event.preventDefault();
        this._showGoogleSignInMessage();
      }
    });

    // Apply assistant: fill the candidate's details into each page that loads (forms often appear a moment later)
    this._searchView.webContents.on('did-stop-loading', () => {
      if (!this._autofill) return;
      setTimeout(() => this.autofill().catch(() => {}), 1200);
    });

    this._mainWindow.contentView.addChildView(this._searchView);

    this.navigate(url);
  }

  /**
   * Navigate to a URL.
   */
  navigate(url: string) {
    if (!this._searchView) {
      throw new Error('Search view is not ready');
    }

    // if the url contains spaces, replace them go a google search
    if (url.split(' ').length > 1) {
      url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
    }
    // make sure the string starts with http or https
    else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    this._searchView.webContents.loadURL(url);
  }

  /**
   * Go back in the browser view history.
   */
  canGoBack(): boolean {
    if (!this._searchView) {
      return false;
    }

    return this._searchView.webContents.navigationHistory.canGoBack();
  }
  goBack() {
    if (!this._searchView) {
      throw new Error('Search view is not ready');
    }

    if (this._searchView.webContents.navigationHistory.canGoBack()) {
      this._searchView.webContents.navigationHistory.goBack();
    }
  }

  /**
   * Go forward in the browser view history.
   */
  canGoForward(): boolean {
    if (!this._searchView) {
      return false;
    }

    return this._searchView.webContents.navigationHistory.canGoForward();
  }
  goForward() {
    if (!this._searchView) {
      throw new Error('Search view is not ready');
    }

    if (this._searchView.webContents.navigationHistory.canGoForward()) {
      this._searchView.webContents.navigationHistory.goForward();
    }
  }

  /**
   * Tell the user that Google sign-in doesn't work inside Foundation.
   */
  private _showGoogleSignInMessage() {
    if (!this._mainWindow) return;
    dialog.showMessageBox(this._mainWindow, {
      type: 'info',
      title: 'Google sign-in not supported',
      message: "Google sign-in isn't supported inside Foundation",
      detail:
        "Google blocks signing in from inside apps. Use this site's email and password sign-in instead. " +
        'If it only offers Google, sign in using your normal web browser.',
    });
  }

  /**
   * Update the search view bounds to match the main window
   */
  private _updateSearchViewBounds() {
    if (this._mainWindow && this._searchView) {
      const contentBounds = this._mainWindow.getContentBounds();
      // Start 50px from the top, maintain the width, and adjust the height accordingly
      this._searchView.setBounds({
        x: 0, // Start at left edge of content area
        y: 50, // 50px from top of content area
        width: contentBounds.width,
        height: contentBounds.height - 50,
      });
    }
  }

  /**
   * Get the html content, title, and URL of the current page and close the modal.
   */
  async finish(): Promise<OverlayBrowserViewResult> {
    if (!this._searchView) {
      throw new Error('Search view is not set');
    }

    if (this._searchView.webContents.getURL().includes('linkedin.com')) {
      await this._searchView.webContents.executeJavaScript(getLinkedinReactContextBuilder()).catch((error) => {
        error;
      });
    }

    const html = await this._searchView.webContents.executeJavaScript('document.documentElement.outerHTML');
    const title = await this._searchView.webContents.executeJavaScript('document.title');
    const url = this._searchView.webContents.getURL();

    // Read runtime data captured by the protocol handler (stored in main-process memory)
    const webPageRuntimeData: WebPageRuntimeData = {};

    this.close();

    return {
      url,
      title,
      html,
      webPageRuntimeData,
    };
  }

  /**
   * Close the job board modal.
   * This is used when the user cancels the modal.
   */
  close() {
    // Remove the resize listener
    if (this._resizeListener && this._mainWindow) {
      this._mainWindow.removeListener('resize', this._resizeListener);
      this._resizeListener = undefined;
    }

    if (this._searchView) {
      this._mainWindow?.contentView.removeChildView(this._searchView);
      this._searchView.webContents.close();
      this._searchView = undefined;
    }
  }
}
