const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

const checkTherapistFirstLogin = async () => {
  try {
    const result = await pool.query(
      'SELECT username, is_first_login FROM users WHERE username = $1',
      ['therapist_test']
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log(`User: ${user.username}`);
      console.log(`is_first_login: ${user.is_first_login}`);
      
      if (user.is_first_login === true) {
        console.log('✅ therapist_test has is_first_login = true - will redirect to change password');
      } else {
        console.log('❌ therapist_test has is_first_login = false - will redirect to dashboard');
        console.log('Updating to true for testing...');
        await pool.query(
          'UPDATE users SET is_first_login = true WHERE username = $1',
          ['therapist_test']
        );
        console.log('✅ Updated therapist_test to is_first_login = true');
      }
    } else {
      console.log('❌ therapist_test not found in database');
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
};

checkTherapistFirstLogin();
