const express = require('express');
const adminCoverLettersController = require('./adminCoverLetters.controller');
const adminAuth = require('../../../middlewares/adminAuth.middleware');

const router = express.Router();

router.get('/', adminAuth(), adminCoverLettersController.listCoverLetters);
router.get('/:id', adminAuth(), adminCoverLettersController.getCoverLetter);
router.delete('/:id', adminAuth(['superadmin', 'admin']), adminCoverLettersController.deleteCoverLetter);

module.exports = router;
