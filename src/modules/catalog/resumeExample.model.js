const mongoose = require('mongoose');

const resumeExampleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    role: { type: String, default: '', index: true },
    label: { type: String, default: '', index: true },
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResumeExample', resumeExampleSchema);
