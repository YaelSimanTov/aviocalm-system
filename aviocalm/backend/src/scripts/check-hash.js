const pool = require('../config/db');

async function checkHash() {
  try {
    const result = await pool.query('SELECT username, password_hash FROM users WHERE username = $1', ['admin']);
    console.log('Current hash in DB:', result.rows[0].password_hash);
    process.exit(0);
  } catch (err) {
    console.error('Database error:', err);
    process.exit(1);
  }
}

checkHash();
