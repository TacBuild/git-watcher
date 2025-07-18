import dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvVarAsNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue === undefined) {
      throw new ConfigError(`Missing required environment variable: ${name}`);
    }
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new ConfigError(`Environment variable ${name} must be a number`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  try {
    const config: AppConfig = {
      port: getEnvVarAsNumber('PORT', 3000),
      nodeEnv: getEnvVar('NODE_ENV', 'development'),
      telegram: {
        botToken: '',
        chatId: '',
      },
      github: {
        webhookSecret: '',
      },
      logging: {
        level: getEnvVar('LOG_LEVEL', 'info'),
      },
    };

    validateConfig(config);
    return config;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

function validateConfig(config: AppConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new ConfigError('Port must be between 1 and 65535');
  }

  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logging.level)) {
    throw new ConfigError(`Invalid log level. Must be one of: ${validLogLevels.join(', ')}`);
  }
}

export { ConfigError };
