const { AcademicYear } = require("../models/index");

module.exports = async function yearLockGuard(req, res, next) {
  // 🚀 Allow all GET read requests to bypass the guard safely
  if (req.method === "GET") return next();

  try {
    const instituteId = req.user?.instituteId;
    if (!instituteId) return next(); // Skip if super_admin or unauthenticated

    // Extract academicYearId dynamically from query parameters, request body, or headers
    let targetYearId = req.query.academicYearId || req.body.academicYearId || req.headers["x-academic-year-id"];

    // Fallback: If an endpoint relies on a specific classId, fetch that class to read its year context
    if (!targetYearId && (req.body.classId || req.query.classId)) {
      const { Classroom } = require("../models/index");
      const targetClassId = req.body.classId || req.query.classId;
      const cls = await Classroom.findOne({ where: { id: targetClassId, instituteId } });
      if (cls) targetYearId = cls.academicYearId;
    }

    // If no year context is specified or inferred, fall back onto the institute's active cycle
    if (!targetYearId) {
      const activeYear = await AcademicYear.findOne({ where: { instituteId, isActive: true } });
      if (activeYear) targetYearId = activeYear.id;
    }

    // 🔒 THE GLOBAL LOCK CONSTRAINT GUARD
    if (targetYearId) {
      const targetYear = await AcademicYear.findOne({ where: { id: targetYearId, instituteId } });
      
      // If the year is explicitly marked as locked, block all data mutations instantly
      if (targetYear && targetYear.isLocked) {
        return res.status(400).json({
          message: `Operational Lock: The academic year "${targetYear.name}" is archived and locked. All records for this cycle are strictly read-only.`
        });
      }
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: `Lock Guard Exception: ${err.message}` });
  }
};
