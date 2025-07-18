export interface AppConfig {
  port: number;
  nodeEnv: string;
  telegram: {
    botToken: string;
    chatId: string;
  };
  github: {
    webhookSecret: string;
  };
  logging: {
    level: string;
  };
}

export interface GitHubEvent {
  type: string;
  payload: unknown;
  timestamp: Date;
  eventId: string;
}

export interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}
