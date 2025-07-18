import crypto from 'crypto';

export class SignatureValidator {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  validateSignature(payload: string, signature: string): boolean {
    if (!signature) {
      return false;
    }

    const cleanSignature = signature.replace('sha256=', '');

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload, 'utf8')
      .digest('hex');

    const signatureBuffer = Buffer.from(cleanSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  }

  generateSignature(payload: string): string {
    return crypto.createHmac('sha256', this.secret).update(payload, 'utf8').digest('hex');
  }
}
