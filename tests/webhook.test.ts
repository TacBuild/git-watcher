import request from 'supertest';
import express from 'express';
import { WebhookController } from '../src/controllers/webhookController';
import { initializeLogger } from '../src/utils/logger';
import { AppConfig } from '../src/types';

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
    level: 'error',
  },
};

describe('Webhook Controller', () => {
  let app: express.Application;
  let webhookController: WebhookController;

  beforeEach(() => {
    initializeLogger(testConfig);
    app = express();
    webhookController = new WebhookController();
    
    app.use(express.json());
    app.get('/health', (req, res) => webhookController.healthCheck(req, res));
    app.post('/webhook', (req, res) => webhookController.handleWebhook(req, res));
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.service).toBe('git-to-telegram-notifier');
    });
  });

  describe('Webhook Handler', () => {
    it('should accept valid webhook with required headers', async () => {
      const mockPayload = {
        repository: {
          full_name: 'test/repo',
        },
      };

      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .set('x-github-delivery', 'test-delivery-id')
        .set('x-hub-signature-256', 'sha256=test-signature')
        .send(mockPayload);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Webhook received successfully');
    });

    it('should reject webhook with missing headers', async () => {
      const response = await request(app)
        .post('/webhook')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required webhook headers');
    });

    it('should reject webhook with missing event type', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-github-delivery', 'test-delivery-id')
        .set('x-hub-signature-256', 'sha256=test-signature')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required webhook headers');
    });

    it('should reject webhook with missing signature', async () => {
      const response = await request(app)
        .post('/webhook')
        .set('x-github-event', 'push')
        .set('x-github-delivery', 'test-delivery-id')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required webhook headers');
    });
  });
});