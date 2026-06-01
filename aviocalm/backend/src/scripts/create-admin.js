const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function createAdmin() {
  try {
    const hash = await bcrypt.hash('Admin123!', 10);
    console.log('Generated hash:', hash);
    console.log('Hash length:', hash.length);
    
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, salt, role, is_first_login, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['admin', hash, 'random_salt_here', 'Owner', false, 'System', 'Administrator']
    );
    
    console.log('Insert result:', result.rowCount);
    process.exit(0);
  } catch (err) {
    console.error('Create admin error:', err);
    process.exit(1);
  }
}

createAdmin();
