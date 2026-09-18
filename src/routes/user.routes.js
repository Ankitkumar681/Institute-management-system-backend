const express = require('express');
const authController = require('../controllers/auth.controller');
const { checkRole } = require('../middleware/auth.middleware');

const router = express.Router();

// 🚀 Secured Directory Endpoints (Enforces Role permissions safely)
router.get('/students', checkRole(['super_admin', 'institute_admin', 'admin', 'staff', 'class_teacher']), authController.listStudents);
router.get('/staff', checkRole(['super_admin', 'institute_admin', 'admin']), authController.listStaff);
router.put('/staff/:id/status', checkRole(['institute_admin']), authController.toggleStaffStatus);
router.put('/staff/assign-class', checkRole(['institute_admin']), authController.assignTeacherClass);

module.exports = router;
