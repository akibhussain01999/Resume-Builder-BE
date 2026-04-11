const express = require('express');
const router = express.Router();
const ctrl = require('./blog.controller');

// --- Script / internal endpoints (used by autoBlogResume.js) ---
router.get('/get-blog-titles', ctrl.getBlogTitles);
router.get('/admin/getAllBlogs', ctrl.getAllBlogs);
router.get('/check-duplicate/:slug', ctrl.checkDuplicate);
router.post('/create-blogs', ctrl.createBlog);

// --- Public API ---
router.get('/', ctrl.listBlogs);
router.get('/:slug', ctrl.getBlogBySlug);

module.exports = router;
