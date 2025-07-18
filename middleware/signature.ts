import { Request, Response, NextFunction } from 'express';
import { SignatureValidator } from '../utils/signature';
import { getLogger } from '../utils/logger';

export interface SignatureRequest extends Request {
  rawBody?: string;
}

export function rawBodyMiddleware(req: SignatureRequest, _: Response, next: NextFunction): void {
  let rawBody = '';

  req.on('data', (chunk) => {
    rawBody += chunk.toString();
  });

  req.on('end', () => {
    req.rawBody = rawBody;

    if (rawBody.startsWith('payload=')) {
      try {
        const encodedPayload = rawBody.substring(8); // Remove 'payload='
        const decodedPayload = decodeURIComponent(encodedPayload);
        const parsedPayload = JSON.parse(decodedPayload);

        req.body = parsedPayload;
      } catch (error) {
        console.error('❌ Failed to parse form-encoded payload:', error);
      }
    }

    next();
  });
}

export function createSignatureMiddleware(webhookSecret: string) {
  const signatureValidator = new SignatureValidator(webhookSecret);

  return (req: SignatureRequest, res: Response, next: NextFunction): void => {
    const logger = getLogger();
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = req.rawBody || '';

    if (!webhookSecret) {
      logger.warn('Webhook secret not configured - signature validation disabled');
      return next();
    }

    if (!signature) {
      logger.warn('Missing signature header in webhook request');
      res.status(401).json({ error: 'Missing signature header' });
      return;
    }

    if (!signatureValidator.validateSignature(rawBody, signature)) {
      logger.warn('Invalid webhook signature', {
        signature: signature.substring(0, 16) + '...',
        bodyLength: rawBody.length,
      });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    logger.debug('Webhook signature validation successful');
    next();
  };
}
