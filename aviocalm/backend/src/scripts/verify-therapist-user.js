const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'aviocalm',
  user: 'postgres',
  password: 'postgres'
});

async function verifyTherapistUser() {
  try {
    console.log('🔍 Verifying therapist user creation...\n');
    
    // Query the therapist user
    const result = await pool.query(
      'SELECT user_id, username, role, is_first_login, first_name, last_name, created_at FROM users WHERE username = $1',
      ['therapist_test']
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Therapist user found in database:');
      console.log('User ID:', user.user_id);
      console.log('Username:', user.username);
      console.log('Role:', user.role);
      console.log('First Name:', user.first_name);
      console.log('Last Name:', user.last_name);
      console.log('First Login Required:', user.is_first_login);
      console.log('Created At:', user.created_at);
      
      console.log('\n📋 All users in database:');
      const allUsers = await pool.query(
        'SELECT username, role, is_first_login FROM users ORDER BY created_at'
      );
      allUsers.rows.forEach(user => {
        console.log(`- ${user.username} (${user.role}) - First login: ${user.is_first_login}`);
      });
      
    } else {
      console.log('❌ Therapist user not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error verifying therapist user:', error);
  } finally {
    await pool.end();
  }
}

verifyTherapistUser();
