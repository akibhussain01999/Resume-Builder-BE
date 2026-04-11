const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['resume-tips', 'career-advice', 'job-search-tips', 'cover-letter-tips', 'interview-tips', 'linkedin-tips', 'salary-negotiation'],
    default: 'resume-tips'
  },
  tags: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  coverImage: {
    type: String,
    default: ''
  },
  coverImageAlt: {
    type: String,
    default: ''
  },

  // SEO Fields
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  seoKeywords: { type: String, default: '' },

  // Primary Meta Tags
  metaTitle: { type: String, default: '' },
  metaDescription: { type: String, default: '' },
  metaAuthor: { type: String, default: 'ResumeAI' },
  metaKeywords: { type: [String], default: [] },
  metaViewport: { type: String, default: 'width=device-width, initial-scale=1' },

  // Open Graph
  ogType: { type: String, default: 'article' },
  ogTitle: { type: String, default: '' },
  ogDescription: { type: String, default: '' },
  ogImage: { type: String, default: '' },
  ogImageWidth: { type: String, default: '1200' },
  ogImageHeight: { type: String, default: '630' },
  ogSiteName: { type: String, default: 'ResumeAI' },
  ogLocale: { type: String, default: 'en_US' },
  ogUrl: { type: String, default: '' },
  articlePublished_time: { type: Date },
  articleModified_time: { type: Date },
  articleSection: { type: String, default: 'Career & Resume' },
  articleAuthor: { type: String, default: 'ResumeAI' },
  articleTag: { type: [String], default: [] },

  // Twitter Meta
  twitterCard: { type: String, default: 'summary_large_image' },
  twitterTitle: { type: String, default: '' },
  twitterDescription: { type: String, default: '' },
  twitterImage: { type: String, default: '' },
  twitterSite: { type: String, default: '' },
  twitterCreator: { type: String, default: '' },
  twitterUrl: { type: String, default: '' },

  // Technical SEO
  robots: { type: String, default: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
  canonical: { type: String, default: '' },

  // Structured Data (FAQ Schema etc.)
  structuredData: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Alternate hreflang
  alternateHreflang: { type: [Object], default: [] },

  // Reading metrics
  readingTime: { type: Number, default: 0 },
  wordCount: { type: Number, default: 0 },

  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  createdBy: { type: String, default: 'auto-blog-system' },
  updatedBy: { type: String, default: 'auto-blog-system' }
}, {
  timestamps: true
});

blogPostSchema.index({ slug: 1 });
blogPostSchema.index({ status: 1 });
blogPostSchema.index({ category: 1 });
blogPostSchema.index({ isFeatured: 1 });
blogPostSchema.index({ createdAt: -1 });

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

module.exports = BlogPost;
