const express = require('express');
const router = express.Router();
const { login, changePassword } = require('../controllers/auth-controller');
const { authenticateToken } = require('../middleware/auth-middleware');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/change-password (protected route)
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;
