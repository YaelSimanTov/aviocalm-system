const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'aviocalm',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5433,
});

async function runMigration() {
  try {
    console.log('[MIGRATION] Reading migration file...');
    const migrationSQL = fs.readFileSync('./migrations/add_treatment_decisions_and_session_difficulties.sql', 'utf8');
    
    console.log('[MIGRATION] Executing migration...');
    await pool.query(migrationSQL);
    
    console.log('[MIGRATION] Migration executed successfully');
    
    // Verify tables exist
    const checkTreatmentDecisions = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'treatment_decisions'
      );
    `);
    
    const checkSessionDifficultyLevels = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'session_difficulty_levels'
      );
    `);
    
    console.log('[MIGRATION] Verification:');
    console.log(`  - treatment_decisions table exists: ${checkTreatmentDecisions.rows[0].exists}`);
    console.log(`  - session_difficulty_levels table exists: ${checkSessionDifficultyLevels.rows[0].exists}`);
    
  } catch (error) {
    console.error('[MIGRATION ERROR]', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('[SUCCESS] Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[FAILURE] Migration failed:', error);
    process.exit(1);
  });
