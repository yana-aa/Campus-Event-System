import type { Request, Response } from 'express';
import type { IBookingService } from '../interfaces';
import { requireAuth } from '../middlewares/authenticate';
import { BookingStatus } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parseOrThrow } from '../utils/validation';
import { createBookingSchema, idParamSchema } from '../validators';

export class BookingController {
  constructor(private readonly bookings: IBookingService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createBookingSchema, req.body);
    const booking = await this.bookings.book(requireAuth(req).userId, input);
    const waitlisted = booking.status === BookingStatus.WAITLISTED;
    res.status(waitlisted ? 202 : 201).json({
      booking,
      message: waitlisted
        ? 'The event is full. You have been added to the waitlist.'
        : 'Booking confirmed. Present your QR code at the door.',
    });
  });

  listMine = asyncHandler(async (req: Request, res: Response) => {
    const bookings = await this.bookings.listForUser(requireAuth(req).userId);
    res.status(200).json({ count: bookings.length, bookings });
  });

  cancel = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    res.status(200).json(await this.bookings.cancel(requireAuth(req), id));
  });
}
