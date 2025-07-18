import { Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { NotificationService } from '../services/notificationService';

export interface WebhookRequest extends Request {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export class WebhookController {
  constructor(private readonly notificationService: NotificationService) {}

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const logger = getLogger();
    const eventType = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;
    const signature = req.headers['x-hub-signature-256'] as string;

    try {
      if (!eventType || !deliveryId || !signature) {
        logger.warn('Missing required GitHub webhook headers', {
          eventType,
          deliveryId,
          hasSignature: !!signature,
        });
        res.status(400).json({ error: 'Missing required webhook headers' });
        return;
      }

      // Handle form-encoded payload (GitHub sends as application/x-www-form-urlencoded)
      let payload = req.body;
      if (req.body && req.body.payload) {
        try {
          payload = JSON.parse(req.body.payload);
        } catch (error) {
          logger.error('Failed to parse form-encoded payload', {
            eventType,
            deliveryId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          res.status(400).json({ error: 'Invalid payload format' });
          return;
        }
      }

      logger.info('Received GitHub webhook', {
        eventType,
        deliveryId,
        repository: payload?.repository?.full_name,
        payloadType: req.body?.payload ? 'form-encoded' : 'json',
      });

      this.notificationService.processGitHubEvent(eventType, deliveryId, payload).catch((error) => {
        logger.error('Async event processing failed', {
          eventType,
          deliveryId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

      res.status(200).json({ message: 'Webhook received successfully' });
    } catch (error) {
      logger.error('Error processing webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType,
        deliveryId,
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async healthCheck(_: Request, res: Response): Promise<void> {
    const cacheStats = this.notificationService.getCacheStats();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'git-to-telegram-notifier',
      cache: {
        size: cacheStats.size,
        maxSize: cacheStats.maxSize,
        oldestEntry: cacheStats.oldestEntry,
      },
    });
  }

  async testTelegram(_: Request, res: Response): Promise<void> {
    const logger = getLogger();

    try {
      const isConnected = await this.notificationService.testTelegramConnection();

      if (isConnected) {
        await this.notificationService.sendTestMessage();
        res.json({
          status: 'ok',
          message: 'Telegram connection test successful and test message sent',
        });
      } else {
        res.status(500).json({
          status: 'error',
          message: 'Telegram connection test failed',
        });
      }
    } catch (error) {
      logger.error('Telegram test endpoint error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        status: 'error',
        message: 'Telegram test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
