import { ENV } from '../env';

import { Logger as MezmoLogger, createLogger } from '@logdna/logger';
import { app } from 'electron';

export interface ILogger {
  debug(message: string, data?: Record<string, any>): void;
  info(message: string, data?: Record<string, any>): void;
  error(message: string, data?: Record<string, any>): void;
  addMeta(key: string, value: string): void;
  flush(): void;
}

/**
 * Custom logger class that wraps the Mezmo logger.
 * If no Mezmo logger is provided (no API key), it only logs to the console.
 */
class Logger implements ILogger {
  constructor(private _logger: MezmoLogger | null) {}

  debug(message: string, data?: Record<string, any>) {
    console.log(message, data);
    this._logger?.debug(message, {
      meta: data,
    });
  }

  info(message: string, data?: Record<string, any>) {
    console.log(message, data);
    this._logger?.info(message, {
      meta: data,
    });
  }

  error(message: string, data?: Record<string, any>) {
    console.error(message, data);
    this._logger?.error(message, {
      meta: data,
    });
  }

  addMeta(key: string, value: string) {
    this._logger?.addMetaProperty(key, value);
  }

  flush() {
    this._logger?.flush();
  }
}

const mezmoLogger = ENV.mezmoApiKey
  ? createLogger(ENV.mezmoApiKey, {
      level: ENV.nodeEnv === 'development' ? 'debug' : 'info',
      app: ENV.appBundleId,
      env: ENV.nodeEnv,
      hostname: process.platform,
      meta: {
        version: app.getVersion(),
        arch: process.arch,
      },
      indexMeta: true,
    })
  : null;
export const logger = new Logger(mezmoLogger);