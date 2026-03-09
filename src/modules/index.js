const express = require('express');
const authRoutes = require('./auth/auth.routes');
const resumeRoutes = require('./resume/resume.routes');
const coverLetterRoutes = require('./cover-letter/coverLetter.routes');
const catalogRoutes = require('./catalog/catalog.routes');
const documentRoutes = require('./document/document.routes');
const adminRoutes = require('./admin/admin.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/resumes', resumeRoutes);
router.use('/cover-letters', coverLetterRoutes);
router.use('/', catalogRoutes);
router.use('/documents', documentRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
