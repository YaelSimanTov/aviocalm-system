const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

const verifyNewTherapistUser = async () => {
  try {
    console.log('Verifying new therapist user...\n');

    // Query to verify the user
    const query = 'SELECT user_id, username, role, is_first_login, first_name, last_name FROM users WHERE username = $1';
    const result = await pool.query(query, ['new_therapist']);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ User found in database:');
      console.log(`User ID: ${user.user_id}`);
      console.log(`Username: ${user.username}`);
      console.log(`Role: ${user.role}`);
      console.log(`is_first_login: ${user.is_first_login}`);
      console.log(`Name: ${user.first_name} ${user.last_name}`);
      
      // Verify is_first_login is true
      if (user.is_first_login === true) {
        console.log('\n✅ CONFIRMED: is_first_login is set to true');
        console.log('✅ User is ready for testing the Force Password Change flow');
      } else {
        console.log('\n❌ ERROR: is_first_login is not true');
        console.log(`Actual value: ${user.is_first_login} (type: ${typeof user.is_first_login})`);
      }
    } else {
      console.log('❌ User not found in database');
    }

    // Also check all therapist users for reference
    console.log('\n--- All Therapist Users ---');
    const allTherapistsQuery = 'SELECT username, is_first_login FROM users WHERE role = $1 ORDER BY username';
    const allTherapists = await pool.query(allTherapistsQuery, ['Therapist']);
    
    allTherapists.rows.forEach(therapist => {
      console.log(`${therapist.username}: is_first_login = ${therapist.is_first_login}`);
    });
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
};

verifyNewTherapistUser();
