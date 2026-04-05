const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
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
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'moderator'],
      default: 'admin'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    refreshTokenVersion: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

adminUserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

adminUserSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 12);
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
