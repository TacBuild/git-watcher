import axios, { AxiosInstance } from 'axios';
import { TelegramMessage } from '../types';
import { getLogger } from '../utils/logger';

export interface TelegramApiResponse {
  ok: boolean;
  result?: unknown;
  error_code?: number;
  description?: string;
}

export interface TelegramSendMessageResponse {
  message_id: number;
  date: number;
  chat: {
    id: number;
    type: string;
  };
  text: string;
}

export class TelegramClient {
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor(botToken: string, timeout: number = 30000) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async sendMessage(message: TelegramMessage): Promise<TelegramSendMessageResponse> {
    const logger = getLogger();

    try {
      logger.debug('Sending Telegram message', {
        chatId: message.chatId,
        textLength: message.text.length,
        parseMode: message.parseMode,
      });

      const response = await this.httpClient.post<TelegramApiResponse>('/sendMessage', {
        chat_id: message.chatId,
        text: message.text,
        parse_mode: message.parseMode,
        disable_web_page_preview: false,
        disable_notification: false,
      });

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description || 'Unknown error'}`);
      }

      const result = response.data.result as TelegramSendMessageResponse;

      logger.info('Telegram message sent successfully', {
        chatId: message.chatId,
        messageId: result.message_id,
        date: result.date,
      });

      return result;
    } catch (error) {
      logger.error('Failed to send Telegram message', {
        chatId: message.chatId,
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: message.text.length,
      });

      if (axios.isAxiosError(error) && error.response?.data) {
        const apiError = error.response.data as TelegramApiResponse;
        throw new Error(`Telegram API error: ${apiError.description || error.message}`);
      }

      throw error;
    }
  }

  async getMe(): Promise<{ id: number; username: string; first_name: string; is_bot: boolean }> {
    const logger = getLogger();

    try {
      logger.debug('Getting bot information');

      const response = await this.httpClient.get<TelegramApiResponse>('/getMe');

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description || 'Unknown error'}`);
      }

      const result = response.data.result as {
        id: number;
        username: string;
        first_name: string;
        is_bot: boolean;
      };

      logger.info('Bot information retrieved', {
        botId: result.id,
        username: result.username,
        firstName: result.first_name,
        isBot: result.is_bot,
      });

      return result;
    } catch (error) {
      logger.error('Failed to get bot information', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    const logger = getLogger();

    try {
      await this.getMe();
      logger.info('Telegram bot connection test successful');
      return true;
    } catch (error) {
      logger.error('Telegram bot connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async sendFormattedMessage(
    chatId: string,
    text: string,
    parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
  ): Promise<TelegramSendMessageResponse> {
    const message: TelegramMessage = {
      chatId,
      text,
      parseMode,
    };

    return this.sendMessage(message);
  }

  private static readonly RATE_LIMIT_DELAY = 1000 / 30;
  private lastMessageTime = 0;

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;

    if (timeSinceLastMessage < TelegramClient.RATE_LIMIT_DELAY) {
      const delay = TelegramClient.RATE_LIMIT_DELAY - timeSinceLastMessage;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastMessageTime = Date.now();
  }

  async sendMessageWithRateLimit(message: TelegramMessage): Promise<TelegramSendMessageResponse> {
    await this.waitForRateLimit();
    return this.sendMessage(message);
  }
}
