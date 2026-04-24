
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
router.get("/therapists", async (req, res) => {
    try {
        const pool = require("../config/db");

        const result = await pool.query(`
        SELECT username, first_name, last_name, role
        FROM users
        WHERE role = 'Therapist'
      `);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
router.delete("/therapists/:username", async (req, res) => {
    try {
        const pool = require("../config/db");
        const { username } = req.params;

        await pool.query(
            "DELETE FROM users WHERE username = $1 AND role = 'Therapist'",
            [username]
        );

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Delete failed" });
    }
});
router.put("/therapists/:username", async (req, res) => {
    try {
        const pool = require("../config/db");
        const { username } = req.params;
        const { firstName, lastName } = req.body;

        await pool.query(
            `UPDATE users 
         SET first_name=$1, last_name=$2 
         WHERE username=$3`,
            [firstName, lastName, username]
        );

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Update failed" });
    }
});
router.post("/reset-password", async (req, res) => {
    try {
        const pool = require("../config/db");
        const bcrypt = require("bcrypt");

        const { username } = req.body;

        const tempPassword = "Temp123!";
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(tempPassword, salt);

        await pool.query(
            `UPDATE users 
         SET password_hash=$1, salt=$2, is_first_login=true 
         WHERE username=$3`,
            [hash, salt, username]
        );

        res.json({
            success: true,
            temporaryPassword: tempPassword
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Reset failed" });
    }
});
const bcrypt = require("bcrypt");
const pool = require("../config/db");

router.post("/create-therapist", async (req, res) => {
    try {
        console.log("🔥 CREATE THERAPIST HIT");
        console.log(req.body);

        const { username, firstName, lastName } = req.body;

        const tempPassword = "Temp123!";
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(tempPassword, salt);

        const result = await pool.query(
            `INSERT INTO users (username, password_hash, salt, role, is_first_login, first_name, last_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING username`,
            [username, hash, salt, "Therapist", true, firstName, lastName]
        );

        res.json({
            username: result.rows[0].username,
            temporaryPassword: tempPassword
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
// Placeholder for future owner endpoints
// GET /api/owner/therapists
// POST /api/owner/therapists
// GET /api/owner/analytics

module.exports = router;
