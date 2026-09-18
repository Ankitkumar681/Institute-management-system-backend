const { Parser } = require("json2csv");
const attendanceService = require("../services/attendance.service");
const AttendanceResource = require("../resources/attendance.resource");
const { User } = require("../models/index");

class AttendanceController {
  async mark(req, res) {
    try {
      const record = await attendanceService.markAttendance(req.body, req.user);
      return res.status(201).json({
        message: "Attendance recorded successfully",
        data: AttendanceResource.single(record),
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  async fetchLogs(req, res) {
    try {
      const { search, searchLog, date = "", page = 1, limit = 10 } = req.query;

      // Fallback merge supporting both param variant bindings
      let activeSearchQuery = "";
      if (searchLog && String(searchLog).trim() !== "") {
        activeSearchQuery = String(searchLog).trim();
      } else if (search && String(search).trim() !== "") {
        activeSearchQuery = String(search).trim();
      }
      const dataContext = await attendanceService.fetchAttendanceLogs(
        req.user,
        {
          search: activeSearchQuery,
          date,
          page,
          limit,
        },
      );

      return res.json(dataContext);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async fetchClassRoster(req, res) {
    try {
      const { classId } = req.query;
      const { role, classId: assignedClassId } = req.user;

      // 🚀 FIX: Fallback to lookup the user live if the token payload field is unpopulated
      let instituteId = req.user.instituteId;
      if (!instituteId) {
        const dbUser = await User.findByPk(req.user.id);
        instituteId = dbUser ? dbUser.instituteId : null;
      }

      // 🚀 ENFORCE RESTRICTION GUARD FOR CLASS TEACHERS
      if (role === "class_teacher") {
        if (!assignedClassId) {
          return res.status(403).json({
            message:
              "Access Denied: You have not been assigned to manage any classroom container yet.",
          });
        }
        if (assignedClassId !== classId) {
          return res.status(403).json({
            message:
              "Access Denied: You are strictly restricted from loading roster boundaries outside your assigned class.",
          });
        }
      }

      const roster = await attendanceService.getClassStudents(
        instituteId,
        classId,
      );

      return res.json(roster);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async markBulk(req, res) {
    try {
      const { records } = req.body;
      await attendanceService.markBulkAttendance(records, req.user);
      return res
        .status(201)
        .json({ message: "Bulk attendance logs registered cleanly!" });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async exportCSV(req, res) {
    try {
      // 1. Fetch raw logs using the existing multi-tenant isolation service wrapper
      const rawLogs = await attendanceService.fetchAttendanceLogs(req.user);

      // 2. Flatten relational joins for spreadsheet columns mapping
      const flattenedData = rawLogs.map((log) => ({
        Date: log.date,
        Classroom: log.classId,
        "Student Name": log.student ? log.student.name : "N/A",
        "Student Email": log.student ? log.student.email : "N/A",
        Status: log.status,
      }));

      // 3. Parse json array stack blocks down into formatted string rows
      const json2csvParser = new Parser({
        fields: [
          "Date",
          "Classroom",
          "Student Name",
          "Student Email",
          "Status",
        ],
      });
      const csvData = json2csvParser.parse(flattenedData);

      // 4. Force browser attachment downloader header parameters
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=attendance_report.csv",
      );

      return res.status(200).send(csvData);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async fetchDashboardAnalytics(req, res) {
    try {
      const analyticsData =
        await attendanceService.fetchInstituteDashboardMetrics(req.user);
      return res.json(analyticsData);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
}

module.exports = new AttendanceController();
