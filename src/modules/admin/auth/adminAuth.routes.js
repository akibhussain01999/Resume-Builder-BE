const express = require('express');
const adminAuthController = require('./adminAuth.controller');
const adminAuth = require('../../../middlewares/adminAuth.middleware');

const router = express.Router();

// Public
router.post('/login', adminAuthController.login);
router.post('/refresh', adminAuthController.refresh);

// Any authenticated admin
router.get('/me', adminAuth(), adminAuthController.me);
router.post('/logout', adminAuth(), adminAuthController.logout);

// Superadmin only — create a new admin account
router.post('/create', adminAuth(['superadmin']), adminAuthController.createAdmin);

module.exports = router;
