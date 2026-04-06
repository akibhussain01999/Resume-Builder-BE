const express = require('express');
const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./user/user.routes');
const resumeRoutes = require('./resume/resume.routes');
const coverLetterRoutes = require('./cover-letter/coverLetter.routes');
const catalogRoutes = require('./catalog/catalog.routes');
const documentRoutes = require('./document/document.routes');
const adminRoutes = require('./admin/admin.routes');
const resumeAnalysisRoutes = require('./ats-checker/ats.routes');
const dynamicResumeRoutes = require('./dynamic-resume-poc/dynamicResume.routes');
const seoRoutes = require('./seo/seoRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/resumes', resumeRoutes);
router.use('/cover-letters', coverLetterRoutes);
router.use('/', catalogRoutes);
router.use('/documents', documentRoutes);
router.use('/admin', adminRoutes);
router.use('/resume-analysis', resumeAnalysisRoutes);
router.use('/dynamic-resume', dynamicResumeRoutes);
router.use('/seo-meta', seoRoutes);

module.exports = router;
