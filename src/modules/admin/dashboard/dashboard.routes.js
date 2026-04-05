const express = require('express');
const dashboardController = require('./dashboard.controller');
const adminAuth = require('../../../middlewares/adminAuth.middleware');

const router = express.Router();

router.get('/stats', adminAuth(), dashboardController.getStats);

module.exports = router;
