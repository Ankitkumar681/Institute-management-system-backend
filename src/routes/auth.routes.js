const express = require("express");
const authController = require("../controllers/auth.controller");

// 🚀 DUAL-FALLBACK INTERCEPTOR: Loads middleware seamlessly whether it's exported as a default function or named object!
const middlewareModule = require('../middleware/auth.middleware');
const authMiddleware = typeof middlewareModule === 'function' 
  ? middlewareModule 
  : (middlewareModule.authMiddleware || middlewareModule.protect || middlewareModule.verifyToken);

const router = express.Router();

// 🔍 TRACER RE-VERIFICATION
const { authRateLimiter, recoveryRateLimiter } = require('../middleware/rateLimiter.middleware');

// Public Authentication endpoints (Bypasses global middleware tokens via app.js ordering)
router.post("/register", authController.register);
router.post("/login", authRateLimiter, authController.login);

// Secure real-time heartbeat status gate (Line 16 target fix resolved safely)
router.get('/check-status', authMiddleware, authController.checkStatus);
router.post('/forgot-password', recoveryRateLimiter, authController.requestPasswordReset);
router.post('/reset-password', authRateLimiter, authController.confirmPasswordReset);

module.exports = router;
