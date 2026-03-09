const express = require('express');
const controller = require('./resume.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  listResumesSchema,
  createResumeSchema,
  resumeIdParamSchema,
  updateResumeSchema
} = require('./resume.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/', validate(listResumesSchema), controller.listResumes);
router.post('/', validate(createResumeSchema), controller.createResume);
router.get('/:id', validate(resumeIdParamSchema), controller.getResume);
router.patch('/:id', validate(updateResumeSchema), controller.updateResume);
router.delete('/:id', validate(resumeIdParamSchema), controller.deleteResume);

module.exports = router;
