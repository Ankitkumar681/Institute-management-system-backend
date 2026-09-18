const rateLimit = require('express-rate-limit');

// 🚀 SHIELD DEFINITION 1: Global Brute-Force Login Gateway Clamper
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minutes window tracker parameter
  max: 5, // ⚡ STRICT BOUNDARY: Permits a maximum of 5 login attempts per IP per 15 minutes!
  message: {
    message: "Too many login attempts captured from this link node. Authentication gateway frozen for 15 minutes to protect tenant integrity."
  },
  standardHeaders: true, // Return standard rate limit info headers
  legacyHeaders: false, // Disable the X-RateLimit-* headers
});

// 🚀 SHIELD DEFINITION 2: Forgot Password Token Request Limiter
const recoveryRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 Minutes window tracker parameter
  max: 3, // ⚡ STRICT BOUNDARY: Permits a maximum of 3 passcode token requests per 30 minutes!
  message: {
    message: "Too many password recovery triggers requested from this node IP. Gateway locked for 30 minutes to mitigate token flooding exploits."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authRateLimiter,
  recoveryRateLimiter
};
