const express = require('express');
const adminResumesController = require('./adminResumes.controller');
const adminAuth = require('../../../middlewares/adminAuth.middleware');

const router = express.Router();

router.get('/', adminAuth(), adminResumesController.listResumes);
router.get('/:id', adminAuth(), adminResumesController.getResume);
router.delete('/:id', adminAuth(['superadmin', 'admin']), adminResumesController.deleteResume);

module.exports = router;
