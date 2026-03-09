const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    marketingOptIn: {
      type: Boolean,
      default: false
    },
    refreshTokenVersion: {
      type: Number,
      default: 0
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    },
    emailVerificationTokenHash: {
      type: String,
      default: null,
      index: true
    },
    emailVerificationTokenExpiresAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 12);
};

module.exports = mongoose.model('User', userSchema);
