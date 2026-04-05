const mongoose = require('mongoose');

const seoMetaSchema = new mongoose.Schema({
  pageType: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'landing_page', 
      'template_page',
      'cover_page',
      'ats_page',
      'blog_page',

    ]
  },
  
  // Primary Meta Tags
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  author: {
    type: String,
    default: 'Review Window'
  },
  keywords: {
    type: [String],
    default: []
  },
  
  // Open Graph Meta Tags
  ogType: {
    type: String,
    default: 'website'
  },
  ogTitle: {
    type: String
  },
  ogDescription: {
    type: String
  },
  ogImage: {
    type: String,
    default: ''
  },
  ogImageWidth: {
    type: String,
    default: '1200'
  },
  ogImageHeight: {
    type: String,
    default: '630'
  },
  ogSiteName: {
    type: String,
    default: 'Review Window'
  },
  ogLocale: {
    type: String,
    default: 'en_IN'
  },
 ogUrl: String,

 twitterUrl: String,

 viewport: {
  type: String,
  default: 'width=device-width, initial-scale=1'
},
themeColor: {
  type: String,
  default: '#ffffff'
},
charset: {
  type: String,
  default: 'UTF-8'
},
alternateHreflang: {
  type: [Object], // { lang: 'en-IN', url: 'https://...' }
  default: []
},
pagination: {
  prev: { type: String, default: '' },
  next: { type: String, default: '' }
},
noIndexReason: {
  type: String,
  default: ''
},
structuredDataType: {
  type: String,
  default: ''
},
favicon: {
  type: String,
  default: '/favicon.ico'
},
  
// Twitter Meta Tags
  twitterCard: {
    type: String,
    default: 'summary_large_image'
  },
  twitterTitle: {
    type: String
  },
  twitterDescription: {
    type: String
  },
  twitterImage: {
    type: String,
    default: ''
  },
  twitterSite: {
    type: String,
    default: '@ReviewWindow'
  },
  twitterCreator: {
    type: String,
    default: '@ReviewWindow'
  },
  
  // Additional SEO Settings
  robots: {
    type: String,
    default: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  },
  canonical: {
    type: String,
    default: ''
  },
  
  // Structured Data Templates
  structuredData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Dynamic Field Support (for templates with variables)
  dynamicFields: {
    type: [String],
    default: []
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  createdBy: {
    type: String,
    default: 'system'
  },
  updatedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

// Indexes
seoMetaSchema.index({ pageType: 1 });
seoMetaSchema.index({ isActive: 1 });

// Methods
seoMetaSchema.methods.renderMetaTags = function(dynamicValues = {}) {
  const meta = this.toObject();
  
  // Replace dynamic placeholders with actual values
  const replacePlaceholders = (text) => {
    if (!text) return text;
    let result = text;
    Object.keys(dynamicValues).forEach(key => {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), dynamicValues[key] || '');
    });
    return result;
  };
  
  return {
    title: replacePlaceholders(meta.title),
    description: replacePlaceholders(meta.description),
    author: meta.author,
    keywords: meta.keywords,
    canonical: replacePlaceholders(meta.canonical),
    ogType: meta.ogType,
    ogTitle: replacePlaceholders(meta.ogTitle || meta.title),
    ogDescription: replacePlaceholders(meta.ogDescription || meta.description),
    ogImage: replacePlaceholders(meta.ogImage),
    ogImageWidth: meta.ogImageWidth,
    ogImageHeight: meta.ogImageHeight,
    ogSiteName: meta.ogSiteName,
    ogLocale: meta.ogLocale,
    twitterCard: meta.twitterCard,
    twitterTitle: replacePlaceholders(meta.twitterTitle || meta.title),
    twitterDescription: replacePlaceholders(meta.twitterDescription || meta.description),
    twitterImage: replacePlaceholders(meta.twitterImage || meta.ogImage),
    twitterSite: meta.twitterSite,
    twitterCreator: meta.twitterCreator,
    robots: meta.robots,
    structuredData: meta.structuredData
  };
};

const SeoMeta = mongoose.model('SeoMeta', seoMetaSchema);

module.exports = SeoMeta;
