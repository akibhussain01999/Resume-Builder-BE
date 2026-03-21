const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const https = require('https');
const User = require('../user/user.model');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { sendEmailVerificationOtpEmail } = require('../../utils/mailService');

const EMAIL_VERIFICATION_OTP_TTL_MS = 1000 * 60 * 5;
const GOOGLE_TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  isEmailVerified: user.isEmailVerified,
  emailVerifiedAt: user.emailVerifiedAt,
  marketingOptIn: user.marketingOptIn,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const createEmailVerificationOtp = () => String(crypto.randomInt(100000, 1000000));
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const createTokens = (user) => {
  const payload = {
    sub: String(user._id),
    email: user.email,
    tokenVersion: user.refreshTokenVersion
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  };
};

const httpsGetJson = (url, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (error) {
            return reject(new Error('Invalid JSON response from provider'));
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            return resolve(parsed);
          }

          return reject(
            new Error(
              `Provider request failed with status ${res.statusCode}: ${
                parsed.error_description || parsed.error || 'Unknown error'
              }`
            )
          );
        });
      }
    );

    req.on('error', reject);
  });

const throwInvalidGoogleToken = () => {
  throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_GOOGLE_TOKEN', 'Invalid Google token');
};

const verifyGoogleAccessToken = async (accessToken) => {
  try {
    const tokenInfo = await httpsGetJson(
      `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`
    );

    if (env.googleClientId && tokenInfo.aud !== env.googleClientId) {
      throwInvalidGoogleToken();
    }

    const userInfo = await httpsGetJson(GOOGLE_USERINFO_URL, {
      Authorization: `Bearer ${accessToken}`
    });

    const email = userInfo.email ? String(userInfo.email).toLowerCase().trim() : '';
    if (!email) {
      throwInvalidGoogleToken();
    }

    if (tokenInfo.email && String(tokenInfo.email).toLowerCase() !== email) {
      throwInvalidGoogleToken();
    }

    const name = (userInfo.name || '').trim() || email.split('@')[0];
    return { email, name };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throwInvalidGoogleToken();
  }
};

const register = async (payload) => {
  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'EMAIL_EXISTS', 'Email already registered');
  }

  const verificationOtp = createEmailVerificationOtp();
  const verificationOtpHash = hashOtp(verificationOtp);
  const verificationOtpExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_OTP_TTL_MS);

  const passwordHash = await User.hashPassword(payload.password);
  const user = await User.create({
    name: payload.name,
    email: payload.email,
    passwordHash,
    marketingOptIn: payload.marketingOptIn || false,
    emailVerificationTokenHash: verificationOtpHash,
    emailVerificationTokenExpiresAt: verificationOtpExpiresAt
  });

  try {
    await sendEmailVerificationOtpEmail({
      toEmail: user.email,
      name: user.name,
      otp: verificationOtp
    });
  } catch (error) {
    if (env.allowDevEmailOtpFallback) {
      return {
        user: sanitizeUser(user),
        verificationRequired: true,
        otpSent: false,
        devOtp: verificationOtp,
        warning: error.message || 'Email provider blocked'
      };
    }

    await User.deleteOne({ _id: user._id });
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'EMAIL_SEND_FAILED',
      'Could not send verification email. Please try again.',
      [error.message || 'Email provider error']
    );
  }

  return {
    user: sanitizeUser(user),
    verificationRequired: true,
    otpSent: true
  };
};

const login = async (payload) => {
  const user = await User.findOne({ email: payload.email });
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  const isMatch = await user.comparePassword(payload.password);
  if (!isMatch) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  if (!user.isEmailVerified) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email before logging in'
    );
  }

  return {
    user: sanitizeUser(user),
    tokens: createTokens(user)
  };
};

const googleLogin = async ({ token }) => {
  const profile = await verifyGoogleAccessToken(token);

  let user = await User.findOne({ email: profile.email });

  if (!user) {
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await User.hashPassword(randomPassword);

    user = await User.create({
      name: profile.name,
      email: profile.email,
      passwordHash,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      marketingOptIn: false
    });
  } else if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationTokenExpiresAt = null;
    await user.save();
  }

  return {
    user: sanitizeUser(user),
    tokens: createTokens(user)
  };
};

const me = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }

  return sanitizeUser(user);
};

const verifyEmail = async ({ email, otp }) => {
  const otpHash = hashOtp(otp);

  const user = await User.findOne({
    email: email.toLowerCase(),
    emailVerificationTokenHash: otpHash,
    emailVerificationTokenExpiresAt: { $gt: new Date() }
  });

  if (!user) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'INVALID_OR_EXPIRED_TOKEN',
      'Invalid or expired OTP'
    );
  }

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationTokenHash = null;
  user.emailVerificationTokenExpiresAt = null;
  await user.save();

  return {
    user: sanitizeUser(user),
    tokens: createTokens(user)
  };
};

const logout = async () => ({ ok: true });

const refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'MISSING_REFRESH_TOKEN', 'Refresh token is required');
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  if (payload.tokenVersion !== user.refreshTokenVersion) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'REFRESH_TOKEN_REVOKED', 'Refresh token has been revoked');
  }

  return { tokens: createTokens(user) };
};

module.exports = {
  register,
  login,
  googleLogin,
  me,
  logout,
  verifyEmail,
  refresh
};
