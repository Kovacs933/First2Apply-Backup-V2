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
 */
class Logger implements ILogger {
  constructor(private _logger: MezmoLogger) {}

  debug(message: string, data?: Record<string, any>) {
    console.log(message, data);
    this._logger.debug(message, {
      meta: data,
    });
  }

  info(message: string, data?: Record<string, any>) {
    console.log(message, data);
    this._logger.info(message, {
      meta: data,
    });
  }

  error(message: string, data?: Record<string, any>) {
    console.error(message, data);
    this._logger.error(message, {
      meta: data,
    });
  }

  addMeta(key: string, value: string) {
    this._logger.addMetaProperty(key, value);
  }

  flush() {
    this._logger.flush();
  }
}

/**
 * Plain console logger used when no Mezmo API key is configured (e.g. local/self-hosted setups).
 */
class ConsoleLogger implements ILogger {
  debug(message: string, data?: Record<string, unknown>) {
    console.debug(message, data ?? '');
  }
  info(message: string, data?: Record<string, unknown>) {
    console.log(message, data ?? '');
  }
  error(message: string, data?: Record<string, unknown>) {
    console.error(message, data ?? '');
  }
  addMeta() {
    // no-op
  }
  flush() {
    // no-op
  }
}

export const logger: ILogger = ENV.mezmoApiKey
  ? new Logger(
      createLogger(ENV.mezmoApiKey, {
        level: ENV.nodeEnv === 'development' ? 'debug' : 'info',
        app: ENV.appBundleId,
        env: ENV.nodeEnv,
        hostname: process.platform,
        meta: {
          version: app.getVersion(),
          arch: process.arch,
        },
        indexMeta: true,
      }),
    )
  : new ConsoleLogger();
