const { Institute, User } = require("../models/index");

const checkTenantStatus = async (req, res, next) => {
  try {
    // 1. Force explicit zero-cache HTTP headers on all security routing checks
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    if (!req.user || req.user.role === "super_admin") {
      return next();
    }
    const dbUser = await User.findByPk(req.user.id, {
      attributes: ["status", "instituteId"],
    });
    if (dbUser && dbUser.status === "inactive") {
      return res.status(403).json({
        message: "INSTITUTE_SUSPENDED", // Triggers the frontend Axios zero-memory clean wipe instantly
        error: "Your profile has been marked inactive by the administrator.",
      });
    }
    let targetInstituteId = dbUser?.instituteId || req.user.instituteId;

    // 🚀 BULLETPROOF CHECK: If the user is an institute_admin, verify their ID relationship
    if (!targetInstituteId && req.user.role === "institute_admin") {
      const dbUser = await User.findByPk(req.user.id, {
        attributes: ["instituteId"],
      });
      if (dbUser) targetInstituteId = dbUser.instituteId;
    }

    if (targetInstituteId) {
      const school = await Institute.findByPk(targetInstituteId, {
        attributes: ["status"], // High-performance single column cell check
      });

      if (school && school.status === "inactive") {
        return res.status(403).json({
          message: "INSTITUTE_SUSPENDED",
          error:
            "Your institute workspace container has been suspended by the Super Admin.",
        });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = checkTenantStatus;
