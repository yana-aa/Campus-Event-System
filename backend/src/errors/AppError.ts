/**
 * Domain error hierarchy. Services throw these; the centralized error
 * handler maps them to HTTP responses. Nothing below the controller layer
 * knows about Express.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class AccountSuspendedError extends AppError {
  constructor() {
    super('This account has been suspended. Contact the campus events office.', 403, 'ACCOUNT_SUSPENDED');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT', details?: unknown) {
    super(message, 409, code, details);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION', details?: unknown) {
    super(message, 422, code, details);
  }
}

export class VenueCapacityExceededError extends BusinessRuleError {
  constructor(requested: number, venueCapacity: number) {
    super(
      `Event capacity (${requested}) exceeds venue capacity (${venueCapacity})`,
      'VENUE_CAPACITY_EXCEEDED',
      { requested, venueCapacity },
    );
  }
}

export class VenueClashError extends ConflictError {
  constructor(clashingEventIds: string[]) {
    super('The venue is already booked for an overlapping time slot', 'VENUE_CLASH', { clashingEventIds });
  }
}

export class TicketLimitExceededError extends BusinessRuleError {
  constructor(limit: number, alreadyHeld: number) {
    super(
      `Students may hold at most ${limit} tickets per event (you already hold ${alreadyHeld})`,
      'TICKET_LIMIT_EXCEEDED',
      { limit, alreadyHeld },
    );
  }
}

export class InvalidTicketError extends AppError {
  constructor(message = 'Invalid or tampered ticket') {
    super(message, 400, 'INVALID_TICKET');
  }
}

export class TicketAlreadyUsedError extends ConflictError {
  constructor(checkedInAt?: Date | null) {
    super('Ticket has already been scanned', 'TICKET_ALREADY_USED', {
      checkedInAt: checkedInAt ? checkedInAt.toISOString() : null,
    });
  }
}
