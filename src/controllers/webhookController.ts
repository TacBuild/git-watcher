import { Request, Response } from 'express';
import { getLogger } from '../utils/logger';

export interface WebhookRequest extends Request {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export class WebhookController {
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

      logger.info('Received GitHub webhook', {
        eventType,
        deliveryId,
        repository: req.body?.repository?.full_name,
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
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'git-to-telegram-notifier',
    });
  }
}
