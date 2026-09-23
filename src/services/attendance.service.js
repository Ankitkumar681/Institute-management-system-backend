const attendanceRepository = require("../repositories/attendance.repository");
const userRepository = require("../repositories/user.repository");
const {
  Attendance,
  User,
  Classroom,
  AcademicYear,
  AcademicYearStudent,
} = require("../models/index");
const crypto = require("crypto");
const { Op } = require("sequelize");

class AttendanceService {
  async markAttendance(data, actor) {
    const { studentId, date, status } = data;
    let { classId, academicYearId } = data;
    const { AcademicYear, AcademicYearStudent } = require("../models/index");

    // 🚀 STEP 1: Fall back safely onto the institute's active cycle if no year context is specified
    if (!academicYearId && AcademicYear) {
      const activeYear = await AcademicYear.findOne({
        where: { instituteId: actor.instituteId, isActive: true },
      });
      if (activeYear) academicYearId = activeYear.id;
    }

    // 🚀 STEP 2: COLUMN-BASED LOCK GUARD
    // Reads the newly added 'isLocked' database column flag directly
    if (academicYearId && AcademicYear) {
      const targetYear = await AcademicYear.findByPk(academicYearId);
      if (targetYear && targetYear.isLocked) {
        const lockError = new Error(
          "Operational Blockade: This academic year track has been archived and locked. Attendance records for this cycle are read-only.",
        );
        lockError.statusCode = 400;
        throw lockError;
      }
    }

    // 🚀 STEP 3: TIMELINE OVERRIDE GATE
    if (academicYearId && AcademicYearStudent) {
      const accuratePlacement = await AcademicYearStudent.findOne({
        where: { studentId, academicYearId, instituteId: actor.instituteId },
      });

      if (accuratePlacement) {
        classId = accuratePlacement.classId;
      }
    }

    return await attendanceRepository.create({
      id: require("crypto").randomUUID(),
      instituteId: actor.instituteId,
      markedBy: actor.id,
      studentId,
      classId: classId || data.classId,
      date,
      status,
      academicYearId: academicYearId || null,
    });
  }

  async markBulkAttendance(records, user, academicYearId = null) {
    if (!records || !Array.isArray(records)) {
      const error = new Error("Malformed bulk records collection parameters.");
      error.statusCode = 400;
      throw error;
    }

    const { AcademicYear, AcademicYearStudent } = require("../models/index");
    let targetYearId = academicYearId;

    if (
      !targetYearId &&
      targetYearId !== "0" &&
      targetYearId !== "undefined" &&
      AcademicYear
    ) {
      const activeYear = await AcademicYear.findOne({
        where: { instituteId: user.instituteId, isActive: true },
      });
      if (activeYear) targetYearId = activeYear.id;
    }

    // 🚀 STEP 2: COLUMN-BASED LOCK GUARD (BULK DESK)
    // Rejects bulk overrides immediately if the database row flag reflects a locked cycle track
    if (targetYearId && AcademicYear) {
      const targetYear = await AcademicYear.findByPk(targetYearId);
      if (targetYear && targetYear.isLocked) {
        const lockError = new Error(
          "Operational Blockade: This academic year track has been archived and locked. Attendance records for this cycle are read-only.",
        );
        lockError.statusCode = 400;
        throw lockError;
      }
    }

    const formattedRecords = [];

    for (const record of records) {
      let finalClassId = record.classId;

      if (targetYearId && AcademicYearStudent) {
        const truePlacement = await AcademicYearStudent.findOne({
          where: {
            studentId: record.studentId,
            academicYearId: targetYearId,
            instituteId: user.instituteId,
          },
        });
        if (truePlacement) {
          finalClassId = truePlacement.classId;
        }
      }

      formattedRecords.push({
        id: require("crypto").randomUUID(),
        studentId: record.studentId,
        classId: finalClassId,
        instituteId: user.instituteId,
        date: record.date,
        status: record.status,
        academicYearId: targetYearId,
      });
    }

    return await Attendance.bulkCreate(formattedRecords, {
      updateOnDuplicate: ["status", "classId", "academicYearId", "updatedAt"],
    });
  }
  async fetchAttendanceLogs(user, queryParameters = {}) {
    const {
      search,
      date,
      page = 1,
      limit = 10,
      academicYearId,
    } = queryParameters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereCondition = {};

    // 1. Setup multi-tenant and role isolation parameters
    if (user.role === "student") {
      whereCondition.studentId = user.id;
      whereCondition.instituteId = user.instituteId;
    } else if (user.role === "class_teacher") {
      // 🚀 THE TEACHER ISOLATION LAYER: Restrict to logs matching their assigned rooms for this year
      whereCondition.instituteId = user.instituteId;

      const { AcademicYearStaff } = require("../models/index");

      // Look up what classrooms this specific teacher owned during the targeted academic year frame
      const activeAssignments = await AcademicYearStaff.findAll({
        where: {
          teacherId: user.id,
          academicYearId: academicYearId || null,
          instituteId: user.instituteId,
        },
        attributes: ["classId"],
        raw: true,
      });

      const assignedClassIds = activeAssignments.map((a) => a.classId);

      // Force the attendance lookup to filter only by their year-specific class allocations
      whereCondition.classId = {
        [Op.in]:
          assignedClassIds.length > 0
            ? assignedClassIds
            : ["_FORCE_EMPTY_RESULT_"],
      };
    } else if (user.role !== "super_admin") {
      // 🏛️ INSTITUTE ADMINS & STAFF: View all logs under their school workspace tenant channel boundary natively
      whereCondition.instituteId = user.instituteId;
    }

    if (date && date !== "") {
      whereCondition.date = date;
    }

    // Append academicYearId filter constraint into the primary log condition if active
    if (
      academicYearId &&
      academicYearId !== "" &&
      academicYearId !== "undefined"
    ) {
      whereCondition.academicYearId = academicYearId;
    }

    let studentIncludeWhere = {};
    let isSearching = false;

    if (search && String(search).trim().length > 0) {
      isSearching = true;
      studentIncludeWhere[Op.or] = [
        { name: { [Op.like]: `%${String(search).trim()}%` } },
        { email: { [Op.like]: `%${String(search).trim()}%` } },
      ];
    }

    const { count, rows } = await Attendance.findAndCountAll({
      where: whereCondition,
      distinct: true,
      limit: parseInt(limit),
      offset: offset,
      include: [
        {
          model: User,
          as: "student",
          where: isSearching ? studentIncludeWhere : null,
          attributes: ["id", "name", "email"],
          required: isSearching ? true : false,
        },
        {
          model: Classroom,
          as: "classroom",
          attributes: ["id", "name", "section"],
        },
      ],
      order: [
        ["date", "DESC"],
        ["createdAt", "DESC"],
      ], // Ordered sequentially by calendar dates
    });

    return {
      totalRecords: count,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage: parseInt(page),
      limit: parseInt(limit),
      records: rows,
    };
  }
  async getClassStudents(instituteId, classId, academicYearId = null) {
    let targetYearId = academicYearId;

    // Fallback: If no year constraint is explicitly passed, read the school's primary active cycle
    if (
      (!targetYearId || targetYearId === "undefined" || targetYearId === "") &&
      AcademicYear
    ) {
      const activeYear = await AcademicYear.findOne({
        where: { instituteId, isActive: true },
      });
      if (activeYear) targetYearId = activeYear.id;
    }

    // If an academic year configuration block is parsed, extract student profiles from the timeline log entries
    if (targetYearId && AcademicYearStudent) {
      const historyMappings = await AcademicYearStudent.findAll({
        where: { classId, academicYearId: targetYearId, instituteId },
        include: [
          {
            model: User,
            as: "student",
            where: { role: "student" },
            attributes: ["id", "name", "email"],
          },
        ],
        order: [[{ model: User, as: "student" }, "name", "ASC"]],
      });

      // Flatten the relational payload object structure for direct frontend backwards compatibility
      return historyMappings.map((mapping) => mapping.student).filter(Boolean);
    }

    // Default Retro-Fallback (Keeps your recent onboarding parameters functional if no years are configured yet)
    return await userRepository.find({
      role: "student",
      classId: classId,
      instituteId: instituteId,
    });
  }

  async fetchInstituteDashboardMetrics(user, academicYearId = "") {
    const {
      Classroom,
      AcademicYearStaff,
      Attendance,
      User,
      AcademicYear,
    } = require("../models/index");
    const { Op } = require("sequelize");
    const instituteId = user.instituteId;

    // 🚀 STEP 1: Resolve Target Academic Year Context Fallback
    let targetYearId = academicYearId;
    if (!targetYearId && targetYearId !== "0" && targetYearId !== "undefined") {
      const activeYear = await AcademicYear.findOne({
        where: { instituteId, isActive: true },
      });
      if (activeYear) targetYearId = activeYear.id;
    }

    // 🚀 STEP 2: BUILD YEAR AND ROLE ISOLATION CONDITIONS
    let classroomWhere = { instituteId };
    let attendanceWhere = { instituteId };

    if (targetYearId) {
      classroomWhere.academicYearId = targetYearId;
      attendanceWhere.academicYearId = targetYearId;
    }

    // 🔒 THE CLASS TEACHER ENVELOPE FILTER
    if (user.role === "class_teacher") {
      const activeAssignments = await AcademicYearStaff.findAll({
        where: {
          teacherId: user.id,
          instituteId,
          ...(targetYearId && { academicYearId: targetYearId }),
        },
        attributes: ["classId"],
        raw: true,
      });
      const assignedClassIds = activeAssignments.map((a) => a.classId);

      // Strict constraint override: Force queries to only see their year-specific class allocations
      const targetedIds =
        assignedClassIds.length > 0 ? assignedClassIds : ["_FORCE_EMPTY_"];
      classroomWhere.id = { [Op.in]: targetedIds };
      attendanceWhere.classId = { [Op.in]: targetedIds };
    }

    // 🚀 STEP 3: COMPUTE GLOBAL STATS FOR DASHBOARD CARDS ACCORDING TO ROLE FILTER BOUNDARIES
    const roleIsolatedLogs = await Attendance.findAll({
      where: attendanceWhere,
      attributes: ["status", "classId"],
      raw: true,
    });

    let totalLogs = roleIsolatedLogs.length;
    let presentRate = 0;
    let absentRate = 0;

    if (totalLogs > 0) {
      const presentCount = roleIsolatedLogs.filter(
        (l) => l.status === "Present" || l.status === "Late",
      ).length;
      presentRate = Math.round((presentCount / totalLogs) * 100);
      absentRate = 100 - presentRate;
    }

    // 🚀 STEP 4: FETCH PERFORMANCE MATRIX ARRAYS FOR EACH CLASSROOM
    const classrooms = await Classroom.findAll({
      where: classroomWhere,
      order: [
        ["name", "ASC"],
        ["section", "ASC"],
      ],
    });

    const classroomMatrix = [];

    for (const cls of classrooms) {
      // Find who the teacher assigned to this classroom was for this year cycle
      const staffMap = await AcademicYearStaff.findOne({
        where: {
          classId: cls.id,
          instituteId,
          ...(targetYearId && { academicYearId: targetYearId }),
        },
        include: [{ model: User, as: "teacher", attributes: ["name"] }],
      });

      // Pull log subsets for this row node
      const clsLogs = roleIsolatedLogs.filter(
        (l) => String(l.classId) === String(cls.id),
      );
      const clsTotal = clsLogs.length;
      const clsPresent = clsLogs.filter(
        (l) => l.status === "Present" || l.status === "Late",
      ).length;

      // Formulates total class rate precisely, safeguarding against NaN or 0 display bugs
      const clsRate =
        clsTotal > 0 ? Math.round((clsPresent / clsTotal) * 100) : 0;

      classroomMatrix.push({
        id: cls.id,
        name: cls.name,
        section: cls.section,
        teacherName: staffMap?.teacher?.name || "Unassigned Faculty",
        totalLogs: clsTotal,
        rate: clsRate,
      });
    }

    // 🚀 STEP 5: RETURN COMPILED ENVELOPE TRANSPARENTLY TO THE CONTROLLER LAYER
    return {
      analytics: {
        totalLogs,
        presentRate,
        absentRate,
      },
      classMetrics: classroomMatrix,
    };
  }
  async fetchRecordsForExport(user, academicYearId = null) {
    let whereCondition = {};

    if (user.role === "student") {
      whereCondition.studentId = user.id;
      whereCondition.instituteId = user.instituteId;
    } else if (user.role === "class_teacher") {
      whereCondition.instituteId = user.instituteId;

      const { AcademicYearStaff } = require("../models/index");
      const activeAssignments = await AcademicYearStaff.findAll({
        where: {
          teacherId: user.id,
          academicYearId,
          instituteId: user.instituteId,
        },
        attributes: ["classId"],
        raw: true,
      });
      const assignedClassIds = activeAssignments.map((a) => a.classId);
      whereCondition.classId = {
        [Op.in]:
          assignedClassIds.length > 0
            ? assignedClassIds
            : ["_FORCE_EMPTY_RESULT_"],
      };
    } else if (user.role !== "super_admin") {
      whereCondition.instituteId = user.instituteId;
    }

    if (
      academicYearId &&
      academicYearId !== "" &&
      academicYearId !== "undefined"
    ) {
      whereCondition.academicYearId = academicYearId;
    }

    const rows = await Attendance.findAll({
      where: whereCondition,
      include: [
        { model: User, as: "student", attributes: ["id", "name", "email"] },
        {
          model: Classroom,
          as: "classroom",
          attributes: ["id", "name", "section"],
        },
      ],
      order: [
        ["date", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    return { records: rows };
  }

  async fetchPDFData(instituteId, classId, date, academicYearId = null) {
    let logFilterCondition = { classId, date, instituteId };

    if (
      academicYearId &&
      academicYearId !== "" &&
      academicYearId !== "undefined"
    ) {
      logFilterCondition.academicYearId = academicYearId;
    }

    const logs = await Attendance.findAll({
      where: logFilterCondition,
      include: [
        { model: User, as: "student", attributes: ["id", "name", "email"] },
      ],
      order: [["createdAt", "ASC"]],
    });

    const classroom = await Classroom.findOne({
      where: { id: classId, instituteId },
    });

    return { logs, classroom };
  }
}

module.exports = new AttendanceService();
