const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise'); // Import promise-based mysql2 driver
require('dotenv').config();

const dbName = process.env.DB_NAME || 'institute_db';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || '127.0.0.1';

// 1. Instantly spin up a temporary connection to ensure the database container exists
async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`\${dbName}\`;`);
  await connection.end();
}

// Execute the check immediately asynchronously
ensureDatabaseExists()
  .then(() => console.log(`⚙️ Verified database '${dbName}' exists.`))
  .catch((err) => console.error('❌ Failed to auto-create database container:', err));

// 2. Main Sequelize ORM setup
const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = sequelize;
