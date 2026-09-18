const { body, validationResult } = require('express-validator');

// 1. Interceptor validation pipeline runner matrix
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Collect error messages cleanly to display on your React layout notifications
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

// 2. Rigid validation rules schema for onboarding users
const registerValidationRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Full Name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required')
    .isEmail().withMessage('Please provide a valid official email address'),
  body('password')
    .notEmpty().withMessage('Password configuration field is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long for security safety'),
  body('role')
    .notEmpty().withMessage('Role selection parameters required')
    .isIn(['super_admin', 'admin', 'institute_admin', 'staff', 'class_teacher', 'student'])
    .withMessage('Invalid systemic role assignment context structure')
];

// 3. Validation parameters logic rules for authorization desks
const loginValidationRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email address cannot be submitted empty')
    .isEmail().withMessage('Please enter a valid email structure link'),
  body('password')
    .notEmpty().withMessage('Password input verification required')
];

module.exports = {
  validateRequest,
  registerValidationRules,
  loginValidationRules
};
