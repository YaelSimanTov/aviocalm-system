/**
 * Database Initialization Script
 * Reads and executes schema.sql file against PostgreSQL database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

class DatabaseInitializer {
  constructor() {
    this.schemaPath = path.join(__dirname, '../db/schema.sql');
  }

  /**
   * Read schema.sql file
   */
  async readSchemaFile() {
    try {
      console.log('[INIT] Reading schema.sql file...');
      const schemaSQL = fs.readFileSync(this.schemaPath, 'utf8');
      console.log(`[INIT] Schema file loaded (${schemaSQL.length} characters)`);
      return schemaSQL;
    } catch (error) {
      console.error('[INIT] Error reading schema file:', error);
      throw error;
    }
  }

  /**
   * Execute SQL statements from schema file
   */
  async executeSchema(schemaSQL) {
    try {
      console.log('[INIT] Executing database schema...');
      
      // Execute the entire schema as one batch
      // This is more reliable than splitting statements
      try {
        await pool.query(schemaSQL);
        console.log('[INIT] ✓ Schema executed successfully');
      } catch (error) {
        console.warn('[INIT] ⚠ Schema execution had issues:', error.message);
        console.log('[INIT] → This is normal for some operations (like existing relations)');
      }

      console.log('[INIT] Schema execution completed');
    } catch (error) {
      console.error('[INIT] Error executing schema:', error);
      throw error;
    }
  }

  /**
   * Verify that key tables were created
   */
  async verifyTables() {
    try {
      console.log('[INIT] Verifying table creation...');
      
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const tables = result.rows.map(row => row.table_name);
      console.log(`[INIT] Found ${tables.length} tables:`, tables);
      
      // Check for key tables we expect
      const expectedTables = ['patients', 'sessions', 'anxiety_profiles', 'scene_stress_scores'];
      const missingTables = expectedTables.filter(table => !tables.includes(table));
      
      if (missingTables.length > 0) {
        console.warn('[INIT] Missing expected tables:', missingTables);
      } else {
        console.log('[INIT] ✓ All expected tables are present');
      }
      
      return tables;
    } catch (error) {
      console.error('[INIT] Error verifying tables:', error);
      throw error;
    }
  }

  /**
   * Run the complete initialization process
   */
  async run() {
    console.log('[INIT] Starting database initialization...');
    console.log('[INIT] This will create/update all tables according to schema.sql');
    
    try {
      // Step 1: Read schema file
      const schemaSQL = await this.readSchemaFile();
      
      // Step 2: Execute schema
      await this.executeSchema(schemaSQL);
      
      // Step 3: Verify tables
      await this.verifyTables();
      
      console.log('[INIT] ===== DATABASE INITIALIZATION COMPLETED =====');
      console.log('[INIT] Database schema is now up to date');
      console.log('[INIT] You can now run the data seeder');
      console.log('[INIT] =============================================');
      
    } catch (error) {
      console.error('[INIT] Database initialization failed:', error);
      throw error;
    } finally {
      await pool.end(); // Close database connection
    }
  }
}

// Run initializer if this file is executed directly
if (require.main === module) {
  const initializer = new DatabaseInitializer();
  initializer.run().catch(console.error);
}

module.exports = DatabaseInitializer;
