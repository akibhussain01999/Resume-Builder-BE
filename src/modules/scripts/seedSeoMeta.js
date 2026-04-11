const mongoose = require('mongoose');
const SeoMeta = require('../modules/seo/seoMetaModel');
require('dotenv').config();

// Default SEO meta data for all page types
const defaultSeoMetas = [
  {
    pageType: 'company_layout',
    title: 'Top Health Insurance Companies Reviews | Review Window',
    description: 'Review Window helps you compare India\'s top health insurance companies. Read genuine reviews of HDFC Ergo, Niva Bupa, Star Health, ICICI & more.',
    keywords: ['health insurance', 'insurance reviews', 'company ratings', 'India insurance'],
    ogTitle: '{{pageCategory}} Companies - Ratings & Reviews | Review Window',
    ogDescription: 'Compare {{totalCompanies}} {{pageCategory}} companies. {{totalReviews}}+ verified reviews. Find top-rated providers.',
    ogImage: 'https://reviewwindow.in/images/og-company-layout.jpg',
    twitterTitle: '{{pageCategory}} Companies - Ratings & Reviews',
    twitterDescription: 'Browse {{totalCompanies}} {{pageCategory}} companies with {{totalReviews}}+ reviews',
    canonical: 'https://reviewwindow.in/companies/{{category}}',
    dynamicFields: ['pageCategory', 'totalCompanies', 'totalReviews', 'category'],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: '{{pageCategory}} Companies Reviews',
      description: 'Compare and review {{pageCategory}} companies in India'
    }
  },
  {
    pageType: 'landing_page',
    title: 'Best Health Insurance Reviews India | Compare Top Plans | Review Window',
    description: 'Review Window is India\'s most trusted health insurance review platform. Compare 50+ companies, read genuine customer reviews, and find the best health insurance in India.',
    keywords: ['health insurance reviews', 'insurance comparison India', 'best health insurance', 'customer reviews', 'insurance ratings'],
    ogTitle: 'Best Health Insurance Reviews India | Compare Top Plans | Review Window',
    ogDescription: 'Review Window is India\'s most trusted health insurance review platform. Compare 50+ companies, read genuine customer reviews, and find the best health insurance in India.',
    ogImage: 'https://reviewwindow.com/og-image.jpg',
    twitterTitle: 'Best Health Insurance Reviews India | Compare Top Plans | Review Window',
    twitterDescription: 'Review Window is India\'s most trusted health insurance review platform. Compare 50+ companies, read genuine customer reviews, and find the best health insurance in India.',
    twitterImage: 'https://reviewwindow.com/og-image.jpg',
    canonical: 'https://reviewwindow.com',
    structuredData: {
      website: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Review Window',
        url: 'https://reviewwindow.com',
        description: 'India\'s most trusted health insurance review platform'
      },
      organization: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Review Window',
        url: 'https://reviewwindow.com',
        logo: 'https://reviewwindow.com/logo.png',
        description: 'India\'s trusted platform for insurance company reviews and comparisons',
        sameAs: [
          'https://twitter.com/ReviewWindow',
          'https://www.facebook.com/ReviewWindow'
        ]
      },
      faq: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: []
      }
    }
  },
  {
    pageType: 'compare_company',
    title: 'Compare {{company1}} vs {{company2}} | Review Window',
    description: 'Compare {{company1}} and {{company2}} side by side. See detailed ratings, reviews, plans, and customer feedback to choose the best insurance provider.',
    keywords: ['insurance comparison', 'company comparison', 'insurance reviews'],
    ogTitle: '{{company1}} vs {{company2}} - Detailed Comparison',
    ogDescription: 'Compare {{company1}} and {{company2}} ratings, reviews, and plans. Make an informed decision with verified customer feedback.',
    ogImage: 'https://reviewwindow.in/images/og-compare.jpg',
    canonical: 'https://reviewwindow.in/compare/{{slug1}}-vs-{{slug2}}',
    dynamicFields: ['company1', 'company2', 'slug1', 'slug2'],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'ComparisonPage',
      name: '{{company1}} vs {{company2}} Comparison',
      description: 'Detailed comparison between {{company1}} and {{company2}}'
    }
  },
  {
    pageType: 'contest',
    title: 'Insurance Contests & Giveaways | Review Window',
    description: 'Participate in exciting insurance contests and giveaways. Win prizes while learning about insurance. Join Review Window community contests today.',
    keywords: ['insurance contests', 'giveaways', 'insurance prizes', 'community events'],
    ogTitle: 'Win Exciting Prizes - Insurance Contests',
    ogDescription: 'Join our insurance contests and win amazing prizes. Participate now on Review Window.',
    ogImage: 'https://reviewwindow.in/images/og-contest.jpg',
    canonical: 'https://reviewwindow.in/contests',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Review Window Contests',
      description: 'Insurance-related contests and giveaways'
    }
  },
  {
    pageType: 'blog_category',
    title: '{{categoryName}} Articles & Guides | Review Window Blog',
    description: 'Expert articles and guides about {{categoryName}}. Stay informed with latest insurance news, tips, and comprehensive guides from Review Window.',
    keywords: ['insurance blog', 'insurance guides', 'insurance tips'],
    ogTitle: '{{categoryName}} - Insurance Articles & Expert Guides',
    ogDescription: 'Read expert articles about {{categoryName}}. {{articleCount}}+ helpful guides and tips.',
    ogImage: 'https://reviewwindow.in/images/og-blog.jpg',
    canonical: 'https://reviewwindow.in/blog/category/{{categorySlug}}',
    dynamicFields: ['categoryName', 'categorySlug', 'articleCount'],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '{{categoryName}} Articles',
      description: 'Collection of articles about {{categoryName}}'
    }
  },
  {
    pageType: 'blog_list',
    title: 'Insurance Blog - Expert Tips & Guides | Review Window',
    description: 'Read expert insurance articles, tips, and comprehensive guides. Stay updated with latest insurance trends, policy reviews, and claim assistance.',
    keywords: ['insurance blog', 'insurance articles', 'insurance guides', 'insurance tips'],
    ogTitle: 'Review Window Blog - Insurance Tips & Expert Guides',
    ogDescription: 'Expert insights on insurance policies, claims, and industry trends. {{totalBlogs}}+ articles to help you.',
    ogImage: 'https://reviewwindow.in/images/og-blog-list.jpg',
    canonical: 'https://reviewwindow.in/blog',
    dynamicFields: ['totalBlogs'],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Review Window Blog',
      description: 'Expert insurance articles and guides'
    }
  },
  {
    pageType: 'community',
    title: 'Insurance Community - Share & Learn | Review Window',
    description: 'Join India\'s largest insurance community. Share experiences, ask questions, get expert advice, and help others make better insurance decisions.',
    keywords: ['insurance community', 'insurance forum', 'insurance discussion', 'insurance help'],
    ogTitle: 'Review Window Community - Connect & Share',
    ogDescription: 'Join {{memberCount}}+ members discussing insurance. Share experiences and get expert advice.',
    ogImage: 'https://reviewwindow.in/images/og-community.jpg',
    canonical: 'https://reviewwindow.in/community',
    dynamicFields: ['memberCount'],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'DiscussionForumPosting',
      name: 'Review Window Community',
      description: 'Insurance community discussions and support'
    }
  },
  {
    pageType: 'write_review',
    title: 'Write a Review - Share Your Insurance Experience | Review Window',
    description: 'Share your insurance experience and help others make informed decisions. Write a detailed review of your insurance company and service.',
    keywords: ['write review', 'insurance review', 'customer feedback', 'rate insurance'],
    ogTitle: 'Share Your Insurance Experience - Write Review',
    ogDescription: 'Help others by sharing your insurance company experience. Your review matters.',
    ogImage: 'https://reviewwindow.in/images/og-write-review.jpg',
    canonical: 'https://reviewwindow.in/write-review',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'ReviewAction',
      name: 'Write Insurance Review',
      description: 'Submit your insurance company review'
    }
  }
];

async function seedSeoMeta() {
  try {
    // Connect to MongoDB
    const dbUri = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/insurance-door';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB');
    console.log(`📍 Database: ${dbUri.split('@')[1] || dbUri}`);

    // Clear existing SEO meta data
    const deleteResult = await SeoMeta.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing SEO meta records`);

    // Insert default SEO meta data
    const result = await SeoMeta.insertMany(defaultSeoMetas);
    console.log(`✅ Successfully seeded ${result.length} SEO meta records`);

    // Display seeded data
    console.log('\n📋 Seeded Page Types:');
    result.forEach((meta, index) => {
      console.log(`${index + 1}. ${meta.pageType} - "${meta.title}"`);
    });

    console.log('\n✨ SEO Meta seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding SEO meta data:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
  }
}

// Run the seed function
if (require.main === module) {
  seedSeoMeta()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedSeoMeta, defaultSeoMetas };
