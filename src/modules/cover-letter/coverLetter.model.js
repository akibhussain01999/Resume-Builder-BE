const mongoose = require('mongoose');
const { generatePublicId } = require('../../utils/id');

const coverLetterSchema = new mongoose.Schema(
  {
    coverLetterId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => generatePublicId('cl')
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140
    },
    templateId: {
      type: String,
      required: true,
      trim: true
    },
    themeColor: {
      type: String,
      default: '#1e3a5f'
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CoverLetter', coverLetterSchema);
