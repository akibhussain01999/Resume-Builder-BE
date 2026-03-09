const { templates, templateCategories, resumeExamples } = require('./catalog.constants');
const Template = require('./template.model');
const TemplateCategory = require('./templateCategory.model');
const ResumeExample = require('./resumeExample.model');
const ApiError = require('../../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

const listTemplates = async (query) => {
  const filter = query.type ? { type: query.type } : {};
  const dbItems = await Template.find(filter).lean();

  if (dbItems.length > 0) {
    return dbItems;
  }

  if (!query.type) {
    return templates;
  }

  return templates.filter((template) => template.type === query.type);
};

const listTemplateCategories = async () => {
  const dbItems = await TemplateCategory.find({}).lean();
  return dbItems.length > 0 ? dbItems : templateCategories;
};

const listResumeExamples = async (query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const filter = query.role ? { $or: [{ role: query.role }, { label: query.role }] } : {};
  const dbItems = await ResumeExample.find(filter).limit(limit).lean();

  if (dbItems.length > 0) {
    return dbItems.map((item) => item.data || item);
  }

  let items = resumeExamples;
  if (query.role) {
    items = items.filter((example) => example.role === query.role);
  }

  return items.slice(0, limit);
};

const createTemplateCategory = async (payload) => {
  const exists = await TemplateCategory.findOne({ id: payload.id }).lean();
  if (exists) {
    throw new ApiError(StatusCodes.CONFLICT, 'CATEGORY_EXISTS', 'Template category already exists');
  }

  return TemplateCategory.create(payload);
};

const createTemplate = async (payload) => {
  const exists = await Template.findOne({ id: payload.id }).lean();
  if (exists) {
    throw new ApiError(StatusCodes.CONFLICT, 'TEMPLATE_EXISTS', 'Template already exists');
  }

  return Template.create(payload);
};

const createResumeExample = async (payload) => {
  const role = payload.role || payload.label || '';
  const title = payload.title || payload.label || '';
  const summary = payload.summary || '';

  const doc = await ResumeExample.findOneAndUpdate(
    { id: payload.id },
    {
      $set: {
        id: payload.id,
        role,
        label: payload.label || role,
        title,
        summary,
        data: payload
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return doc.data || doc;
};

const createResumeExamplesBulk = async (items) => {
  const ops = items.map((payload) => {
    const role = payload.role || payload.label || '';
    const title = payload.title || payload.label || '';
    const summary = payload.summary || '';

    return {
      updateOne: {
        filter: { id: payload.id },
        update: {
          $set: {
            id: payload.id,
            role,
            label: payload.label || role,
            title,
            summary,
            data: payload
          }
        },
        upsert: true
      }
    };
  });

  const result = await ResumeExample.bulkWrite(ops, { ordered: false });

  return {
    requested: items.length,
    inserted: result.upsertedCount || 0,
    updated: result.modifiedCount || 0,
    matched: result.matchedCount || 0
  };
};

module.exports = {
  listTemplates,
  listTemplateCategories,
  listResumeExamples,
  createTemplateCategory,
  createTemplate,
  createResumeExample,
  createResumeExamplesBulk
};
