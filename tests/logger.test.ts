import { Logger } from '../src/utils/logger';
import { AppConfig } from '../src/types';
import fs from 'fs';

const testConfig: AppConfig = {
  port: 3000,
  nodeEnv: 'test',
  telegram: {
    botToken: 'test-bot-token',
    chatId: 'test-chat-id',
  },
  github: {
    webhookSecret: 'test-webhook-secret',
  },
  logging: {
    level: 'debug',
  },
};

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(testConfig);
  });

  afterEach(() => {
    const logFiles = ['logs/error.log', 'logs/combined.log'];
    logFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  it('should create logger instance', () => {
    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should have all required logging methods', () => {
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.logRequest).toBe('function');
    expect(typeof logger.logGitHubEvent).toBe('function');
    expect(typeof logger.logTelegramMessage).toBe('function');
  });

  it('should log GitHub events', () => {
    const spy = jest.spyOn(logger, 'info');
    
    logger.logGitHubEvent('push', 'event-123', true, { repository: 'test-repo' });
    
    expect(spy).toHaveBeenCalledWith('GitHub event processed successfully', {
      eventType: 'push',
      eventId: 'event-123',
      success: true,
      repository: 'test-repo',
    });
  });

  it('should log Telegram messages', () => {
    const spy = jest.spyOn(logger, 'info');
    
    logger.logTelegramMessage('test-chat-id', true);
    
    expect(spy).toHaveBeenCalledWith('Telegram message sent successfully', {
      chatId: 'test-chat-id',
      success: true,
      error: undefined,
    });
  });

  it('should log request data', () => {
    const mockReq = {
      method: 'GET',
      url: '/health',
      get: jest.fn().mockReturnValue('test-agent'),
      ip: '127.0.0.1',
    };

    const mockRes = {
      statusCode: 200,
    };

    const spy = jest.spyOn(logger, 'info');
    
    logger.logRequest(mockReq, mockRes, 100);
    
    expect(spy).toHaveBeenCalledWith('HTTP request processed', {
      method: 'GET',
      url: '/health',
      userAgent: 'test-agent',
      statusCode: 200,
      duration: '100ms',
      ip: '127.0.0.1',
    });
  });
});