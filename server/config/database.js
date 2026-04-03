// server/config/database.js

const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

// Create a MySQL connection pool (promise-based)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL database (Pool)");
    connection.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
})();

module.exports = pool; // 👈 export the pool
