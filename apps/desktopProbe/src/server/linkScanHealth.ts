import { getExceptionMessage } from '@first2apply/core';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

import { LinkScanHealth } from '../lib/types';
import { ILogger } from './logger';

const healthFilePath = () => path.join(app.getPath('userData'), 'link-scan-health.json');

/**
 * Turn a technical scan error into a short, plain-English explanation.
 */
export function toFriendlyScanError(error: unknown): string {
  const message = getExceptionMessage(error, true).toLowerCase();
  if (message.includes('authwall') || message.includes('login')) {
    return 'The site asked you to log in. Click this search, log in to the site, then press Retry.';
  }
  if (message.includes('rate limit') || message.includes('429')) {
    return 'The site temporarily blocked scanning because of too many visits. It will be retried on the next scan.';
  }
  if (message.includes('timed out') || message.includes('timeout')) {
    return 'The page took too long to load. Check your internet connection; it will be retried on the next scan.';
  }
  if (message.includes('failed to parse html')) {
    return "No jobs could be read from this page. The search may have no results, or the site's layout changed. Click to check it.";
  }
  if (message.includes('err_name_not_resolved') || message.includes('err_internet_disconnected')) {
    return 'No internet connection. It will be retried on the next scan.';
  }
  return `Scan failed: ${getExceptionMessage(error, true).slice(0, 200)}`;
}

/**
 * Keeps a small local record (on this computer) of how the last scan of each search went,
 * so the app can show "last scanned / last error / jobs found" without any database changes.
 */
export class LinkScanHealthStore {
  private _health: Record<number, LinkScanHealth> = {};

  constructor(private _logger: ILogger) {
    try {
      if (fs.existsSync(healthFilePath())) {
        this._health = JSON.parse(fs.readFileSync(healthFilePath(), 'utf-8'));
      }
    } catch (error) {
      this._logger.error(`failed to load link scan health: ${getExceptionMessage(error)}`);
      this._health = {};
    }
  }

  getAll(): Record<number, LinkScanHealth> {
    return { ...this._health };
  }

  recordSuccess(linkId: number, newJobsCount: number) {
    const now = new Date().toISOString();
    const previous = this._health[linkId];
    this._health[linkId] = {
      lastScanAt: now,
      lastSuccessAt: now,
      lastError: null,
      lastNewJobsCount: newJobsCount,
      totalNewJobsCount: (previous?.totalNewJobsCount ?? 0) + newJobsCount,
      consecutiveFailures: 0,
    };
    this._save();
  }

  recordFailure(linkId: number, error: unknown) {
    const previous = this._health[linkId];
    this._health[linkId] = {
      lastScanAt: new Date().toISOString(),
      lastSuccessAt: previous?.lastSuccessAt ?? null,
      lastError: toFriendlyScanError(error),
      lastNewJobsCount: 0,
      totalNewJobsCount: previous?.totalNewJobsCount ?? 0,
      consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
    };
    this._save();
  }

  private _save() {
    try {
      fs.writeFileSync(healthFilePath(), JSON.stringify(this._health));
    } catch (error) {
      this._logger.error(`failed to save link scan health: ${getExceptionMessage(error)}`);
    }
  }
}
