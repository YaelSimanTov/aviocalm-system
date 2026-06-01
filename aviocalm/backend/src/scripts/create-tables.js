/**
 * Simple Table Creation Script
 * Creates tables individually to ensure proper setup
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

class TableCreator {
  constructor() {
    this.tables = [
      {
        name: 'users',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
              user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              username VARCHAR(50) UNIQUE NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              salt VARCHAR(255) NOT NULL,
              role VARCHAR(20) NOT NULL CHECK (role IN ('Owner', 'Therapist')),
              is_first_login BOOLEAN DEFAULT true,
              first_name VARCHAR(100) NOT NULL,
              last_name VARCHAR(100) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      },
      {
        name: 'patients',
        sql: `
          CREATE TABLE IF NOT EXISTS patients (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              national_id VARCHAR(20) UNIQUE NOT NULL,
              full_name VARCHAR(255) NOT NULL,
              phone VARCHAR(20),
              email VARCHAR(255),
              date_of_birth DATE,
              address TEXT,
              medical_history TEXT,
              phobia_type VARCHAR(50) DEFAULT 'Flight',
              phobia_triggers TEXT,
              calming_factors TEXT,
              emergency_contact_name VARCHAR(255),
              emergency_contact_phone VARCHAR(20),
              therapist_id UUID NOT NULL REFERENCES users(user_id),
              status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Discharged')),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      },
      {
        name: 'sessions',
        sql: `
          CREATE TABLE IF NOT EXISTS sessions (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              patient_id UUID NOT NULL REFERENCES patients(id),
              started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              ended_at TIMESTAMP,
              duration_minutes INTEGER,
              overall_hrv_rmssd DECIMAL(5,2),
              status VARCHAR(20) DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'Halted'))
          )
        `
      },
      {
        name: 'anxiety_profiles',
        sql: `
          CREATE TABLE IF NOT EXISTS anxiety_profiles (
              log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              patient_id VARCHAR(20) NOT NULL REFERENCES patients(national_id),
              session_id UUID NOT NULL,
              recorded_at TIMESTAMP NOT NULL,
              vr_state VARCHAR(50) NOT NULL,
              difficulty VARCHAR(50) NOT NULL,
              heart_rate INTEGER,
              stress_score INTEGER,
              spo2 INTEGER,
              therapist_action VARCHAR(50) DEFAULT 'None',
              CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'scene_stress_scores',
        sql: `
          CREATE TABLE IF NOT EXISTS scene_stress_scores (
              score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              session_id UUID NOT NULL,
              patient_id UUID NOT NULL REFERENCES patients(id),
              vr_state VARCHAR(50) NOT NULL,
              difficulty VARCHAR(50) NOT NULL,
              avg_heart_rate DECIMAL(5,2) NOT NULL,
              peak_stress_score DECIMAL(5,2) NOT NULL,
              calculated_weighted_score DECIMAL(5,2) NOT NULL,
              recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT fk_scene_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
          )
        `
      }
    ];
  }

  async createTable(table) {
    try {
      console.log(`[CREATE] Creating table: ${table.name}...`);
      await pool.query(table.sql);
      console.log(`[CREATE] ✓ Table ${table.name} created successfully`);
    } catch (error) {
      if (error.code === '42P07') {
        console.log(`[CREATE] ✓ Table ${table.name} already exists`);
      } else {
        console.error(`[CREATE] ✗ Error creating table ${table.name}:`, error.message);
        throw error;
      }
    }
  }

  async createIndexes() {
    console.log('[CREATE] Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);',
      'CREATE INDEX IF NOT EXISTS idx_patients_therapist ON patients(therapist_id);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);',
      'CREATE INDEX IF NOT EXISTS idx_anxiety_profiles_session ON anxiety_profiles(session_id);',
      'CREATE INDEX IF NOT EXISTS idx_anxiety_profiles_timestamp ON anxiety_profiles(recorded_at);',
      'CREATE INDEX IF NOT EXISTS idx_scene_stress_scores_patient ON scene_stress_scores(patient_id);',
      'CREATE INDEX IF NOT EXISTS idx_scene_stress_scores_session ON scene_stress_scores(session_id);',
      'CREATE INDEX IF NOT EXISTS idx_scene_stress_scores_vrstate ON scene_stress_scores(vr_state);'
    ];

    for (const indexSql of indexes) {
      try {
        await pool.query(indexSql);
      } catch (error) {
        console.warn('[CREATE] Index warning:', error.message);
      }
    }
    
    console.log('[CREATE] ✓ Indexes created');
  }

  async insertDefaultData() {
    console.log('[CREATE] Inserting default data...');
    
    try {
      // Insert default admin user
      await pool.query(`
        INSERT INTO users (username, password_hash, salt, role, is_first_login, first_name, last_name) 
        VALUES ('admin', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQ', 'random_salt_here', 'Owner', false, 'System', 'Administrator')
        ON CONFLICT (username) DO NOTHING
      `);
      console.log('[CREATE] ✓ Default user inserted');
    } catch (error) {
      console.warn('[CREATE] Warning inserting default data:', error.message);
    }
  }

  async run() {
    console.log('[CREATE] Starting table creation...');
    
    try {
      // Create tables one by one
      for (const table of this.tables) {
        await this.createTable(table);
      }
      
      // Create indexes
      await this.createIndexes();
      
      // Insert default data
      await this.insertDefaultData();
      
      // Verify tables
      await this.verifyTables();
      
      console.log('[CREATE] ===== TABLE CREATION COMPLETED =====');
      console.log('[CREATE] All tables are now ready for data seeding');
      console.log('[CREATE] ===================================');
      
    } catch (error) {
      console.error('[CREATE] Table creation failed:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  async verifyTables() {
    console.log('[CREATE] Verifying table creation...');
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = result.rows.map(row => row.table_name);
    console.log(`[CREATE] Found ${tables.length} tables:`, tables);
    
    const expectedTables = ['users', 'patients', 'sessions', 'anxiety_profiles', 'scene_stress_scores'];
    const missingTables = expectedTables.filter(table => !tables.includes(table));
    
    if (missingTables.length > 0) {
      console.error('[CREATE] Missing expected tables:', missingTables);
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    } else {
      console.log('[CREATE] ✓ All expected tables are present');
    }
    
    return tables;
  }
}

// Run if executed directly
if (require.main === module) {
  const creator = new TableCreator();
  creator.run().catch(console.error);
}

module.exports = TableCreator;
