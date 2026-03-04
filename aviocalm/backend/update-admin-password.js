const bcrypt = require('bcrypt');
require('dotenv').config();

const { Pool } = require('pg');

async function updateAdminPassword() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });

    try {
        // Generate proper bcrypt hash for "Admin123!"
        const saltRounds = 10;
        const password = 'Admin123!';
        const salt = await bcrypt.genSalt(saltRounds);
        const passwordHash = await bcrypt.hash(password, saltRounds);

        console.log('Generated salt:', salt);
        console.log('Generated hash:', passwordHash);

        // Update the admin user in database
        const updateQuery = `
            UPDATE users 
            SET password_hash = $1, salt = $2 
            WHERE username = 'admin'
        `;
        
        const result = await pool.query(updateQuery, [passwordHash, salt]);
        
        if (result.rowCount > 0) {
            console.log('✅ Admin password updated successfully!');
            console.log('Login credentials:');
            console.log('Username: admin');
            console.log('Password: Admin123!');
        } else {
            console.log('❌ Admin user not found');
        }

    } catch (error) {
        console.error('Error updating admin password:', error);
    } finally {
        await pool.end();
    }
}

updateAdminPassword();
