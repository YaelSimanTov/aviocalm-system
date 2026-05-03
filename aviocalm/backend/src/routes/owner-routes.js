const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth-middleware');

// All owner routes require authentication and Owner role
router.use(authenticateToken);
router.use(requireRole(['Owner']));

// GET /api/owner/dashboard
router.get('/dashboard', (req, res) => {
    res.json({
        success: true,
        data: { 
            message: 'Owner dashboard - to be implemented',
            user: req.user
        }
    });
});

// Placeholder for future owner endpoints
// GET /api/owner/therapists
// POST /api/owner/therapists
// GET /api/owner/analytics

module.exports = router;
