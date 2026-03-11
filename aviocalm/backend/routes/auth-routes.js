const express = require('express');
const router = express.Router();
const { login, resetPassword } = require('../controllers/auth-controller');
const { authenticateToken } = require('../middleware/auth-middleware');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/reset-password (protected route)
router.post('/reset-password', authenticateToken, resetPassword);

module.exports = router;
