const dotenv = require('dotenv');

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  clientUrl: process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:3000',
  brevoApiKey: process.env.BREVO_API_KEY || process.env.BREAVE_MAILER_KEY || '',
  senderEmail: process.env.SENDER_EMAIL || 'noreply@example.com',
  senderName: process.env.SENDER_NAME || 'Resume Builder',
  googleClientId:
    process.env.GOOGLE_CLIENT_ID ||
    '1037774959324-leq8o6uai03rfhnrmmb6o957r0lr9n0t.apps.googleusercontent.com',
  allowDevEmailOtpFallback:
    process.env.ALLOW_DEV_EMAIL_OTP_FALLBACK === 'true' || nodeEnv !== 'production',
  adminSeedKey: process.env.ADMIN_SEED_KEY || ''
};

module.exports = env;
