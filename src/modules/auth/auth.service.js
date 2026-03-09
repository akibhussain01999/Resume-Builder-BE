const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const User = require('../user/user.model');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');
const { signAccessToken, signRefreshToken } = require('../../utils/jwt');
const { sendEmailVerificationOtpEmail } = require('../../utils/mailService');

const EMAIL_VERIFICATION_OTP_TTL_MS = 1000 * 60 * 5;

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

module.exports = {
  register,
  login,
  me,
  logout,
  verifyEmail
};
