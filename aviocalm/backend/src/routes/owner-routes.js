const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth-middleware');

// All owner routes require authentication and Owner role
router.use(authenticateToken);
router.use(requireRole(['Owner']));

// GET /api/owner/dashboard
router.get('/dashboard', (req, res) => {
    res.json({
        success: true,
        data: {
            message: 'Owner dashboard',
            user: req.user
        }
    });
});

// GET /api/owner/therapists
router.get('/therapists', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT user_id, username, first_name, last_name, role, is_first_login
             FROM users
             WHERE role = $1
             ORDER BY username ASC`,
            ['Therapist']
        );

        res.json({
            success: true,
            therapists: result.rows
        });
    } catch (error) {
        console.error('[OWNER] Error fetching therapists:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching therapists'
        });
    }
});

// POST /api/owner/create-therapist
router.post('/create-therapist', async (req, res) => {
    try {
        const { username, firstName, lastName } = req.body;

        if (!username || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'Username, first name and last name are required'
            });
        }

        const existingUser = await pool.query(
            'SELECT user_id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists'
            });
        }

        const temporaryPassword = `${username}123!`;
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        const result = await pool.query(
            `INSERT INTO users 
             (username, password_hash, salt, role, is_first_login, first_name, last_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING user_id, username, first_name, last_name, role, is_first_login`,
            [
                username,
                passwordHash,
                'bcrypt',
                'Therapist',
                true,
                firstName,
                lastName
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Therapist created successfully',
            therapist: result.rows[0],
            temporaryPassword
        });
    } catch (error) {
        console.error('[OWNER] Error creating therapist:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating therapist'
        });
    }
});

module.exports = router;