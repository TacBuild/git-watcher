import { Request, Response, NextFunction } from 'express';

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
