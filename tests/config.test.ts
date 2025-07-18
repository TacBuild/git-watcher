import { loadConfig, ConfigError } from '../src/utils/config';

describe('Config Management', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load valid configuration', () => {
    process.env['TELEGRAM_BOT_TOKEN'] = 'bot123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    process.env['TELEGRAM_CHAT_ID'] = '-1001234567890';
    process.env['GITHUB_WEBHOOK_SECRET'] = 'super-secret-webhook-key';
    process.env['PORT'] = '3000';
    process.env['NODE_ENV'] = 'test';
    process.env['LOG_LEVEL'] = 'debug';

    const config = loadConfig();

    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('test');
    expect(config.telegram.botToken).toBe('bot123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(config.telegram.chatId).toBe('-1001234567890');
    expect(config.github.webhookSecret).toBe('super-secret-webhook-key');
    expect(config.logging.level).toBe('debug');
  });

  it('should throw error for missing required environment variables', () => {
    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('should use default values for optional variables', () => {
    process.env['TELEGRAM_BOT_TOKEN'] = 'bot123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    process.env['TELEGRAM_CHAT_ID'] = '-1001234567890';
    process.env['GITHUB_WEBHOOK_SECRET'] = 'super-secret-webhook-key';
    delete process.env['NODE_ENV'];
    delete process.env['LOG_LEVEL'];
    delete process.env['PORT'];

    const config = loadConfig();

    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
    expect(config.logging.level).toBe('info');
  });

  it('should validate port range', () => {
    process.env['TELEGRAM_BOT_TOKEN'] = 'bot123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    process.env['TELEGRAM_CHAT_ID'] = '-1001234567890';
    process.env['GITHUB_WEBHOOK_SECRET'] = 'super-secret-webhook-key';
    process.env['PORT'] = '70000';

    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it('should validate webhook secret length', () => {
    process.env['TELEGRAM_BOT_TOKEN'] = 'bot123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    process.env['TELEGRAM_CHAT_ID'] = '-1001234567890';
    process.env['GITHUB_WEBHOOK_SECRET'] = 'short';

    expect(() => loadConfig()).toThrow(ConfigError);
  });
});