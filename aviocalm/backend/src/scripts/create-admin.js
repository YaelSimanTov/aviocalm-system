require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

// Default credentials — change before running if desired
const USERNAME = 'admin';
const PASSWORD = 'Admin123!';
const SALT_ROUNDS = 10; // Must match the value used in auth-controller.js

async function createAdmin() {
  try {
    const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    // ON CONFLICT DO NOTHING prevents a crash if the admin already exists
    const result = await pool.query(
      `INSERT INTO users
         (username, password_hash, salt, role, is_first_login, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (username) DO NOTHING`,
      [USERNAME, passwordHash, 'bcrypt-managed', 'Owner', false, 'System', 'Administrator']
    );

    if (result.rowCount === 0) {
      console.log(`[create-admin] User "${USERNAME}" already exists — no changes made.`);
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[create-admin] Admin user created successfully.');
      console.log(`  Username : ${USERNAME}`);
      console.log(`  Password : ${PASSWORD}`);
      console.log(`  Role     : Owner`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    process.exit(0);
  } catch (err) {
    console.error('[create-admin] ERROR:', err.message);
    process.exit(1);
  }
}

createAdmin();
