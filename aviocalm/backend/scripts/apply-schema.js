/**
 * Apply Epic 6 tables to database
 * This script reads and executes the add-epic6-tables.sql file to add devices and kits tables
 */

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function applyEpic6Tables() {
  try {
    console.log('Reading add-epic6-tables.sql file...');
    const schemaPath = path.join(__dirname, '../src/db/add-epic6-tables.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying Epic 6 tables to database...');
    await pool.query(schemaSql);
    
    console.log('✅ Epic 6 tables applied successfully!');
    console.log('New tables (devices, kits) have been created.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying Epic 6 tables:', error);
    process.exit(1);
  }
}

applyEpic6Tables();
