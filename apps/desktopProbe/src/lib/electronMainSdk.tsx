import {
  AdvancedMatchingConfig,
  First2ApplyApiSdk,
  GenerateCvParams,
  GeneratedCv,
  Job,
  JobLabel,
  JobSite,
  JobStatus,
  Link,
  ListJobsParams,
  ListJobsResult,
  Note,
  Profile,
  Review,
  StripeConfig,
  WebPageRuntimeData,
} from '@first2apply/core';
import { User } from '@supabase/supabase-js';

import { JobScannerSettings, LinkScanHealth, NewAppVersion, OverlayBrowserViewResult } from './types';

async function _mainProcessApiCall<T>(channel: string, params?: object): Promise<T> {
  // @ts-expect-error Electron preload injects window.electron
  const { data, error } = await window.electron.invoke(channel, params);
  if (error) throw new Error(error);

  return data;
}

/**
 * Get the currently used operating system.
 */
export async function getOS(): Promise<NodeJS.Platform> {
  return await _mainProcessApiCall('get-os-type', {});
}

/**
 * Create a new account with email and password.
 */
export async function signupWithEmail({ email, password }: { email: string; password: string }): Promise<User> {
  const { user } = await _mainProcessApiCall<{ user: User }>('signup-with-email', {
    email,
    password,
  });

  return user;
}

/**
 * Login with email and password.
 */
export async function loginWithEmail({ email, password }: { email: string; password: string }): Promise<User> {
  const { user } = await _mainProcessApiCall<{ user: User }>('login-with-email', {
    email,
    password,
  });

  return user;
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail({ email }: { email: string }): Promise<void> {
  await _mainProcessApiCall('send-password-reset-email', { email });
}

/**
 * Change the password of the current user.
 */
export async function changePassword({ password }: { password: string }): Promise<User> {
  const { user } = await _mainProcessApiCall<{ user: User }>('change-password', { password });
  return user;
}

/**
 * Logout user session.
 */
export async function logout(): Promise<void> {
  await _mainProcessApiCall('logout', {});
}

/**
 * Get user from the current session.
 */
export async function getUser(): Promise<User | null> {
  const { user } = await _mainProcessApiCall<{ user: User | null }>('get-user', {});
  return user;
}

/**
 * Function used to create a new link.
 */
export async function createLink({
  title,
  url,
  html,
  webPageRuntimeData,
  force,
}: {
  title: string;
  url: string;
  html: string;
  webPageRuntimeData: WebPageRuntimeData;
  force: boolean;
}): Promise<Link> {
  const { link } = await _mainProcessApiCall<{ link: Link }>('create-link', {
    title,
    url,
    html,
    webPageRuntimeData,
    force,
  });
  return link;
}

/**
 * Update an existing link.
 */
export async function updateLink({
  linkId,
  title,
  url,
}: {
  linkId: number;
  title: string;
  url: string;
}): Promise<Link> {
  const link = await _mainProcessApiCall<Link>('update-link', {
    linkId,
    title,
    url,
  });
  return link;
}

/**
 * List all links.
 */
export async function listLinks(): Promise<Link[]> {
  const links = await _mainProcessApiCall<Link[]>('list-links', {});
  return links;
}

/**
 * Delete a link.
 */
export async function deleteLink(linkId: number): Promise<void> {
  await _mainProcessApiCall('delete-link', { linkId });
}

/**
 * List all jobs.
 */
export async function listJobs({
  status,
  search,
  siteIds,
  linkIds,
  labels,
  limit,
  after,
}: {
  status: JobStatus;
  search?: string;
  siteIds?: number[];
  linkIds?: number[];
  labels?: string[];
  limit?: number;
  after?: string;
}) {
  const result = await _mainProcessApiCall<{
    jobs: Job[];
    new: number;
    applied: number;
    archived: number;
    filtered: number;
    deleted: number;
    nextPageToken?: string;
  }>('list-jobs', {
    status,
    search,
    siteIds,
    linkIds,
    labels,
    limit,
    after,
  });

  return result;
}

/**
 * Update the archived status of a job.
 */
export async function updateJobStatus({ jobId, status }: { jobId: number; status: JobStatus }): Promise<void> {
  await _mainProcessApiCall('update-job-status', { jobId, status });
}

/**
 * Update the labels of a job.
 */
export async function updateJobLabels({ jobId, labels }: { jobId: number; labels: JobLabel[] }): Promise<Job> {
  return await _mainProcessApiCall('update-job-labels', { jobId, labels });
}

/**
 * List all sites.
 */
export async function listSites() {
  return await _mainProcessApiCall<JobSite[]>('list-sites', {});
}

/**
 * Update the settings of the probe.
 */
export async function updateProbeSettings(settings: JobScannerSettings): Promise<void> {
  await _mainProcessApiCall('update-job-scanner-settings', {
    settings,
  });
}

/**
 * Get the current settings of the probe.
 */
export async function getProbeSettings(): Promise<JobScannerSettings> {
  const settings = await _mainProcessApiCall<JobScannerSettings>('get-job-scanner-settings', {});
  return settings;
}

/**
 * Open a url in the default browser.
 */
export async function openExternalUrl(url: string): Promise<void> {
  await _mainProcessApiCall('open-external-url', { url });
}

/**
 * Scan a job to fetch the details.
 */
export async function scanJob(job: Job): Promise<Job> {
  const { job: updatedJob } = await _mainProcessApiCall<{ job: Job }>('scan-job-description', { job });
  return updatedJob;
}

/**
 * Create a user review.
 */
export async function createReview({
  title,
  description,
  rating,
}: {
  title: string;
  description: string;
  rating: number;
}): Promise<Review> {
  return await _mainProcessApiCall('create-user-review', {
    title,
    description,
    rating,
  });
}

/**
 * Get a user review.
 */
export async function getUserReview(): Promise<Review | null> {
  return await _mainProcessApiCall('get-user-review', {});
}

/**
 * Update a user review.
 */
export async function updateReview({
  id,
  title,
  description,
  rating,
}: {
  id: number;
  title: string;
  description: string;
  rating: number;
}): Promise<Review> {
  return await _mainProcessApiCall('update-user-review', {
    id,
    title,
    description,
    rating,
  });
}

/**
 * Get a job by id.
 */
export async function getJobById(jobId: number): Promise<Job> {
  const { job } = await _mainProcessApiCall<{ job: Job }>('get-job-by-id', {
    jobId,
  });
  return job;
}

/**
 * Export all jobs with the given status to a CSV file.
 */
export async function exportJobsToCsv(status: JobStatus): Promise<void> {
  await _mainProcessApiCall<{ fileName: string }>('export-jobs-csv', {
    status,
  });
}

/**
 * The app version and Windows version, sent along with feedback.
 */
export async function getAppInfo(): Promise<{ version: string; os: string }> {
  return await _mainProcessApiCall('get-app-info', {});
}

/**
 * Write a CV for the target role with AI.
 */
export async function generateCv(params: GenerateCvParams): Promise<GeneratedCv> {
  return await _mainProcessApiCall('generate-cv', { params });
}

/**
 * The user's recent jobs with descriptions, used by the CV builder to see what employers ask for.
 */
export async function listJobsWithDescriptions(): Promise<CvSourceJob[]> {
  return await _mainProcessApiCall('list-jobs-with-descriptions', {});
}
export type CvSourceJob = Pick<Job, 'id' | 'title' | 'companyName' | 'description' | 'tags'>;

/**
 * Save a CV (as a full HTML page) to a PDF file the user picks.
 */
export async function saveCvPdf({ html, fileName }: { html: string; fileName: string }): Promise<{ saved: boolean }> {
  return await _mainProcessApiCall('save-cv-pdf', { html, fileName });
}

/**
 * Change the status of all jobs from one status to another.
 */
export async function changeAllJobsStatus({ from, to }: { from: JobStatus; to: JobStatus }): Promise<void> {
  await _mainProcessApiCall('change-all-job-status', { from, to });
}

/**
 * Get the profile of the current user.
 */
export async function getProfile(): Promise<Profile> {
  const { profile } = await _mainProcessApiCall<{ profile: Profile }>('get-profile', {});
  return profile;
}

/**
 * Get Stripe config.
 */
export async function getStripeConfig(): Promise<StripeConfig> {
  const { config } = await _mainProcessApiCall<{ config: StripeConfig }>('get-stripe-config', {});
  return config;
}

/**
 * Create a new note.
 */
export async function createNote({
  job_id,
  text,
  files,
}: {
  job_id: number;
  text: string;
  files: string[];
}): Promise<Note> {
  return await _mainProcessApiCall('create-note', {
    job_id,
    text,
    files,
  });
}

/**
 * List all notes for a job.
 */
export async function listNotes(job_id: number): Promise<Note[]> {
  const notes = await _mainProcessApiCall<Note[]>('list-notes', { job_id });
  return notes;
}

/**
 * Update a note.
 */
export async function updateNote({ noteId, text }: { noteId: number; text: string }): Promise<Note> {
  return await _mainProcessApiCall('update-note', {
    noteId,
    text,
  });
}

/**
 * Add a file to a note.
 */
export async function addFileToNote({ noteId, file }: { noteId: number; file: string }): Promise<Note> {
  return await _mainProcessApiCall('add-file-to-note', {
    noteId,
    file,
  });
}

/**
 * Delete a note.
 */
export async function deleteNote(noteId: number): Promise<void> {
  await _mainProcessApiCall('delete-note', { noteId });
}

/**
 * Get the advanced matching configuration for the current user.
 */
export async function getAdvancedMatchingConfig(): Promise<AdvancedMatchingConfig | null> {
  return await _mainProcessApiCall('get-advanced-matching-config', {});
}

/**
 * Update the advanced matching configuration for the current user.
 */
export async function updateAdvancedMatchingConfig(
  config: Pick<AdvancedMatchingConfig, 'chatgpt_prompt' | 'blacklisted_companies'>,
) {
  return await _mainProcessApiCall<AdvancedMatchingConfig>('update-advanced-matching-config', {
    config,
  });
}

/**
 * Scan a link to fetch new jobs.
 */
export async function scanLink(linkId: number): Promise<void> {
  await _mainProcessApiCall('scan-link', { linkId });
}

/**
 * Get how the last scan of each saved search went (stored locally), keyed by link id.
 */
export async function getLinkScanHealth(): Promise<Record<number, LinkScanHealth>> {
  return (await _mainProcessApiCall<Record<number, LinkScanHealth>>('get-link-scan-health', {})) ?? {};
}

/**
 * Start scanning all saved searches right now (runs in the background).
 */
export async function scanAllLinks(): Promise<void> {
  await _mainProcessApiCall('scan-all-links', {});
}

/**
 * Get the current state of the application.
 */
export async function getAppState(): Promise<{
  isScanning: boolean;
  newUpdate?: NewAppVersion;
}> {
  return await _mainProcessApiCall('get-app-state', {});
}

/**
 * Apply the latest app update.
 */
export async function applyAppUpdate(): Promise<void> {
  await _mainProcessApiCall('apply-app-update', {});
}

/**
 * Open browser window overlay.
 */
export async function openOverlayBrowserView(url: string): Promise<void> {
  await _mainProcessApiCall('open-overlay-browser-view', { url });
}

/**
 * Finish the overlay browser view and get the html content.
 */
export async function finishOverlayBrowserView(): Promise<OverlayBrowserViewResult> {
  const result = await _mainProcessApiCall<OverlayBrowserViewResult>('finish-overlay-browser-view', {});
  return result;
}

/**
 * Close the overlay browser view.
 */
export async function closeOverlayBrowserView() {
  await _mainProcessApiCall('close-overlay-browser-view', {});
}

/**
 * Check if the overlay browser view can go back.
 */
export async function overlayBrowserViewCanGoBack(): Promise<boolean> {
  return await _mainProcessApiCall<boolean>('overlay-browser-can-view-go-back', {});
}

/**
 * Navigate back in the overlay browser view.
 */
export async function overlayBrowserViewGoBack(): Promise<void> {
  await _mainProcessApiCall('overlay-browser-view-go-back', {});
}

/**
 * Check if the overlay browser view can go forward.
 */
export async function overlayBrowserViewCanGoForward(): Promise<boolean> {
  return await _mainProcessApiCall<boolean>('overlay-browser-can-view-go-forward', {});
}

/**
 * Navigate forward in the overlay browser view.
 */
export async function overlayBrowserViewGoForward(): Promise<void> {
  await _mainProcessApiCall('overlay-browser-view-go-forward', {});
}

/**
 * Navigate to a specific URL in the overlay browser view.
 */
export async function overlayBrowserViewNavigate(url: string): Promise<void> {
  await _mainProcessApiCall('overlay-browser-view-navigate', { url });
}

export type AutofillDetails = { fullName: string; email: string; phone: string; location: string; linkedinUrl: string };

/**
 * Apply assistant: fill these details into application forms opened in the in-app browser (null turns it off).
 */
export async function setOverlayBrowserAutofill(details: AutofillDetails | null): Promise<void> {
  await _mainProcessApiCall('overlay-browser-set-autofill', { details });
}

/**
 * Fill the details into the page open in the in-app browser now. Returns how many boxes were filled.
 */
export async function overlayBrowserAutofillNow(): Promise<{ filled: number }> {
  return await _mainProcessApiCall('overlay-browser-autofill-now', {});
}

/**
 * The visible text of the page open in the in-app browser.
 */
export async function overlayBrowserPageText(): Promise<{ url: string; title: string; text: string }> {
  return await _mainProcessApiCall('overlay-browser-page-text', {});
}

/**
 * Let the user pick their CV (PDF, Word or text) and return its text, or null if they cancelled.
 */
export async function readCvFile(): Promise<{ fileName: string; text: string } | null> {
  return await _mainProcessApiCall('read-cv-file', {});
}

/**
 * Electron IPC implementation of the First2Apply API SDK.
 */
export class ElectronApiSdk implements First2ApplyApiSdk {
  // Auth
  getUser = getUser;
  loginWithEmail = loginWithEmail;
  logout = logout;
  signupWithEmail = signupWithEmail;
  sendPasswordResetEmail = sendPasswordResetEmail;
  changePassword = changePassword;

  // Profile & Billing
  getProfile = getProfile;
  getStripeConfig = getStripeConfig;

  // Jobs
  listJobs = (params: ListJobsParams): Promise<ListJobsResult> => listJobs(params);
  getJobById = getJobById;
  updateJobStatus = updateJobStatus;
  updateJobLabels = updateJobLabels;
  exportJobsToCsv = exportJobsToCsv;
  changeAllJobsStatus = changeAllJobsStatus;
  scanJob = scanJob;

  // Links
  listLinks = listLinks;
  createLink = createLink;
  updateLink = updateLink;
  deleteLink = deleteLink;

  // Sites
  listSites = listSites;

  // Notes
  createNote = createNote;
  listNotes = listNotes;
  updateNote = updateNote;
  addFileToNote = addFileToNote;
  deleteNote = deleteNote;

  // Reviews
  createReview = createReview;
  getUserReview = getUserReview;
  updateReview = updateReview;

  // Advanced Matching
  getAdvancedMatchingConfig = getAdvancedMatchingConfig;
  updateAdvancedMatchingConfig = updateAdvancedMatchingConfig;
}

/** Singleton instance of the Electron API SDK */
export const electronApiSdk = new ElectronApiSdk();
