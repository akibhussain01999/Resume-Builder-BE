const express = require('express');
const router = express.Router();
const seoController = require('./seoController');
const authenticateUser = require('../../middlewares/auth.middleware');

/**
 * @route   GET /api/seo-meta
 * @desc    Get all SEO meta tags
 * @access  Public
 */
router.get('/', seoController.getAllSeoMeta);

/**
 * @route   POST /api/seo-meta/bulk-update
 * @desc    Bulk update SEO metas
 * @access  Private (Admin)
 * @note    Must be before /:pageType routes to avoid conflict
 */
router.post('/bulk-update', authenticateUser, seoController.bulkUpdateSeoMeta);

/**
 * @route   POST /api/seo-meta
 * @desc    Create new SEO meta
 * @access  Private (Admin)
 */
router.post('/', authenticateUser, seoController.createSeoMeta);

/**
 * @route   POST /api/seo-meta/:pageType/render
 * @desc    Render meta tags with dynamic values
 * @access  Public
 */
router.post('/:pageType/render', seoController.renderMetaTags);

/**
 * @route   GET /api/seo-meta/:pageType
 * @desc    Get SEO meta by page type
 * @access  Public
 * @params  pageType - company_layout, landing_page, compare_company, contest, blog_category, blog_list, community, write_review
 * @query   dynamicValues - JSON string with dynamic field values
 */
router.get('/:pageType', seoController.getSeoMetaByPageType);

/**
 * @route   PUT /api/seo-meta/:pageType
 * @desc    Update SEO meta by page type
 * @access  Private (Admin)
 */
router.put('/:pageType', authenticateUser, seoController.updateSeoMeta);

/**
 * @route   PATCH /api/seo-meta/:pageType/toggle
 * @desc    Toggle SEO meta active status
 * @access  Private (Admin)
 */
router.patch('/:pageType/toggle', authenticateUser, seoController.toggleSeoMetaStatus);

/**
 * @route   DELETE /api/seo-meta/:pageType
 * @desc    Delete SEO meta by page type
 * @access  Private (Admin)
 */
router.delete('/:pageType', authenticateUser, seoController.deleteSeoMeta);

module.exports = router;
