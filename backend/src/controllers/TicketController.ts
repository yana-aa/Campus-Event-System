import type { Request, Response } from 'express';
import type { IQRCodeService } from '../interfaces';
import { requireAuth } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { parseOrThrow } from '../utils/validation';
import { validateTicketSchema } from '../validators';

export class TicketController {
  constructor(private readonly qr: IQRCodeService) {}

  validate = asyncHandler(async (req: Request, res: Response) => {
    const { eventId, qrPayload, bookingCode } = parseOrThrow(validateTicketSchema, req.body);
    const actor = requireAuth(req);
    const result = qrPayload
      ? await this.qr.validateAtDoor(actor, eventId, qrPayload)
      : await this.qr.validateByCode(actor, eventId, bookingCode as string);
    res.status(200).json({ valid: true, ticket: result });
  });
}
