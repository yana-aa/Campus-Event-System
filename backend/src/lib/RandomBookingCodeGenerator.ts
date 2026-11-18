import { randomInt } from 'crypto';
import type { IBookingCodeGenerator } from '../interfaces';

// Excludes ambiguous characters (0/O, 1/I/L) for readability at the door.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class RandomBookingCodeGenerator implements IBookingCodeGenerator {
  generate(): string {
    let block = '';
    for (let i = 0; i < 4; i += 1) {
      block += ALPHABET[randomInt(ALPHABET.length)];
    }
    const digits = randomInt(0, 10_000).toString().padStart(4, '0');
    return `CP-${block}-${digits}`;
  }
}
