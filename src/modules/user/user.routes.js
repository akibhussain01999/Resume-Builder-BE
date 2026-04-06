const express = require('express');
const userController = require('./user.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { updateProfileSchema, changePasswordSchema, deleteAccountSchema } = require('./user.validator');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/profile', userController.getProfile);
router.patch('/profile', validate(updateProfileSchema), userController.updateProfile);
router.patch('/change-password', validate(changePasswordSchema), userController.changePassword);
router.delete('/account', validate(deleteAccountSchema), userController.deleteAccount);

module.exports = router;
