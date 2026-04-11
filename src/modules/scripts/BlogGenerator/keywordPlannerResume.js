const { GoogleAdsApi } = require('google-ads-api');
const dotenv = require('dotenv');
dotenv.config();

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.DEVELOPER_TOKEN,
});

const customer = client.Customer({
  customer_id: process.env.CUSTOMER_ID,   // without dashes
  refresh_token: process.env.REFRESH_TOKEN,
});

// Generate semantic keywords for resume/career topics when API fails
function generateSemanticKeywords(topic) {
  const topicLower = topic.toLowerCase();
  const keywords = [];

  const modifiers = ['best', 'top', 'professional', 'modern', 'free', 'examples', 'tips', 'guide'];
  const careerTerms = ['resume', 'cv', 'job', 'career', 'interview', 'cover letter', 'linkedin', 'application'];

  // Domain-specific keyword generation
  if (topicLower.includes('resume') || topicLower.includes('cv')) {
    keywords.push('resume writing tips', 'professional resume format', 'resume examples 2025');
  }
  if (topicLower.includes('cover letter')) {
    keywords.push('cover letter examples', 'how to write a cover letter', 'cover letter template');
  }
  if (topicLower.includes('interview')) {
    keywords.push('interview questions and answers', 'how to prepare for interview', 'common interview questions');
  }
  if (topicLower.includes('linkedin')) {
    keywords.push('linkedin profile tips', 'how to optimize linkedin', 'linkedin summary examples');
  }
  if (topicLower.includes('job') || topicLower.includes('career')) {
    keywords.push('job search tips', 'how to get a job', 'career development advice');
  }
  if (topicLower.includes('ats')) {
    keywords.push('ats resume tips', 'ats friendly resume', 'applicant tracking system resume');
  }
  if (topicLower.includes('salary') || topicLower.includes('negotiat')) {
    keywords.push('salary negotiation tips', 'how to negotiate salary', 'salary negotiation email');
  }
  if (topicLower.includes('skill') || topicLower.includes('skills')) {
    keywords.push('resume skills section', 'top skills for resume', 'hard skills vs soft skills');
  }

  // Add question-based keywords from topic words
  const words = topicLower.split(/\s+/).filter(w => w.length > 3);
  if (!topicLower.startsWith('how') && !topicLower.startsWith('what')) {
    keywords.push(`how to ${topicLower}`, `what is ${topicLower}`);
  }

  // Add modifier-based keywords
  const mainTopic = topicLower.replace(/^(how to|what is|why|when|where|best)\s+/i, '');
  modifiers.slice(0, 3).forEach(mod => {
    if (!topicLower.includes(mod)) {
      keywords.push(`${mod} ${mainTopic}`);
    }
  });

  return [...new Set(keywords)].slice(0, 5);
}

async function getBestKeywords(topic) {
  const competitionRank = (c) => {
    if (!c) return 3;
    const v = String(c).toUpperCase();
    if (v === 'LOW') return 0;
    if (v === 'MEDIUM') return 1;
    if (v === 'HIGH') return 2;
    return 3;
  };

  const TRAFFIC_HIGH = 1000;
  const TRAFFIC_MED = 100;

  // Attempt KeywordPlanIdeaService first
  try {
    console.log('🔍 Attempting KeywordPlanIdeaService for topic:', topic);

    const keyTerms = topic.toLowerCase()
      .split(' ')
      .filter(w => w.length > 3)
      .filter(w => !['with', 'from', 'that', 'this', 'have', 'your', 'into', 'about'].includes(w))
      .slice(0, 5);

    console.log('🔑 Using key terms for broader suggestions:', keyTerms);

    const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
      customer_id: process.env.CUSTOMER_ID,
      keyword_seed: {
        keywords: keyTerms.length > 0 ? keyTerms : [topic]
      },
      geo_target_constants: ['geoTargetConstants/2840'], // United States (adjust as needed)
      language: 'languageConstants/1000', // English
      keyword_plan_network: 'GOOGLE_SEARCH',
      include_adult_keywords: false
    });

    const results = response || [];
    console.log(`✅ KeywordPlanIdeaService returned ${results.length} results`);

    const mapped = results.map(r => ({
      text: r.text,
      competition: r.keyword_idea_metrics?.competition,
      avg_monthly_searches: Number(r.keyword_idea_metrics?.avg_monthly_searches) || 0
    }));

    // Filter for resume/career related terms
    const topicTerms = topic.toLowerCase().split(' ').filter(w => w.length > 3);
    const resumeTerms = ['resume', 'cv', 'job', 'career', 'interview', 'cover letter', 'linkedin',
      'hiring', 'application', 'workplace', 'skills', 'salary', 'work', 'employment', 'ats'];

    const relevant = mapped.filter(k => {
      const kText = (k.text || '').toLowerCase();
      const matchCount = topicTerms.filter(term => kText.includes(term)).length;
      const hasResumeTerm = resumeTerms.some(term => kText.includes(term));
      return (matchCount >= 2) || hasResumeTerm;
    });

    console.log(`📊 Filtered to ${relevant.length} relevant keywords from ${mapped.length} total`);

    const multiWord = relevant.filter(k => (k.text || '').split(' ').length >= 2);
    const singleWord = relevant.filter(k => (k.text || '').split(' ').length === 1);

    const lowHigh = multiWord.filter(k => competitionRank(k.competition) === 0 && k.avg_monthly_searches >= TRAFFIC_MED);
    const mediumHigh = multiWord.filter(k => competitionRank(k.competition) === 1 && k.avg_monthly_searches >= TRAFFIC_HIGH);
    const fallbackMultiWord = multiWord.filter(k => k.avg_monthly_searches >= TRAFFIC_MED);
    const fallbackSingleWord = singleWord.filter(k => k.avg_monthly_searches >= TRAFFIC_MED);

    const combined = [];
    const seen = new Set();
    const pushUnique = (arr) => {
      for (const it of arr) {
        if (!it || !it.text) continue;
        const t = it.text.toLowerCase();
        if (seen.has(t) || t === topic.toLowerCase()) continue;
        seen.add(t);
        combined.push(it);
      }
    };

    pushUnique(lowHigh.sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches));
    pushUnique(mediumHigh.sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches));
    pushUnique(fallbackMultiWord.sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches));
    pushUnique(fallbackSingleWord.sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches));

    const primary = combined[0]?.text || topic;
    const secondary = combined.slice(1, 6).map(k => k.text);
    console.log(`✅ KeywordPlanIdeaService - Primary: "${primary}", Secondary count: ${secondary.length}`, secondary);
    return { primaryKeyword: primary, secondaryKeywords: secondary };
  } catch (e) {
    console.warn('⚠️ KeywordPlanIdeaService call failed:', e.message || e);
    console.log('Falling back to GAQL streaming...');
  }

  // Fallback: GAQL streaming
  try {
    console.log('🔍 Attempting GAQL fallback for topic:', topic);

    const topicLower = topic.toLowerCase();
    const keyTerms = topicLower
      .split(' ')
      .filter(word => word.length > 3)
      .filter(word => !['with', 'from', 'that', 'this', 'have', 'your'].includes(word))
      .slice(0, 3);

    console.log('🔑 Key terms extracted:', keyTerms);

    let whereClause = 'ad_group_criterion.type = KEYWORD';
    if (keyTerms.length > 0) {
      const safeTerm = keyTerms[0].replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      whereClause += ` AND ad_group_criterion.keyword.text LIKE '%${safeTerm}%'`;
    }

    const query = `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.status FROM ad_group_criterion WHERE ${whereClause} LIMIT 200`;
    console.log('📝 GAQL Query:', query);

    const collected = new Map();

    try {
      console.log('📊 Executing GAQL query stream...');
      const stream = customer.queryStream(query);

      let rowCount = 0;
      for await (const row of stream) {
        rowCount++;
        const kw = row?.ad_group_criterion?.keyword?.text;
        const status = row?.ad_group_criterion?.status;
        if (!kw) continue;
        const key = kw.toLowerCase();
        if (!collected.has(key)) collected.set(key, { text: kw, status });
        if (collected.size >= 50) break;
      }
      console.log(`📊 GAQL stream processed ${rowCount} rows, collected ${collected.size} unique keywords`);
    } catch (queryErr) {
      if (queryErr.message && queryErr.message.includes('invalid_grant')) {
        console.error('\n❌ Authentication Error: Your Google Ads API refresh token has expired.');
        console.error('   Run the token refresh guide in TOKEN_REFRESH_GUIDE.md\n');
      } else {
        console.warn('⚠️ GAQL query failed:', queryErr.message || queryErr);
      }
      console.log('❌ GAQL failed, returning topic only');
      return { primaryKeyword: topic, secondaryKeywords: [] };
    }

    const ideas = Array.from(collected.values());
    if (ideas.length === 0) {
      console.log('⚠️ GAQL returned 0 keywords, generating semantic keywords programmatically');
      const semanticKeywords = generateSemanticKeywords(topic);
      return { primaryKeyword: topic, secondaryKeywords: semanticKeywords };
    }

    const order = { ENABLED: 0, PAUSED: 1, REMOVED: 2 };
    ideas.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    const primary = ideas[0]?.text || topic;
    const secondary = ideas.slice(1, 6).map(k => k.text);

    if (secondary.length < 3) {
      const semanticKeywords = generateSemanticKeywords(topic);
      const combined = [...new Set([...secondary, ...semanticKeywords])].slice(0, 5);
      return { primaryKeyword: primary, secondaryKeywords: combined };
    }

    console.log(`✅ GAQL fallback - Primary: "${primary}", Secondary count: ${secondary.length}`, secondary);
    return { primaryKeyword: primary, secondaryKeywords: secondary };
  } catch (err) {
    console.error('⚠️ keywordPlanner fallback failed, returning programmatic keywords:', err?.message || err);
    const semanticKeywords = generateSemanticKeywords(topic);
    return { primaryKeyword: topic, secondaryKeywords: semanticKeywords };
  }
}

module.exports = { getBestKeywords };
