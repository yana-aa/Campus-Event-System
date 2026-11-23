import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
}

function intFrom(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return parsed;
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
  qrHmacSecret: string;
  corsOrigin: string;
  authRateLimitMax: number;
}

export const config: AppConfig = Object.freeze({
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: intFrom('PORT', 5000),
  databaseUrl: required('DATABASE_URL', 'file:./dev.db'),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-jwt-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  bcryptSaltRounds: intFrom('BCRYPT_SALT_ROUNDS', 10),
  qrHmacSecret: required('QR_HMAC_SECRET', 'dev-only-insecure-qr-secret-change-me'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  authRateLimitMax: intFrom('AUTH_RATE_LIMIT_MAX', 100),
});
