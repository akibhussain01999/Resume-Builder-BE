const express = require('express');
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  verifyEmailSchema
} = require('./auth.validator');

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/google', validate(googleLoginSchema), authController.googleLogin);
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
