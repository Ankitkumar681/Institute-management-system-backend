const express = require('express');
const classroomController = require('../controllers/classroom.controller');
const { checkRole } = require('../middleware/auth.middleware'); // Only import checkRole now

const router = express.Router();

// ⚡ The authMiddleware is already executed globally in app.js before reaching here
router.post('/', checkRole(['institute_admin']), classroomController.create);
router.get('/', checkRole(['institute_admin', 'staff', 'class_teacher']), classroomController.getAll);
router.delete('/:id', checkRole(['institute_admin']), classroomController.deleteClass);
router.put('/:id', checkRole(['institute_admin']), classroomController.updateClass);

module.exports = router;
