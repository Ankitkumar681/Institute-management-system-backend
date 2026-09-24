const express = require('express');
const cors = require('cors');
require('dotenv').config();

// ⚡ FIX: Import the unified context. This triggers the relationships block automatically!
const { sequelize } = require('./models/index'); 

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const classroomRoutes = require('./routes/classroom.routes');
const instituteRoutes = require('./routes/institute.routes');
const checkTenantStatus = require('./middleware/tenantCheck.middleware');
const { authMiddleware } = require('./middleware/auth.middleware');
const yearLockGuard = require('./middleware/yearLockGuard.middleware');

const app = express();

// Global configurations
app.disable('etag'); 
app.use(cors());
app.use(express.json());

// Routes Orchestration
app.use('/api/auth', authRoutes);
app.use(checkTenantStatus);
app.use(authMiddleware);
app.use('/api', yearLockGuard);
app.use('/api/users', userRoutes); 
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/institutes', instituteRoutes);

const PORT = process.env.PORT || 5000;

// Sync database and spin up server instance
sequelize.authenticate() 
  .then(() => {
    console.log('🚀 MySQL Database Bound and Authenticated Successfully (Sync Layer Suspended)');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`💻 Engine server executing safely on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to bind engine infrastructure:', err);
  });