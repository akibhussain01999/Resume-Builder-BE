const dotenv = require('dotenv');
dotenv.config();

// Ensure DB connection is established by requiring the existing db config
require('../config/db');
const mongoose = require('mongoose');

const Review = require('../modules/reviews/ReviewModel');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function isMissing(val) {
  return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
}

const AGE_GROUPS = ['18-25', '26-35', '36-45', '46-60', '60+'];
const LOCATIONS = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Jaipur'];
const POLICY_COVERAGE = ['individual', 'family', 'group'];
const POLICY_TENURE = ['less-than-1', '1-3', '3-5', '5+'];
const CLAIM_APPROVED = ['yes', 'no'];
const CLAIM_SETTLEMENT = ['less-than-7', '7-15', '15-30', '30+'];
const NETWORK_EXPERIENCE = ['good', 'average', 'bad'];

async function populate() {
  console.log('Starting review population script (cursor, one-by-one)...');

  const cursor = Review.find({}).cursor();
  let count = 0;
  let updated = 0;
  let skipped = 0;

  for await (const r of cursor) {
    count++;
    const update = {};

    if (isMissing(r.ageGroup)) update.ageGroup = pick(AGE_GROUPS);
    if (isMissing(r.location)) update.location = pick(LOCATIONS);
    if (isMissing(r.policyCoverage)) update.policyCoverage = pick(POLICY_COVERAGE);
    if (isMissing(r.policyTenure)) update.policyTenure = pick(POLICY_TENURE);
  // wouldRecommend: random boolean (70% true)
  if (r.wouldRecommend === undefined || r.wouldRecommend === null) update.wouldRecommend = Math.random() < 0.7;

  // networkHospitalExperience: pick from allowed values
  if (isMissing(r.networkHospitalExperience)) update.networkHospitalExperience = pick(NETWORK_EXPERIENCE);

    // madeClaim: random boolean (30% true)
    if (r.madeClaim === undefined || r.madeClaim === null) update.madeClaim = Math.random() < 0.3;

    if (isMissing(r.claimApproved)) update.claimApproved = pick(CLAIM_APPROVED);
    if (isMissing(r.claimSettlementTime)) update.claimSettlementTime = pick(CLAIM_SETTLEMENT);

    // Subratings: ensure required fields exist (1-5)
    const sub = r.subratings || {};
    const newSub = {};
    if (isMissing(sub.customerService)) newSub['subratings.customerService'] = randInt(1, 5);
    if (isMissing(sub.claimsProcess)) newSub['subratings.claimsProcess'] = randInt(1, 5);
    if (isMissing(sub.policyCoverage)) newSub['subratings.policyCoverage'] = randInt(1, 5);
  if (isMissing(sub.callCenterSupport)) newSub['subratings.callCenterSupport'] = randInt(1, 5);
    if (isMissing(sub.valueForMoney)) newSub['subratings.valueForMoney'] = randInt(1, 5);
    if (isMissing(sub.settlementRatio)) newSub['subratings.settlementRatio'] = randInt(1, 5);
    if (isMissing(sub.avgClaimTime)) newSub['subratings.avgClaimTime'] = randInt(1, 60);

    // policyDocument: put a placeholder key if missing
    if (isMissing(r.policyDocument)) update.policyDocument = `policy_${r._id}.pdf`;

    // likes / Dislike -> ensure arrays
    if (!Array.isArray(r.likes)) update.likes = [];
    if (!Array.isArray(r.Dislike)) update.Dislike = [];

    // islegal default true
    if (r.islegal === undefined || r.islegal === null) update.islegal = true;

    // merge newSub into update using dot notation
    Object.assign(update, newSub);

    if (Object.keys(update).length === 0) {
      skipped++;
      if (count % 100 === 0) console.log(`Processed ${count} reviews, updated ${updated}, skipped ${skipped}`);
      continue;
    }

    try {
      await Review.findByIdAndUpdate(r._id, { $set: update });
      updated++;
      if (updated % 50 === 0) console.log(`Updated ${updated} reviews so far`);
    } catch (err) {
      console.error(`Failed to update review ${r._id}:`, err);
    }

    if (count % 100 === 0) console.log(`Processed ${count} reviews, updated ${updated}, skipped ${skipped}`);
  }

  console.log(`Done processing. Total processed: ${count}. Updated: ${updated}. Skipped: ${skipped}`);
}

populate()
  .then(() => mongoose.connection.close())
  .then(() => console.log('Done. Connection closed.'))
  .catch((err) => {
    console.error('Error while populating reviews:', err);
    mongoose.connection.close();
    process.exit(1);
  });
