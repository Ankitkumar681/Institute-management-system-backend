const attendanceRepository = require("../repositories/attendance.repository");
const userRepository = require("../repositories/user.repository");
const { Attendance, User, Classroom } = require("../models/index");
const crypto = require("crypto");
const { Op } = require("sequelize");

class AttendanceService {
  async markAttendance(data, actor) {
    const { studentId, classId, date, status } = data;

    return await attendanceRepository.create({
      instituteId: actor.instituteId,
      markedBy: actor.id,
      studentId,
      classId,
      date,
      status,
    });
  }

  async fetchAttendanceLogs(user, queryParameters = {}) {
    const { search, date, page = 1, limit = 10 } = queryParameters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereCondition = {};
    if (user.role === "student") {
      // 🚀 CRITICAL FIX: Force the query to filter EXCLUSIVELY for the logged-in student's records
      whereCondition.studentId = user.id;
      whereCondition.instituteId = user.instituteId;
    } else if (user.role !== "super_admin") {
      // Admins and teachers see all logs under their institute tenant scope boundary
      whereCondition.instituteId = user.instituteId;
    }
    if (date && date !== "") {
      whereCondition.date = date;
    }

    let studentIncludeWhere = {};
    // 🚀 FIX 1: Use an explicit boolean flag variable to track if search parameters are active
    let isSearching = false;

    if (search && String(search).trim().length > 0) {
      isSearching = true; // ⚡ Flag set to true
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
          // 🚀 FIX 2: Evaluate using our clean boolean indicator flag instead of Object.keys() length
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
      order: [["createdAt", "DESC"]],
    });

    return {
      totalRecords: count,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage: parseInt(page),
      limit: parseInt(limit),
      records: rows,
    };
  }
  async getClassStudents(instituteId, classId) {
    // 🚀 FIXED: Replaced non-existent legacy method with the unified BaseRepository query syntax
    return await userRepository.find({
      role: "student",
      classId: classId,
      instituteId: instituteId,
    });
  }

  async markBulkAttendance(records, user) {
    if (!records || !Array.isArray(records)) {
      const error = new Error("Malformed bulk records collection parameters.");
      error.statusCode = 400;
      throw error;
    }

    // 🚀 FIX: Map through the array and inject actual unique string IDs for every row entry
    const formattedRecords = records.map((record) => ({
      id: crypto.randomUUID(), // ⚡ FIX: Injects a real unique string instead of a data type constructor rule!
      studentId: record.studentId,
      classId: record.classId,
      instituteId: user.instituteId, // Securely binds the active user tenant scope boundary
      date: record.date,
      status: record.status,
    }));

    // Commit array batch rows directly using Sequelize bulkCreate engine
    return await Attendance.bulkCreate(formattedRecords, {
      updateOnDuplicate: ["status", "updatedAt"], // If studentId + date matches, simply update their status cell flag!
    });
  }
  async fetchInstituteDashboardMetrics(user) {
    // 1. Setup global multi-tenant validation criteria bounds
    let classroomQueryCondition = { instituteId: user.instituteId };

    // 🚀 FIX: If the user is a class teacher, restrict the query bounds strictly to their assigned classId
    if (user.role === "class_teacher") {
      if (!user.classId) {
        // Return an empty array smoothly if they haven't been assigned to a class room node container yet
        return [];
      }
      classroomQueryCondition.id = user.classId;
    } else if (user.role !== "institute_admin" && user.role !== "staff") {
      // General safety fallback rejection block
      throw Object.assign(
        new Error("Access Denied: Administrative boundaries only."),
        { statusCode: 403 },
      );
    }

    // 2. Fetch the targeted classroom records matching the authorization scope bounds
    const classrooms = await Classroom.findAll({
      where: classroomQueryCondition,
      include: [
        {
          model: User,
          as: "students",
          required: false,
          attributes: ["id", "name", "email", "role"],
        },
      ],
    });

    // 3. Fetch historical logs context under this school tenant channel
    const allLogs = await Attendance.findAll({
      where: { instituteId: user.instituteId },
      attributes: ["classId", "status"],
    });

    // 4. Map, loop, and return the formatted progress analytics matrix rows
    return classrooms.map((cls) => {
      const classLogs = allLogs.filter((log) => log.classId === cls.id);

      let rate = 100;
      if (classLogs.length > 0) {
        const presentCount = classLogs.filter(
          (l) => l.status === "Present" || l.status === "Late",
        ).length;
        rate = Math.round((presentCount / classLogs.length) * 100);
      }

      const membersList = cls.students || [];
      const assignedTeacher = membersList.find(
        (member) => member.role === "class_teacher",
      );

      return {
        id: cls.id,
        name: cls.name,
        section: cls.section,
        totalLogs: classLogs.length,
        rate: rate,
        teacherName: assignedTeacher
          ? assignedTeacher.name
          : "No Teacher Assigned",
      };
    });
  }
  async fetchRecordsForExport(user) {
    let whereCondition = {};
    if (user.role === "student") {
      whereCondition.studentId = user.id;
      whereCondition.instituteId = user.instituteId;
    } else if (user.role !== "super_admin") {
      whereCondition.instituteId = user.instituteId;
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

  async fetchPDFData(instituteId, classId, date) {
    const logs = await Attendance.findAll({
      where: { classId, date, instituteId },
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
