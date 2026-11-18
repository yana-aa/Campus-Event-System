import type { Request, Response } from 'express';
import type { IAuthService } from '../interfaces';
import { requireAuth } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { parseOrThrow } from '../utils/validation';
import { loginSchema, registerSchema } from '../validators';

export class AuthController {
  constructor(private readonly auth: IAuthService) {}

  register = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(registerSchema, req.body);
    res.status(201).json(await this.auth.register(input));
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = parseOrThrow(loginSchema, req.body);
    res.status(200).json(await this.auth.login(email, password));
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ user: await this.auth.getProfile(requireAuth(req).userId) });
  });
}
