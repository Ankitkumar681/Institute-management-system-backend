const express = require('express');
const attendanceController = require('../controllers/attendance.controller');
const { authMiddleware, checkRole } = require('../middleware/auth.middleware');

// 🛠️ FIX: Initialize router using the express package instance
const router = express.Router();

router.post(
  '/', 
  authMiddleware, 
  checkRole(['institute_admin', 'staff', 'class_teacher']), 
  attendanceController.mark
);

router.get('/', authMiddleware, attendanceController.fetchLogs);
router.get('/roster', authMiddleware, checkRole(['institute_admin', 'staff', 'class_teacher']), attendanceController.fetchClassRoster);
router.post('/bulk', authMiddleware, checkRole(['institute_admin', 'staff', 'class_teacher']), attendanceController.markBulk);
router.get('/export', authMiddleware, attendanceController.exportCSV);
router.get('/export-pdf', authMiddleware, attendanceController.exportPDF)
router.get('/dashboard-analytics', checkRole(['institute_admin', 'staff', 'class_teacher']), attendanceController.fetchDashboardAnalytics);

module.exports = router;
