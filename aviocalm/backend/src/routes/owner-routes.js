const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth-middleware');
const { createTherapistSchema, updateTherapistSchema, validate } = require('../middleware/user-validation');

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
            `SELECT u.user_id, u.username, u.first_name, u.last_name, u.role, u.is_first_login, u.email, u.phone_number,
                    COUNT(p.id) AS patient_count
             FROM users u
             LEFT JOIN patients p ON p.therapist_id = u.user_id
             WHERE u.role = $1
             GROUP BY u.user_id
             ORDER BY u.username ASC`,
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
router.post('/create-therapist', validate(createTherapistSchema), async (req, res) => {
    try {
        // req.body is already validated and sanitized (email lowercased, phone stripped)
        const { username, firstName, lastName, email, phoneNumber } = req.body;

        // Check for duplicate username
        const existingUser = await pool.query(
            'SELECT user_id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists. Please choose a different one.'
            });
        }

        // Check for duplicate email (when provided)
        if (email) {
            const existingEmail = await pool.query(
                'SELECT user_id FROM users WHERE email = $1',
                [email]
            );
            if (existingEmail.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'A user with that email address already exists.'
                });
            }
        }

        const temporaryPassword = `${username}123!`;
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        const result = await pool.query(
            `INSERT INTO users
             (username, password_hash, salt, role, is_first_login, first_name, last_name, email, phone_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING user_id, username, first_name, last_name, role, is_first_login, email, phone_number`,
            [
                username,
                passwordHash,
                'bcrypt',
                'Therapist',
                true,
                firstName,
                lastName,
                email   || null,
                phoneNumber || null,
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
    const { username } = req.params;
    const { replacement_therapist_id } = req.body;

    let client;
    try {
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
            `SELECT COUNT(*) AS count FROM patients WHERE therapist_id = $1`,
            [therapist.user_id]
        );
        const patientCount = Number(patientsResult.rows[0].count);

        // Patients exist but no replacement was provided — reject early
        if (patientCount > 0 && !replacement_therapist_id) {
            return res.status(400).json({
                success: false,
                message: `This therapist has ${patientCount} assigned patient(s). A replacement therapist must be selected before deletion.`
            });
        }

        // Acquire a dedicated client so the entire operation runs in one transaction
        client = await pool.connect();
        await client.query('BEGIN');

        if (patientCount > 0) {
            // Verify the replacement therapist exists before committing any change
            const replacementResult = await client.query(
                `SELECT user_id FROM users WHERE user_id = $1 AND role = $2`,
                [replacement_therapist_id, 'Therapist']
            );
            if (replacementResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: 'Replacement therapist not found.'
                });
            }

            // Bulk-reassign all patients to the replacement therapist
            await client.query(
                `UPDATE patients SET therapist_id = $1 WHERE therapist_id = $2`,
                [replacement_therapist_id, therapist.user_id]
            );
        }

        // Physically delete the therapist
        await client.query(
            `DELETE FROM users WHERE user_id = $1`,
            [therapist.user_id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Therapist deleted successfully'
        });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('[OWNER] Error deleting therapist:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting therapist'
        });
    } finally {
        if (client) client.release();
    }
});

// PUT /api/owner/therapists/:username
router.put('/therapists/:username', validate(updateTherapistSchema), async (req, res) => {
    try {
        const { username } = req.params;
        // Accept both camelCase (new) and snake_case (legacy) name keys
        const firstName   = req.body.firstName   || req.body.first_name;
        const lastName    = req.body.lastName    || req.body.last_name;
        const { email, phoneNumber } = req.body;

        // Check for duplicate email on another account (when provided)
        if (email) {
            const existingEmail = await pool.query(
                'SELECT user_id FROM users WHERE email = $1 AND username != $2',
                [email, username]
            );
            if (existingEmail.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'A user with that email address already exists.'
                });
            }
        }

        const result = await pool.query(
            `UPDATE users
             SET first_name   = $1,
                 last_name    = $2,
                 email        = $3,
                 phone_number = $4
             WHERE username = $5 AND role = $6
             RETURNING user_id, username, first_name, last_name, role, is_first_login, email, phone_number`,
            [firstName, lastName, email || null, phoneNumber || null, username, 'Therapist']
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
        // Safety net: catch PostgreSQL unique-constraint violation that could slip through
        // the pre-check above in the rare case of a concurrent request (error code 23505).
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'This email is already in use by another therapist.'
            });
        }
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