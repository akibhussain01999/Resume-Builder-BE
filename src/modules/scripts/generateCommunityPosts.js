const mongoose = require('mongoose');
const User = require('../modules/user/userModel');
const InsuranceCompany = require('../modules/insuranceCompanies/InsuranceCompanyModel');
const CommunityPost = require('../modules/community/communityModel');
const { format, subDays, subMonths, differenceInDays } = require('date-fns');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://akib:akibStrong_2025@157.173.218.33:27017/insurance-door?authSource=admin', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Generate slug from text
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// Templates for SEO-friendly insurance questions
const questionTemplates = [
  "Is {company} a good company for health insurance?",
  "How does {company}'s claim settlement process work?",
  "What are the best plans offered by {company} for family health coverage?",
  "Should I choose {company} for term life insurance?",
  "Has anyone had experience with {company}'s customer service?",
  "How does {company} compare to other insurers for car insurance?",
  "What are the pros and cons of {company}'s home insurance policies?",
  "Is {company}'s premium worth the coverage they provide?",
  "How easy is it to file a claim with {company}?",
  "What's your experience with {company}'s {product} insurance plan?",
  "Does {company} offer good coverage for senior citizens?",
  "Is {company}'s critical illness cover comprehensive enough?",
  "How are the network hospitals covered by {company} health insurance?",
  "What are the hidden charges in {company}'s insurance policies?",
  "Has anyone successfully negotiated better premiums with {company}?"
];

// Templates for comments
const commentTemplates = [
  "Based on my experience, {company} has a {rating}/10 claim settlement process.",
  "I've been with {company} for {years} years and their customer service is {quality}.",
  "I compared {company} with other insurers and found them to be {comparison} in terms of premiums.",
  "The network hospitals of {company} in {city} are quite {hospital_quality}.",
  "One thing to note about {company} is their {feature} which is {opinion}.",
  "My family has been covered by {company} for years, and we find their {aspect} to be {assessment}.",
  "I recently switched to {company} from another insurer because of their {reason}.",
  "When I filed a claim with {company}, the process was {process_quality} and took {duration}.",
  "The premium for {company}'s {product} plan might seem high, but the coverage is {coverage_quality}.",
  "What stands out about {company} is their {standout_feature}, which is uncommon in other insurers."
];

// Templates for replies to comments
const replyTemplates = [
  "I agree with you about {company}'s {aspect}. My experience was similar.",
  "That's interesting, but have you considered their {alternative_aspect}?",
  "Thanks for sharing! Did you also check their {related_aspect}?",
  "I had a different experience with {company}. Their {aspect} was actually {contrary_opinion}.",
  "Good point about {company}'s {aspect}. I'd also add that their {additional_aspect} is worth noting.",
  "How long ago was your experience with {company}? They've changed their {changed_aspect} recently.",
  "Did you try negotiating with {company} on the {negotiable_aspect}?",
  "Have you compared {company} with {competitor} on this specific {comparison_point}?",
  "That's helpful information. I'm considering switching to {company} because of their {feature}.",
  "Did you use their mobile app or website for {action}? Which one was better?"
];

// Variable terms to fill in templates
const variables = {
  rating: ['excellent', 'good', 'average', 'poor', 'outstanding', 'disappointing', 'satisfactory', 'superior'],
  years: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15],
  quality: ['excellent', 'good', 'average', 'poor', 'top-notch', 'subpar', 'mediocre', 'exceptional', 'reliable', 'inconsistent'],
  comparison: ['more expensive', 'more affordable', 'comparable', 'better value', 'overpriced', 'competitively priced'],
  city: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'],
  hospital_quality: ['extensive', 'limited', 'well-distributed', 'inadequate', 'comprehensive', 'convenient'],
  feature: ['claim process', 'premium calculation', 'customer support', 'policy flexibility', 'renewal process', 'coverage options', 'riders'],
  opinion: ['excellent', 'problematic', 'straightforward', 'confusing', 'innovative', 'outdated', 'industry-leading'],
  aspect: ['coverage', 'premiums', 'claim settlement', 'customer service', 'documentation', 'transparency', 'rider options', 'network hospitals'],
  assessment: ['excellent', 'good', 'average', 'below average', 'outstanding', 'disappointing', 'worth the cost', 'not worth the premium'],
  reason: ['competitive premiums', 'better coverage', 'superior customer service', 'easier claim process', 'better online experience', 'more flexible policies'],
  process_quality: ['smooth', 'complicated', 'straightforward', 'frustrating', 'surprisingly easy', 'unnecessarily complex'],
  duration: ['just a few days', 'about a week', 'nearly two weeks', 'almost a month', 'several weeks', 'less than 3 days'],
  coverage_quality: ['comprehensive', 'worth it', 'inadequate', 'excellent', 'standard', 'better than most', 'disappointing'],
  standout_feature: ['no-claim bonus structure', 'cashless hospital network', 'customer service', 'easy digital process', 'flexible payment options', 'additional coverage benefits', 'senior citizen benefits'],
  alternative_aspect: ['premium structures', 'claim rejection rate', 'coverage for pre-existing conditions', 'waiting period', 'policy renewal terms', 'co-payment requirements'],
  related_aspect: ['family floater options', 'senior citizen discounts', 'complementary health check-ups', 'wellness benefits', 'telemedicine coverage', 'OPD coverage'],
  contrary_opinion: ['much better', 'quite disappointing', 'more complicated', 'more straightforward', 'more expensive', 'more affordable'],
  additional_aspect: ['renewal terms', 'co-payment structure', 'sub-limits', 'waiting period for specific diseases', 'claim process efficiency'],
  changed_aspect: ['claim process', 'premium structure', 'coverage options', 'network hospital list', 'customer service approach', 'digital experience'],
  negotiable_aspect: ['premium', 'coverage limits', 'add-on benefits', 'waiting period', 'co-payment terms'],
  competitor: ['ICICI Lombard', 'Bajaj Allianz', 'HDFC ERGO', 'Star Health', 'Max Bupa', 'Aditya Birla Health', 'Religare Health'],
  comparison_point: ['claim settlement ratio', 'premium structure', 'coverage for specific conditions', 'network hospitals', 'customer service response time'],
  feature: ['cashless claims', 'wider hospital network', 'no room rent capping', 'lower waiting period', 'better coverage for critical illnesses'],
  action: ['filing a claim', 'policy renewal', 'updating personal details', 'downloading policy documents', 'contacting customer service']
};

// Helper function to pick a random item from an array
const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

// Helper function to fill template variables
const fillTemplate = (template, data) => {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return result;
};

// Generate a random date between last year and now
const getRandomDate = (maxMonthsAgo = 12) => {
  const now = new Date();
  const monthsAgo = Math.floor(Math.random() * maxMonthsAgo);
  const daysAgo = Math.floor(Math.random() * 30); // Random days within the month
  return subDays(subMonths(now, monthsAgo), daysAgo);
};

// Generate a post with random template and company
const generatePost = (company, user, product) => {
  const template = getRandomItem(questionTemplates);
  
  // Template data with company name and random product if available
  const templateData = {
    company: company.companyName,
    product: product || 'health'
  };
  
  const postContent = fillTemplate(template, templateData);
  
  // Generate a random date from within the last year
  const randomDate = getRandomDate();
  
  return {
    avatar: user.picture || null,
    name: user.fullName || user.username,
    userId: user._id,
    date: format(randomDate, 'yyyy-MM-dd'),
    post: postContent,
    slug: generateSlug(postContent),
    tags: [company.companyName.toLowerCase(), 'insurance', product || 'health insurance', 'review', 'question'],
    created_at: randomDate,
    updated_at: randomDate
  };
};

// Generate a comment for a post
const generateComment = (company, user, postDate) => {
  const template = getRandomItem(commentTemplates);
  
  // Prepare random variables for the template
  const templateData = {
    company: company.companyName,
    rating: getRandomItem(variables.rating),
    years: getRandomItem(variables.years),
    quality: getRandomItem(variables.quality),
    comparison: getRandomItem(variables.comparison),
    city: getRandomItem(variables.city),
    hospital_quality: getRandomItem(variables.hospital_quality),
    feature: getRandomItem(variables.feature),
    opinion: getRandomItem(variables.opinion),
    aspect: getRandomItem(variables.aspect),
    assessment: getRandomItem(variables.assessment),
    reason: getRandomItem(variables.reason),
    process_quality: getRandomItem(variables.process_quality),
    duration: getRandomItem(variables.duration),
    coverage_quality: getRandomItem(variables.coverage_quality),
    standout_feature: getRandomItem(variables.standout_feature),
  };
  
  const commentText = fillTemplate(template, templateData);
  
  // Generate a random date that's after the post date but before now
  const postDateObj = new Date(postDate);
  const now = new Date();
  const daysSincePost = differenceInDays(now, postDateObj);
  // Comment date is between post date and now
  const daysAfterPost = Math.floor(Math.random() * (daysSincePost + 1));
  const commentDate = subDays(now, daysSincePost - daysAfterPost);
  
  return {
    userId: user._id,
    name: user.fullName || user.username,
    avatar: user.picture || null,
    text: commentText,
    created_at: commentDate
  };
};

// Generate a reply to a comment
const generateReply = (company, user, commentDate) => {
  const template = getRandomItem(replyTemplates);
  
  // Prepare random variables for the template
  const templateData = {
    company: company.companyName,
    aspect: getRandomItem(variables.aspect),
    alternative_aspect: getRandomItem(variables.alternative_aspect),
    related_aspect: getRandomItem(variables.related_aspect),
    contrary_opinion: getRandomItem(variables.contrary_opinion),
    additional_aspect: getRandomItem(variables.additional_aspect),
    changed_aspect: getRandomItem(variables.changed_aspect),
    negotiable_aspect: getRandomItem(variables.negotiable_aspect),
    competitor: getRandomItem(variables.competitor),
    comparison_point: getRandomItem(variables.comparison_point),
    feature: getRandomItem(variables.feature),
    action: getRandomItem(variables.action)
  };
  
  const replyText = fillTemplate(template, templateData);
  
  // Generate a random date that's after the comment date but before now
  const commentDateObj = new Date(commentDate);
  const now = new Date();
  const daysSinceComment = differenceInDays(now, commentDateObj);
  // Reply date is between comment date and now
  const daysAfterComment = Math.floor(Math.random() * (daysSinceComment + 1));
  const replyDate = subDays(now, daysSinceComment - daysAfterComment);
  
  return {
    userId: user._id,
    name: user.fullName || user.username,
    avatar: user.picture || null,
    text: replyText,
    created_at: replyDate
  };
};

// Main function to generate posts
const generateCommunityPosts = async () => {
  try {
    await connectDB();
    
    // Fetch all users and insurance companies
    const users = await User.find();
    const companies = await InsuranceCompany.find();
    
    if (users.length === 0) {
      console.error('No users found in the database');
      process.exit(1);
    }
    
    if (companies.length === 0) {
      console.error('No insurance companies found in the database');
      process.exit(1);
    }
    
    console.log(`Found ${users.length} users and ${companies.length} insurance companies`);
    
    // Generate posts for each company with random users
    const postsToCreate = [];
    const postsPerCompany = 3; // Number of posts to create per company
    
    for (const company of companies) {
      // Get product types from the company if available
      let productTypes = [];
      if (company.products && Array.isArray(company.products) && company.products.length > 0) {
        productTypes = company.products.map(p => p.label);
      }
      
      for (let i = 0; i < postsPerCompany; i++) {
        // Pick a random user for the post
        const randomUser = getRandomItem(users);
        
        // Pick a random product type if available
        const randomProduct = productTypes.length > 0 ? getRandomItem(productTypes) : null;
        
        // Generate post data with random date
        const postData = generatePost(company, randomUser, randomProduct);
        
        // Add 1-3 comments to each post from random users
        const numComments = Math.floor(Math.random() * 3) + 1;
        const comments = [];
        
        for (let j = 0; j < numComments; j++) {
          // Pick a different user for the comment
          const commentUsers = users.filter(u => u._id.toString() !== randomUser._id.toString());
          const commentUser = getRandomItem(commentUsers);
          
          // Generate comment with date after post date
          const comment = generateComment(company, commentUser, postData.created_at);
          
          // Randomly add replies to some comments (50% chance)
          if (Math.random() > 0.5) {
            // Get another random user for the reply (not the comment author)
            const replyUsers = users.filter(
              u => u._id.toString() !== commentUser._id.toString() && 
                   u._id.toString() !== randomUser._id.toString()
            );
            
            if (replyUsers.length > 0) {
              const replyUser = getRandomItem(replyUsers);
              // Generate reply with date after comment date
              const reply = generateReply(company, replyUser, comment.created_at);
              
              // Add the reply to the comment
              comment.replies = [reply];
              comment.repliesCount = 1;
            }
          }
          
          comments.push(comment);
        }
        
        // Add comments to the post
        postData.comments = comments;
        postData.commentsCount = comments.length;
        
        // Add some random likes/dislikes to the post
        const numLikes = Math.floor(Math.random() * 5);
        if (numLikes > 0) {
          const likedUsers = users
            .filter(u => u._id.toString() !== randomUser._id.toString())
            .slice(0, numLikes);
          
          postData.likes = numLikes;
          postData.likedBy = likedUsers.map(u => u._id);
          postData.upvotes = numLikes; // Backward compatibility
          postData.upvotedBy = likedUsers.map(u => u._id); // Backward compatibility
        }
        
        // Add random featured flag (10% chance)
        if (Math.random() < 0.1) {
          postData.featured = true;
        }
        
        postsToCreate.push(postData);
      }
    }
    
    console.log(`Prepared ${postsToCreate.length} posts for creation`);
    
    // Insert all posts into the database
    const result = await CommunityPost.insertMany(postsToCreate);
    
    console.log(`Successfully created ${result.length} community posts`);
    process.exit(0);
  } catch (error) {
    console.error('Error generating community posts:', error);
    process.exit(1);
  }
};

// Execute the script
generateCommunityPosts();
