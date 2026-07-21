const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Force every connection in this pool to use UTC so that NOW(),
    // CURRENT_TIMESTAMP, and all TIMESTAMPTZ reads/writes are UTC-based,
    // regardless of the OS timezone of the server or developer machine.
    options:  '-c timezone=UTC',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully at:', res.rows[0].now);
    }
});

module.exports = pool;
