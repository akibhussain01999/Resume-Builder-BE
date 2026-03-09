const express = require('express');
const controller = require('./document.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { resumePdfSchema, coverLetterPdfSchema } = require('./document.validator');

const router = express.Router();

router.use(authMiddleware);

router.post('/resume-pdf', validate(resumePdfSchema), controller.generateResumePdf);
router.post('/cover-letter-pdf', validate(coverLetterPdfSchema), controller.generateCoverLetterPdf);

module.exports = router;
