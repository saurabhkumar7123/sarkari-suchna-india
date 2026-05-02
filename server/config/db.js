const mysql = require("mysql2/promise");

function cleanEnvValue(value) {
  return String(value || "")
    .replace(/\s+#.*$/, "")
    .trim();
}

const dbName = cleanEnvValue(process.env.DB_NAME);
const dbHost = cleanEnvValue(process.env.DB_HOST) || "127.0.0.1";
const dbUser = cleanEnvValue(process.env.DB_USER) || "root";
const dbPass = String(process.env.DB_PASS || "");

if (!dbName) {
  // Pool still connects, but unqualified `pages` may resolve incorrectly without a default schema.
  console.warn("[db] DB_NAME is not set — set DB_NAME in .env so INSERT/SELECT use the same database.");
}

const pool = mysql.createPool({
  host: dbHost,
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: dbUser,
  password: dbPass,
  database: dbName,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_LIMIT || "20", 10),
  queueLimit: 0,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || "10000", 10),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: "utf8mb4"
});

module.exports = pool;
