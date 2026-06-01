/**
 * Reset Admin User Script
 * Creates or updates admin user with known credentials
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

async function resetAdminUser() {
  try {
    console.log('[RESET ADMIN] Starting admin user reset...');
    
    // Hash the password
    const saltRounds = 10;
    const plainPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);
    
    console.log(`[RESET ADMIN] Password hashed successfully`);
    
    // Check if admin user exists
    const existingUser = await pool.query('SELECT user_id FROM users WHERE username = $1', ['admin']);
    
    if (existingUser.rows.length > 0) {
      // Update existing admin user
      await pool.query(
        'UPDATE users SET password_hash = $1, salt = $2, is_first_login = true WHERE username = $3',
        [passwordHash, 'random_salt_here', 'admin']
      );
      console.log('[RESET ADMIN] Updated existing admin user');
    } else {
      // Create new admin user
      const adminId = '550e8400-e29b-41d4-a716-446655440001'; // Fixed UUID for consistency
      await pool.query(
        `INSERT INTO users (user_id, username, password_hash, salt, role, is_first_login, first_name, last_name) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, 'admin', passwordHash, 'random_salt_here', 'Owner', true, 'System', 'Administrator']
      );
      console.log('[RESET ADMIN] Created new admin user');
    }
    
    console.log('[RESET ADMIN] Admin user reset completed successfully');
    console.log(`[RESET ADMIN] Username: admin`);
    console.log(`[RESET ADMIN] Password: ${plainPassword}`);
    console.log(`[RESET ADMIN] Role: Owner`);
    
  } catch (error) {
    console.error('[RESET ADMIN] Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

resetAdminUser();
