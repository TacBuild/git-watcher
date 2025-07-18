import { GitHubEventParser, ParsedEvent } from './eventParser';
import { EventDeduplicationService } from './deduplication';
import { TelegramClient } from './telegramClient';
import { TelegramMessageFormatter } from './messageFormatter';
import { getLogger } from '../utils/logger';
import { AppConfig } from '../types';

export class NotificationService {
  private readonly eventParser: GitHubEventParser;
  private readonly deduplicationService: EventDeduplicationService;
  private readonly telegramClient: TelegramClient;
  private readonly messageFormatter: TelegramMessageFormatter;
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.eventParser = new GitHubEventParser();
    this.deduplicationService = new EventDeduplicationService();
    this.telegramClient = new TelegramClient(config.telegram.botToken);
    this.messageFormatter = new TelegramMessageFormatter();
  }

  async processGitHubEvent(eventType: string, deliveryId: string, payload: unknown): Promise<void> {
    const logger = getLogger();

    try {
      logger.info('Processing GitHub event', {
        eventType,
        deliveryId,
        repository: (payload as unknown as { repository: { full_name: string } })?.repository
          ?.full_name,
      });

      // Handle special cases for events that don't have repository
      if (eventType === 'ping') {
        logger.info('Ping event received - webhook is working');
        return;
      }

      // Check if payload has repository property
      if (!(payload as unknown as { repository: { full_name: string } })?.repository) {
        logger.warn('Event payload missing repository property', {
          eventType,
          deliveryId,
          payloadType: typeof payload,
          payloadIsObject: typeof payload === 'object' && payload !== null,
          payloadKeys:
            typeof payload === 'object' && payload !== null ? Object.keys(payload as object) : [],
        });
        return;
      }

      const parsedEvent = this.eventParser.parseEvent(eventType, deliveryId, payload as any);

      if (this.deduplicationService.checkAndMarkProcessed(parsedEvent)) {
        logger.info('Duplicate event detected, skipping notification', {
          eventType,
          deliveryId,
          repository: parsedEvent.repository,
        });
        return;
      }

      if (eventType !== 'push') {
        logger.debug('Event type not configured for processing (only push events enabled)', {
          eventType,
          deliveryId,
        });
        return;
      }

      const formattedMessage = this.messageFormatter.formatMessage(parsedEvent);

      console.log('Formatted Message:', formattedMessage);

      await this.sendTelegramNotification(formattedMessage, parsedEvent);

      logger.info('GitHub event processed successfully', {
        eventType,
        deliveryId,
        repository: parsedEvent.repository,
      });
    } catch (error) {
      logger.error('Failed to process GitHub event', {
        eventType,
        deliveryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async sendTelegramNotification(message: string, event: ParsedEvent): Promise<void> {
    const logger = getLogger();

    try {
      const response = await this.telegramClient.sendMessageWithRateLimit({
        chatId: this.config.telegram.chatId,
        text: message,
        parseMode: 'HTML',
        disableWebPagePreview: false,
      });

      logger.info('Telegram notification sent successfully', {
        eventType: event.eventType,
        eventId: event.eventId,
        repository: event.repository,
        messageId: response.message_id,
        chatId: this.config.telegram.chatId,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification', {
        eventType: event.eventType,
        eventId: event.eventId,
        repository: event.repository,
        chatId: this.config.telegram.chatId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async testTelegramConnection(): Promise<boolean> {
    const logger = getLogger();

    try {
      const isConnected = await this.telegramClient.testConnection();

      if (isConnected) {
        logger.info('Telegram connection test successful');
        return true;
      } else {
        logger.error('Telegram connection test failed');
        return false;
      }
    } catch (error) {
      logger.error('Telegram connection test error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async sendTestMessage(): Promise<void> {
    const logger = getLogger();

    try {
      const message = '🤖 <b>Test Message</b>\\nGit-to-Telegram notifier is working correctly!';

      await this.telegramClient.sendFormattedMessage(this.config.telegram.chatId, message, 'HTML');

      logger.info('Test message sent successfully');
    } catch (error) {
      logger.error('Failed to send test message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  getCacheStats(): { size: number; maxSize: number; oldestEntry?: Date | undefined } {
    return this.deduplicationService.getCacheStats();
  }

  destroy(): void {
    this.deduplicationService.destroy();
  }
}
