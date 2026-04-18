const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Helper function to create JWT token
const createToken = (user) => {
    return jwt.sign(
        { 
            userId: user.user_id, 
            username: user.username, 
            role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

// Login controller
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        // Find user by username
        const userQuery = 'SELECT * FROM users WHERE username = $1';
        const userResult = await pool.query(userQuery, [username]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        const user = userResult.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password'
            });
        }

        // Create JWT token
        const token = createToken(user);

        // Return success response
        res.json({
            success: true,
            data: {
                token,
                user: {
                    userId: user.user_id,
                    username: user.username,
                    role: user.role,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isFirstLogin: user.is_first_login
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

// Change password controller
const  changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user.userId; // Get from JWT middleware

        // Validation
        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Old password and new password are required'
            });
        }

        // Find user by ID
        const userQuery = 'SELECT * FROM users WHERE user_id = $1';
        const userResult = await pool.query(userQuery, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = userResult.rows[0];

        // Verify old password
        const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);

        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect current password',
                field: 'oldPassword'
            });
        }

        // Hash new password
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password and set is_first_login to false
        const updateQuery = `
            UPDATE users 
            SET password_hash = $1, is_first_login = false, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = $2
        `;
        await pool.query(updateQuery, [newPasswordHash, userId]);

        // Return success response
        res.json({
            success: true,
            data: {
                message: 'Password change successfully'
            }
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

module.exports = {
    login,
    changePassword
};
