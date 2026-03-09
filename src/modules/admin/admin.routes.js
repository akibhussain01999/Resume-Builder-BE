const express = require('express');
const seedRoutes = require('./seed/seed.routes');

const router = express.Router();

router.use('/seed', seedRoutes);

module.exports = router;
