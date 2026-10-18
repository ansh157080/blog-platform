const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blog_platform',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Test connection on initialization
pool.getConnection()
  .then((conn) => {
    console.log(`[Database] Connected successfully to MySQL database "${process.env.DB_NAME || 'blog_platform'}" at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
    conn.release();
  })
  .catch((err) => {
    console.error('[Database Error] Failed to connect to MySQL:', err.message);
    console.error('Make sure MySQL is running in XAMPP and "database.sql" has been imported.');
  });

module.exports = pool;
