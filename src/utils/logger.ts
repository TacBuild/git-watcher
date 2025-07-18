import winston from 'winston';
import { AppConfig } from '../types';

const { combine, timestamp, errors, json, printf, colorize, splat } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]: ${stack || message}${metaString}`;
});

export class Logger {
  private logger: winston.Logger;

  constructor(config: AppConfig) {
    this.logger = winston.createLogger({
      level: config.logging.level,
      format: combine(timestamp(), errors({ stack: true }), json(), splat()),
      transports: [
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });

    if (config.nodeEnv !== 'production') {
      this.logger.add(
        new winston.transports.Console({
          format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat),
        }),
      );
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logRequest(req: any, res: any, duration: number): void {
    const logData = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };

    if (res.statusCode >= 400) {
      this.error('HTTP request failed', logData);
    } else {
      this.info('HTTP request processed', logData);
    }
  }

  logGitHubEvent(eventType: string, eventId: string, success: boolean, meta?: unknown): void {
    const logData = {
      eventType,
      eventId,
      success,
      ...(meta as Record<string, unknown>),
    };

    if (success) {
      this.info('GitHub event processed successfully', logData);
    } else {
      this.error('GitHub event processing failed', logData);
    }
  }

  logTelegramMessage(chatId: string, success: boolean, error?: string): void {
    const logData = {
      chatId,
      success,
      error,
    };

    if (success) {
      this.info('Telegram message sent successfully', logData);
    } else {
      this.error('Telegram message sending failed', logData);
    }
  }
}

let loggerInstance: Logger | null = null;

export function initializeLogger(config: AppConfig): Logger {
  loggerInstance = new Logger(config);
  return loggerInstance;
}

export function getLogger(): Logger {
  if (!loggerInstance) {
    throw new Error('Logger not initialized. Call initializeLogger first.');
  }
  return loggerInstance;
}
