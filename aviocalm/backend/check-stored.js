const pool = require('./config/db');

async function checkStoredHash() {
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE username = $1', ['admin']);
    const storedHash = result.rows[0].password_hash;
    console.log('Hash from DB (raw):', JSON.stringify(storedHash));
    console.log('Hash from DB (string):', storedHash);
    console.log('Hash length:', storedHash.length);
    
    process.exit(0);
  } catch (err) {
    console.error('Database error:', err);
    process.exit(1);
  }
}

checkStoredHash();
