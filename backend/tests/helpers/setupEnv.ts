// Runs in every Jest worker before any module is loaded.
// Values set here take precedence over .env (dotenv never overrides).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-jwt-secret-value-that-is-long-enough';
process.env.JWT_EXPIRES_IN = '1h';
process.env.QR_HMAC_SECRET = 'test-qr-hmac-secret-value-long-enough';
process.env.BCRYPT_SALT_ROUNDS = '4';
