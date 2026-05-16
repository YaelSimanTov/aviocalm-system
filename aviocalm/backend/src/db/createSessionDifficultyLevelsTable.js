const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

async function createSessionDifficultyLevelsTable() {
  try {
    console.log('[DB] Creating session_difficulty_levels table...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS session_difficulty_levels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        difficulty_level VARCHAR(50) NOT NULL CHECK (difficulty_level IN ('Easy', 'Medium', 'Hard', 'None')),
        vr_state VARCHAR(50) NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        duration_seconds INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(createTableQuery);
    console.log('[DB] session_difficulty_levels table created successfully');
    
    // Create index for better performance
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_session_difficulty_levels_session 
      ON session_difficulty_levels(session_id);
    `;
    
    await pool.query(createIndexQuery);
    console.log('[DB] Index idx_session_difficulty_levels_session created successfully');
    
    console.log('[DB] Session difficulty levels table setup completed');
  } catch (error) {
    console.error('[DB ERROR] Failed to create session_difficulty_levels table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Execute the table creation
createSessionDifficultyLevelsTable()
  .then(() => {
    console.log('[SUCCESS] Table creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[FAILURE] Table creation failed:', error);
    process.exit(1);
  });
