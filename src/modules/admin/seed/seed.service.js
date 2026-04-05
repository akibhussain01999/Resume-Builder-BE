const crypto = require('crypto');
const Template = require('../../catalog/template.model');
const TemplateCategory = require('../../catalog/templateCategory.model');
const ResumeExample = require('../../catalog/resumeExample.model');
const logger = require('../../../config/logger');

const seedTemplateCategories = async (categories) => {
  const operations = categories.map((item) => ({
    updateOne: {
      filter: { id: item.id },
      update: { $set: item },
      upsert: true
    }
  }));

  const result = await TemplateCategory.bulkWrite(operations, { ordered: false });
  logger.info(`Seeded template categories: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
  return { matched: result.matchedCount, modified: result.modifiedCount, upserted: result.upsertedCount };
};

const seedTemplates = async (templates) => {
  const operations = templates.map((item) => ({
    updateOne: {
      filter: { id: item.id },
      update: { $set: item },
      upsert: true
    }
  }));

  const result = await Template.bulkWrite(operations, { ordered: false });
  logger.info(`Seeded templates: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
  return { matched: result.matchedCount, modified: result.modifiedCount, upserted: result.upsertedCount };
};

const normalizeExamplesPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.examples)) {
    return payload.examples;
  }

  if (Array.isArray(payload.resumeExamples)) {
    return payload.resumeExamples;
  }

  return [];
};

const normalizeExample = (item) => {
  const fallbackId = `example_${crypto.randomBytes(6).toString('hex')}`;
  return {
    id: item.id || fallbackId,
    role: item.role || '',
    title: item.title || '',
    summary: item.summary || '',
    data: item
  };
};

const seedResumeExamples = async (payload) => {
  const examples = normalizeExamplesPayload(payload).map(normalizeExample);

  const operations = examples.map((item) => ({
    updateOne: {
      filter: { id: item.id },
      update: { $set: item },
      upsert: true
    }
  }));

  const result = await ResumeExample.bulkWrite(operations, { ordered: false });
  logger.info(`Seeded resume examples: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount,
    total: examples.length
  };
};

module.exports = {
  seedTemplateCategories,
  seedTemplates,
  seedResumeExamples
};
