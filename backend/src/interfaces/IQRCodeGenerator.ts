/** Claims embedded in (and signed into) a ticket QR payload. */
export interface TicketClaims {
  bookingCode: string;
  eventId: string;
  userId: string;
}

export interface IQRCodeGenerator {
  /** Produce a tamper-evident payload string to encode in the QR image. */
  generate(claims: TicketClaims): string;
  /** Return the claims when the signature is valid, otherwise null. */
  verify(payload: string): TicketClaims | null;
}
