const express = require('express');
const adminAtsController = require('./adminAts.controller');
const adminAuth = require('../../../middlewares/adminAuth.middleware');

const router = express.Router();

router.get('/', adminAuth(), adminAtsController.listAtsRecords);
router.delete('/purge-expired', adminAuth(['superadmin', 'admin']), adminAtsController.purgeExpired);
router.get('/:id', adminAuth(), adminAtsController.getAtsRecord);
router.delete('/:id', adminAuth(['superadmin', 'admin']), adminAtsController.deleteAtsRecord);

module.exports = router;
