const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const templateCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true, trim: true },
    icon: { type: String, default: '' },
    color: { type: String, default: '' },
    templates: { type: [String], default: [] },
    roles: { type: [roleSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('TemplateCategory', templateCategorySchema);
