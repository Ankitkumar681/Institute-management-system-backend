const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/db');
const User = require('../models/User');
require('dotenv').config();

const seedSuperAdmin = async () => {
  try {
    const dbName = process.env.DB_NAME || 'institute_db';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbHost = process.env.DB_HOST || '127.0.0.1';

    console.log(`🔄 Step 1: Connecting directly to MySQL at ${dbHost}...`);
    
    // 1. Create a direct database connection omitting the database name string
    const rawConnection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPassword,
    });

    // 2. Force create the database container if missing
    await rawConnection.query(`CREATE DATABASE IF NOT EXISTS \`\${dbName}\`;`);
    await rawConnection.end();
    console.log(`✅ Step 2: Database container '${dbName}' confirmed/created.`);

    // 3. Now initialize Sequelize schema sync structure safely
    console.log('🔄 Step 3: Syncing Sequelize tables...');
    await sequelize.sync({ alter: true });

    // 4. Check if a Super Admin is already sitting inside the DB
    const adminExists = await User.findOne({ where: { role: 'super_admin' } });
    if (adminExists) {
      console.log('⚠️ Super Admin already exists in the system. Skipping seed.');
      process.exit(0);
    }

    // 5. Define root credentials
    const rootEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@system.com';
    const rootPassword = process.env.SUPER_ADMIN_PASSWORD || 'SecureRootPass123!';
    const hashedPassword = await bcrypt.hash(rootPassword, 10);

    // 6. Create the row record
    await User.create({
      name: 'Global System Root',
      email: rootEmail,
      password: hashedPassword,
      role: 'super_admin',
      instituteId: null
    });

    console.log('🎉 Super Admin seeded successfully!');
    console.log(`📧 Email: ${rootEmail}`);
    console.log(`🔑 Password: ${rootPassword}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Provisioning failure during execution:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
