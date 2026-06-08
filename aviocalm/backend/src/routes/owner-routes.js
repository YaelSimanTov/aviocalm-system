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
            username: result.rows[0].username,
            temporaryPassword,
            therapist: result.rows[0]
        });
    } catch (error) {
        console.error('[OWNER] Error creating therapist:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating therapist'
        });
    }
});
// DELETE /api/owner/therapists/:username
router.delete('/therapists/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const therapistResult = await pool.query(
            `SELECT user_id, username
             FROM users
             WHERE username = $1 AND role = $2`,
            [username, 'Therapist']
        );

        if (therapistResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Therapist not found'
            });
        }

        const therapist = therapistResult.rows[0];

        const patientsResult = await pool.query(
            `SELECT COUNT(*) AS count
             FROM patients
             WHERE therapist_id = $1`,
            [therapist.user_id]
        );

        const patientsCount = Number(patientsResult.rows[0].count);

        if (patientsCount > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete therapist. This therapist has ${patientsCount} assigned patient(s).`
            });
        }

        await pool.query(
            `DELETE FROM users
             WHERE user_id = $1`,
            [therapist.user_id]
        );

        res.json({
            success: true,
            message: 'Therapist deleted successfully'
        });
    } catch (error) {
        console.error('[OWNER] Error deleting therapist:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting therapist'
        });
    }
});

// PUT /api/owner/therapists/:username
router.put('/therapists/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const firstName = req.body.firstName || req.body.first_name;
        const lastName = req.body.lastName || req.body.last_name;

        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and last name are required'
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET first_name = $1, last_name = $2
             WHERE username = $3 AND role = $4
             RETURNING user_id, username, first_name, last_name, role, is_first_login`,
            [firstName, lastName, username, 'Therapist']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Therapist not found'
            });
        }

        res.json({
            success: true,
            message: 'Therapist updated successfully',
            therapist: result.rows[0]
        });
    } catch (error) {
        console.error('[OWNER] Error updating therapist:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating therapist'
        });
    }
});

// POST /api/owner/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }

        const temporaryPassword = `${username}123!`;
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        const result = await pool.query(
            `UPDATE users
             SET password_hash = $1, salt = $2, is_first_login = $3
             WHERE username = $4 AND role = $5
             RETURNING user_id, username, first_name, last_name, role, is_first_login`,
            [passwordHash, 'bcrypt', true, username, 'Therapist']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Therapist not found'
            });
        }

        res.json({
            success: true,
            message: 'Password reset successfully',
            username: result.rows[0].username,
            temporaryPassword,
            therapist: result.rows[0]
        });
    } catch (error) {
        console.error('[OWNER] Error resetting password:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password'
        });
    }
});

module.exports = router;