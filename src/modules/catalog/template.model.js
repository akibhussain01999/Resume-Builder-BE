const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, enum: ['resume', 'cover-letter'] },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    previewUrl: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Template', templateSchema);
