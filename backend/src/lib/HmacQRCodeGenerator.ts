import { createHmac, timingSafeEqual } from 'crypto';
import type { IQRCodeGenerator, TicketClaims } from '../interfaces';

const VERSION = 'CP1';

/**
 * Payload format: `CP1.<base64url(JSON claims)>.<base64url(HMAC-SHA256)>`.
 * The signature covers the version and body so neither can be swapped.
 */
export class HmacQRCodeGenerator implements IQRCodeGenerator {
  constructor(private readonly secret: string) {
    if (!secret || secret.length < 16) {
      throw new Error('QR HMAC secret must be at least 16 characters');
    }
  }

  generate(claims: TicketClaims): string {
    const body = Buffer.from(
      JSON.stringify({ b: claims.bookingCode, e: claims.eventId, u: claims.userId }),
      'utf8',
    ).toString('base64url');
    return `${VERSION}.${body}.${this.sign(`${VERSION}.${body}`)}`;
  }

  verify(payload: string): TicketClaims | null {
    if (typeof payload !== 'string') return null;
    const parts = payload.split('.');
    if (parts.length !== 3 || parts[0] !== VERSION) return null;
    const [version, body, signature] = parts;

    const expected = Buffer.from(this.sign(`${version}.${body}`), 'utf8');
    const provided = Buffer.from(signature, 'utf8');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return null;
    }

    try {
      const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
      if (typeof decoded.b !== 'string' || typeof decoded.e !== 'string' || typeof decoded.u !== 'string') {
        return null;
      }
      return { bookingCode: decoded.b, eventId: decoded.e, userId: decoded.u };
    } catch {
      return null;
    }
  }

  private sign(data: string): string {
    return createHmac('sha256', this.secret).update(data).digest('base64url');
  }
}
