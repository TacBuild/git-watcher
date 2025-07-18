import express from 'express';
import { loadConfig } from './utils/config';
import { initializeLogger } from './utils/logger';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './middleware/logging';
import { WebhookController } from './controllers/webhookController';

async function startServer(): Promise<void> {
  try {
    const config = loadConfig();
    const logger = initializeLogger(config);

    const app = express();
    const webhookController = new WebhookController();

    app.use(express.json({ limit: '1mb' }));
    app.use(requestLoggingMiddleware);

    app.get('/health', webhookController.healthCheck.bind(webhookController));
    app.post('/webhook', webhookController.handleWebhook.bind(webhookController));

    app.use(errorLoggingMiddleware);

    app.listen(config.port, () => {
      logger.info(`Git-to-Telegram notifier started successfully`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);
