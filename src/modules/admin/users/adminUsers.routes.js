const express = require('express');
const adminUsersController = require('./adminUsers.controller');
const adminAuth = require('../../../middlewares/adminAuth.middleware');

const router = express.Router();

router.get('/', adminAuth(), adminUsersController.listUsers);
router.get('/:id', adminAuth(), adminUsersController.getUser);
router.patch('/:id/activate', adminAuth(['superadmin', 'admin']), adminUsersController.activateUser);
router.patch('/:id/deactivate', adminAuth(['superadmin', 'admin']), adminUsersController.deactivateUser);
router.delete('/:id', adminAuth(['superadmin']), adminUsersController.deleteUser);

module.exports = router;
