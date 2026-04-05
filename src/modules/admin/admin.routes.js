const express = require('express');
const seedRoutes = require('./seed/seed.routes');
const adminAuthRoutes = require('./auth/adminAuth.routes');
const dashboardRoutes = require('./dashboard/dashboard.routes');
const adminUsersRoutes = require('./users/adminUsers.routes');
const adminResumesRoutes = require('./resumes/adminResumes.routes');
const adminCoverLettersRoutes = require('./cover-letters/adminCoverLetters.routes');
const adminAtsRoutes = require('./ats/adminAts.routes');

const router = express.Router();

router.use('/auth', adminAuthRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', adminUsersRoutes);
router.use('/resumes', adminResumesRoutes);
router.use('/cover-letters', adminCoverLettersRoutes);
router.use('/ats', adminAtsRoutes);
router.use('/seed', seedRoutes);

module.exports = router;
