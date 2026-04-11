const BlogPost = require('./blogPost.model');
const BlogMasterTitle = require('./blogMasterTitle.model');

// Fetch one pending title (oldest, highest priority first) and return its title + id
async function getNextPendingTitle() {
  const doc = await BlogMasterTitle.findOne({ status: 'pending' })
    .sort({ priority: -1, createdAt: 1 });
  if (!doc) return { title: '', id: '' };
  return { title: doc.title, id: String(doc._id) };
}

// Return all active blog posts (minimal fields for internal linking)
async function getAllActiveBlogs() {
  return BlogPost.find({ status: 'active' })
    .select('title slug category tags seoTitle seoDescription')
    .lean();
}

// Check whether a slug already exists
async function checkDuplicateSlug(slug) {
  const exists = await BlogPost.exists({ slug });
  return { exists: !!exists };
}

// Create a new blog post
async function createBlog(data) {
  const post = await BlogPost.create(data);
  return post;
}

// Mark a BlogMasterTitle as active after successful publish
async function markTitleActive(id) {
  return BlogMasterTitle.findByIdAndUpdate(id, { status: 'active' }, { new: true });
}

// Mark a BlogMasterTitle as failed
async function markTitleFailed(id) {
  return BlogMasterTitle.findByIdAndUpdate(id, { status: 'failed' }, { new: true });
}

module.exports = {
  getNextPendingTitle,
  getAllActiveBlogs,
  checkDuplicateSlug,
  createBlog,
  markTitleActive,
  markTitleFailed
};
