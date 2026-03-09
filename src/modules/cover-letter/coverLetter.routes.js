const express = require('express');
const controller = require('./coverLetter.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  listCoverLettersSchema,
  createCoverLetterSchema,
  coverLetterIdParamSchema,
  updateCoverLetterSchema
} = require('./coverLetter.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(listCoverLettersSchema), controller.listCoverLetters);
router.post('/', validate(createCoverLetterSchema), controller.createCoverLetter);
router.get('/:id', validate(coverLetterIdParamSchema), controller.getCoverLetter);
router.patch('/:id', validate(updateCoverLetterSchema), controller.updateCoverLetter);
router.delete('/:id', validate(coverLetterIdParamSchema), controller.deleteCoverLetter);

module.exports = router;
