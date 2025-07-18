import express from 'express';
import { loadConfig } from './utils/config';
import { initializeLogger } from './utils/logger';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './middleware/logging';
import { createSignatureMiddleware, rawBodyMiddleware } from './middleware/signature';
import { WebhookController } from './controllers/webhookController';
import { NotificationService } from './services/notificationService';

async function startServer(): Promise<void> {
  try {
    const config = loadConfig();
    const logger = initializeLogger(config);
    
    const app = express();
    const notificationService = new NotificationService(config);
    const webhookController = new WebhookController(notificationService);

    // Middleware setup
    app.use(requestLoggingMiddleware);
    
    // Routes that need raw body for signature validation
    app.use('/webhook', rawBodyMiddleware);
    app.use('/webhook', createSignatureMiddleware(config.github.webhookSecret));
    
    // Handle both JSON and form-encoded payloads for webhooks
    app.use('/webhook', express.json({ limit: '1mb' }));
    app.use('/webhook', express.urlencoded({ extended: true, limit: '1mb' }));

    // Routes that don't need signature validation
    app.use(express.json({ limit: '1mb' }));

    // Route handlers
    app.get('/health', webhookController.healthCheck.bind(webhookController));
    app.get('/test-telegram', webhookController.testTelegram.bind(webhookController));
    app.post('/webhook', webhookController.handleWebhook.bind(webhookController));

    // Error handling middleware
    app.use(errorLoggingMiddleware);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      notificationService.destroy();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      notificationService.destroy();
      process.exit(0);
    });

    app.listen(config.port, () => {
      logger.info(`Git-to-Telegram notifier started successfully`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
      });
    });

    // Test Telegram connection
    if (config.telegram.botToken && config.telegram.chatId) {
      logger.info('Testing Telegram connection...');
      const isConnected = await notificationService.testTelegramConnection();
      if (isConnected) {
        logger.info('Telegram connection successful - notifications enabled');
      } else {
        logger.warn('Telegram connection failed - notifications will not work');
      }
    } else {
      logger.warn('Telegram configuration missing - notifications disabled');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);
