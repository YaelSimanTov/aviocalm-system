const express = require('express');
const router  = express.Router();
const { authenticateToken }            = require('../middleware/auth-middleware');
const { getUnreadAlerts, markAlertRead } = require('../controllers/alerts-controller');

// All alert routes require a valid JWT
router.use(authenticateToken);

// GET /api/alerts/unread — fetch all unread alerts with patient details
router.get('/unread', getUnreadAlerts);

// PATCH /api/alerts/:id/read — mark a single alert as read
router.patch('/:id/read', markAlertRead);

module.exports = router;
