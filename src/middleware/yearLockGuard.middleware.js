const { AcademicYear } = require("../models/index");
const { Op } = require("sequelize");

module.exports = async function yearLockGuard(req, res, next) {
  // 🚀 Allow all GET read requests to bypass the guard safely
  if (req.method === "GET") return next();

  try {
    const instituteId = req.user?.instituteId;
    if (!instituteId) return next(); // Skip if super_admin or unauthenticated

    // Extract academicYearId dynamically from query parameters, request body, or headers
    let targetYearId = req.query?.academicYearId || req.body?.academicYearId || req.headers["x-academic-year-id"];
    let explicitClassId = req.body?.classId || req.query?.classId;

    // 🚀 FIXED: Safe Bulk Tracker Plucker using robust defensive fallback checks
    if (!explicitClassId && req.body?.records && Array.isArray(req.body.records) && req.body.records.length > 0) {
      explicitClassId = req.body.records[0]?.classId; 
    }

    // 🚀 FIXED: Dynamic Database Fallback for Subject Revocation DELETE paths
    // If it's a delete request on a subject link, fetch the row from the database to read its class and year context safely
    if (req.method === "DELETE" && req.params?.assignmentId && !explicitClassId) {
      const { AcademicYearTeacher } = require("../models/index");
      const assignmentRow = await AcademicYearTeacher.findOne({
        where: { id: req.params.assignmentId, instituteId }
      });
      if (assignmentRow) {
        explicitClassId = assignmentRow.classId;
        if (!targetYearId) targetYearId = assignmentRow.academicYearId;
      }
    }

    // Fallback: If we discovered a classId, ensure we fetch the matching classroom container to find its true year context
    if (!targetYearId && explicitClassId) {
      const { Classroom } = require("../models/index");
      const cls = await Classroom.findOne({ where: { id: explicitClassId, instituteId } });
      if (cls) targetYearId = cls.academicYearId;
    }

    // Final Fallback: If no year context is specified or inferred, fall back onto the institute's active cycle
    if (!targetYearId) {
      const activeYear = await AcademicYear.findOne({ where: { instituteId, isActive: true } });
      if (activeYear) targetYearId = activeYear.id;
    }

    // ========================================================================
    // 🔒 GUARD GATE 1: THE GLOBAL HISTORICAL READ-ONLY LOCK CONSTRAINT
    // ========================================================================
    if (targetYearId) {
      const targetYear = await AcademicYear.findOne({ where: { id: targetYearId, instituteId } });
      
      // If the year is explicitly marked as locked, block all data mutations instantly
      if (targetYear && targetYear.isLocked) {
        return res.status(400).json({
          message: `Operational Lock: The academic year "${targetYear.name}" is archived and locked. All records for this cycle are strictly read-only.`
        });
      }
    }

    // ========================================================================
    // 🔒 GUARD GATE 2: SUBJECT TEACHER VS CLASS TEACHER ROLL CALL SHIELD
    // ========================================================================
    const isAttendanceWritePath = req.originalUrl?.includes('/attendance');
    const userRole = req.user?.role;

    if (isAttendanceWritePath && explicitClassId && targetYearId && (userRole === 'class_teacher' || userRole === 'teacher')) {
      const { AcademicYearStaff } = require("../models/index");
      
      const primaryOwnershipRecord = await AcademicYearStaff.findOne({
        where: {
          classId: explicitClassId,
          academicYearId: targetYearId,
          instituteId,
          teacherId: req.user.id 
        }
      });

      if (!primaryOwnershipRecord) {
        return res.status(403).json({
          message: "Authorization Restriction: You are mapped as a Subject Teacher for this room container. You possess read-only permissions to review logs, but cannot modify or submit the roll call."
        });
      }
    }

    next();
  } catch (err) {
    return res.status(500).json({ message: `Lock Guard Exception: ${err.message}` });
  }
};
