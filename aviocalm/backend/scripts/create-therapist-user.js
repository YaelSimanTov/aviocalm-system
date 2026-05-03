const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'aviocalm',
  user: 'postgres',
  password: 'postgres'
});

async function createTherapistUser() {
  try {
    // User details
    const username = 'therapist_test';
    const plainPassword = 'Password123!';
    const role = 'Therapist';
    const firstName = 'Test';
    const lastName = 'Therapist';
    
    // Generate salt and hash password
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(plainPassword, salt);
    
    console.log('Generated salt:', salt);
    console.log('Generated hash:', passwordHash);
    
    // Insert user into database
    const insertQuery = `
      INSERT INTO users (username, password_hash, salt, role, is_first_login, first_name, last_name) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING user_id, username, role, is_first_login;
    `;
    
    const values = [username, passwordHash, salt, role, true, firstName, lastName];
    const result = await pool.query(insertQuery, values);
    
    console.log('\n✅ Therapist user created successfully!');
    console.log('User details:', result.rows[0]);
    console.log('\nLogin credentials:');
    console.log('Username:', username);
    console.log('Password:', plainPassword);
    console.log('Role:', role);
    console.log('First Login:', true);
    
  } catch (error) {
    console.error('❌ Error creating therapist user:', error);
    
    // Check if it's a duplicate username error
    if (error.code === '23505') {
      console.log('\n💡 Username "therapist_test" already exists. Try a different username.');
    }
  } finally {
    await pool.end();
  }
}

createTherapistUser();
