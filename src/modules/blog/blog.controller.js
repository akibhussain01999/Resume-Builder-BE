const blogService = require('./blog.service');

// GET /api/blogs/get-blog-titles
async function getBlogTitles(req, res) {
  try {
    const result = await blogService.getNextPendingTitle();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /api/blogs/admin/getAllBlogs
async function getAllBlogs(req, res) {
  try {
    const blogs = await blogService.getAllActiveBlogs();
    return res.json(blogs);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /api/blogs/check-duplicate/:slug
async function checkDuplicate(req, res) {
  try {
    const result = await blogService.checkDuplicateSlug(req.params.slug);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// POST /api/blogs/create-blogs
async function createBlog(req, res) {
  try {
    const post = await blogService.createBlog(req.body);
    return res.status(201).json(post);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /api/blogs/:slug  (public – single post by slug)
async function getBlogBySlug(req, res) {
  try {
    const { BlogPost } = require('./blogPost.model');
    const post = await require('./blogPost.model').findOne({ slug: req.params.slug, status: 'active' });
    if (!post) return res.status(404).json({ message: 'Blog not found' });
    return res.json(post);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// GET /api/blogs  (public – paginated list)
async function listBlogs(req, res) {
  try {
    const BlogPost = require('./blogPost.model');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const category = req.query.category;
    const filter = { status: 'active', ...(category && { category }) };

    const [blogs, total] = await Promise.all([
      BlogPost.find(filter)
        .select('title slug category tags coverImage seoDescription readingTime createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(filter)
    ]);

    return res.json({ blogs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getBlogTitles,
  getAllBlogs,
  checkDuplicate,
  createBlog,
  getBlogBySlug,
  listBlogs
};
