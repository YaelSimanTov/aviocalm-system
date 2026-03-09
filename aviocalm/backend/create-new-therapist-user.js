const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

const createNewTherapistUser = async () => {
  try {
    // Hash the password with bcrypt
    const password = 'FirstTime123!';
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log('Creating new therapist user...');
    console.log('Username: new_therapist');
    console.log('Password: FirstTime123!');
    console.log('Role: Therapist');
    console.log('is_first_login: true');

    // Insert the new user
    const insertQuery = `
      INSERT INTO users (username, password_hash, salt, role, is_first_login, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING user_id, username, role, is_first_login, first_name, last_name
    `;
    
    const result = await pool.query(insertQuery, [
      'new_therapist',
      passwordHash,
      salt,
      'Therapist',
      true,
      'New',
      'User'
    ]);

    const newUser = result.rows[0];
    console.log('\n✅ New therapist user created successfully:');
    console.log(`User ID: ${newUser.user_id}`);
    console.log(`Username: ${newUser.username}`);
    console.log(`Role: ${newUser.role}`);
    console.log(`is_first_login: ${newUser.is_first_login}`);
    console.log(`Name: ${newUser.first_name} ${newUser.last_name}`);

  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await pool.end();
  }
};

createNewTherapistUser();
