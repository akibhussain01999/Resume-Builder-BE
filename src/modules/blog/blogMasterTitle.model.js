const mongoose = require('mongoose');

const blogMasterTitleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['resume-tips', 'career-advice', 'job-search-tips', 'cover-letter-tips', 'interview-tips', 'linkedin-tips', 'salary-negotiation'],
    default: 'resume-tips'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'failed'],
    default: 'pending'
  },
  priority: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

blogMasterTitleSchema.index({ status: 1 });
blogMasterTitleSchema.index({ priority: -1, createdAt: 1 });

const BlogMasterTitle = mongoose.model('BlogMasterTitle', blogMasterTitleSchema);

module.exports = BlogMasterTitle;
