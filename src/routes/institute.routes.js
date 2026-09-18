const express = require('express');
const instituteController = require('../controllers/institute.controller');
const { checkRole } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', checkRole(['super_admin']), instituteController.listAllInstitutes);
router.put('/:id/status', checkRole(['super_admin']), instituteController.toggleStatus);
router.post('/', checkRole(['super_admin']), instituteController.createInstitute);
module.exports = router;
