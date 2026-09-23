const { Parser } = require("json2csv");
const puppeteer = require("puppeteer");
const attendanceService = require("../services/attendance.service");
const AttendanceResource = require("../resources/attendance.resource");
const { User, Classroom } = require("../models/index");

const generateAttendanceHTML = (records, date, classroom) => {
  const className = classroom
    ? `${classroom.name} — ${classroom.section}`
    : "N/A";

  const tableRows = records
    .map((log, index) => {
      const studentName = log.student ? log.student.name : "N/A";
      const studentEmail = log.student ? log.student.email : "N/A";
      const statusColor = log.status === "Present" ? "#047857" : "#b91c1c";

      return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; text-align: center; color: #64748b;">${index + 1}</td>
        <td style="padding: 10px; font-weight: 600; color: #0f172a;">${studentName}</td>
        <td style="padding: 10px; color: #475569;">${studentEmail}</td>
        <td style="padding: 10px; text-align: center; font-weight: 800; text-transform: uppercase; color: ${statusColor};">
            ${log.status}
        </td>
      </tr>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #334155; }
            .header-shelf { border-bottom: 3px solid #0f172a; padding-bottom: 16px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title-area h1 { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; margin: 0; color: #0f172a; }
            .title-area p { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
            .meta-area { text-align: right; font-size: 13px; }
            .meta-badge { font-weight: 700; color: #0f172a; font-size: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background-color: #f8fafc; border: 1px solid #e2e8f0; color: #475569; font-weight: 700; padding: 12px 10px; text-align: left; }
            td { border: 1px solid #e2e8f0; padding: 10px; }
            .footer-signatures { margin-top: 80px; display: flex; justify-content: space-between; }
            .sig-line { width: 200px; text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px; font-size: 11px; color: #64748b; font-weight: 500; }
        </style>
    </head>
    <body>
        <div class="header-shelf">
            <div class="title-area">
                <h1>Attendance Register Statement</h1>
                <p>Class Target: <span class="meta-badge">${className}</span></p>
            </div>
            <div class="meta-area">
                <p>Session Date: <span class="meta-badge">${date}</span></p>
                <p style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Generated Server-Side via Portal Engine</p>
            </div>
        </div>
        ${
          records.length === 0
            ? `
            <div style="padding: 40px; text-align: center; border: 2px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; font-size: 14px;">
                No attendance records exist for the specified date.
            </div>
        `
            : `
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">#</th>
                        <th>Student Full Name</th>
                        <th>Email Address</th>
                        <th style="width: 120px; text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `
        }
        <div class="footer-signatures">
            <div class="sig-line">Class Teacher Signature</div>
            <div class="sig-line">Verified Authority Stamp</div>
        </div>
    </body>
    </html>
  `;
};
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
      const {
        search,
        searchLog,
        date = "",
        page = 1,
        limit = 10,
        academicYearId = "",
      } = req.query;

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
          academicYearId,
        },
      );

      return res.json(dataContext);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async fetchClassRoster(req, res) {
    try {
      const { classId, academicYearId, date } = req.query; // 🚀 ADDED: date variable extraction
      const { role, id: userId } = req.user;
      const instituteId = req.user.instituteId;

      if (!classId || !date) {
        return res.status(400).json({
          message:
            "Parameters Missing: Both classId and date fields are required.",
        });
      }

      // 1. Upgraded Dynamic Year-Aware Security Guard (Preserved exactly)
      if (role === "class_teacher") {
        const { AcademicYearStaff } = require("../models/index");
        let targetYearId = academicYearId;
        if (!targetYearId && targetYearId !== "0") {
          const { AcademicYear } = require("../models/index");
          const activeYear = await AcademicYear.findOne({
            where: { instituteId, isActive: true },
          });
          if (activeYear) targetYearId = activeYear.id;
        }

        const validAssignment = await AcademicYearStaff.findOne({
          where: {
            teacherId: userId,
            classId,
            academicYearId: targetYearId,
            instituteId,
          },
        });

        if (!validAssignment) {
          return res.status(403).json({
            message:
              "Access Denied: You are restricted from loading roster boundaries outside your assigned class.",
          });
        }
      }

      // 2. Fetch all students registered under this classroom cohort for this specific year
      const rosterStudents = await attendanceService.getClassStudents(
        instituteId,
        classId,
        academicYearId,
      );

      // 3. 🚀 THE UPGRADE: Query if logs have already been uploaded on disk for this date + class combo
      const { Attendance } = require("../models/index");
      const existingLogs = await Attendance.findAll({
        where: { classId, date, instituteId, academicYearId },
        attributes: ["studentId", "status"],
        raw: true,
      });

      // Transform existing logs array into a fast hash-map dictionary lookup tool
      const logsMap = {};
      existingLogs.forEach((log) => {
        logsMap[log.studentId] = log.status;
      });

      // 4. Merge existing log statuses dynamically into the student roster array objects
      const compiledRoster = rosterStudents.map((student) => {
        const studentRaw = student.toJSON ? student.toJSON() : student;
        return {
          ...studentRaw,
          // 🔥 If attendance was already uploaded, append it! Otherwise, fall back cleanly to null/default
          existingStatus: logsMap[studentRaw.id] || null,
        };
      });

      return res.json(compiledRoster);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async markBulk(req, res) {
    try {
      const { records } = req.body;
      let { academicYearId = "" } = req.query;

      // 🚀 SAFE GUARD ACCENT: If duplicate query params turn academicYearId into an Array, extract the first string item safely!
      if (Array.isArray(academicYearId)) {
        academicYearId = academicYearId[0];
      }

      await attendanceService.markBulkAttendance(
        records,
        req.user,
        academicYearId,
      );
      return res
        .status(201)
        .json({ message: "Bulk attendance logs registered cleanly!" });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  async exportCSV(req, res) {
    try {
      const { academicYearId = "" } = req.query;
      const result = await attendanceService.fetchRecordsForExport(
        req.user,
        academicYearId,
      );
      const rawLogs = result.records || [];

      const flattenedData = rawLogs.map((log) => {
        const classroomDisplay = log.classroom
          ? `${log.classroom.name} - ${log.classroom.section}`
          : log.classId || "N/A";

        return {
          Date: log.date,
          Classroom: classroomDisplay,
          "Student Name": log.student ? log.student.name : "N/A",
          "Student Email": log.student ? log.student.email : "N/A",
          Status: log.status,
        };
      });

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
      const { academicYearId = "" } = req.query;
      const analyticsData =
        await attendanceService.fetchInstituteDashboardMetrics(
          req.user,
          academicYearId,
        );
      return res.json(analyticsData);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
  async exportPDF(req, res) {
    let browser = null;
    try {
      const { classId, date, academicYearId = "" } = req.query;
      if (!classId || !date) {
        return res.status(400).json({
          message: "Parameters Missing: Both classId and date fields required.",
        });
      }

      let instituteId = req.user.instituteId;
      if (!instituteId) {
        const dbUser = await User.findByPk(req.user.id);
        instituteId = dbUser ? dbUser.instituteId : null;
      }

      // ⚡ REFACTORED: Calls specialized year-scoped data compiler inside service layer
      const { logs, classroom } = await attendanceService.fetchPDFData(
        instituteId,
        classId,
        date,
        academicYearId,
      );

      const htmlContent = generateAttendanceHTML(logs, date, classroom);

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
      });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Attendance_Statement_${date}.pdf`,
      );
      return res.status(200).send(pdfBuffer);
    } catch (err) {
      if (browser) await browser.close();
      return res
        .status(500)
        .json({ message: `Server PDF Engine Fail: ${err.message}` });
    }
  }
  async promoteStudentsBulk(req, res) {
    try {
      const { sourceClassId, targetClassId, targetAcademicYearId, studentIds } =
        req.body;
      const instituteId = req.user.instituteId;

      if (
        !sourceClassId ||
        !targetClassId ||
        !targetAcademicYearId ||
        !Array.isArray(studentIds) ||
        studentIds.length === 0
      ) {
        return res.status(400).json({
          message:
            "Parameters Incomplete: sourceClassId, targetClassId, targetAcademicYearId, and studentIds array are required.",
        });
      }

      const { AcademicYearStudent } = require("../models/index");
      const crypto = require("crypto");

      // 1. Loop and build dynamic bulk-history mapping records for the new academic cycle
      const historicalMappings = studentIds.map((studentId) => ({
        id: crypto.randomUUID(),
        instituteId,
        academicYearId: targetAcademicYearId,
        studentId,
        classId: targetClassId,
      }));

      // 2. Commit historical mapping logs to the database using an atomic bulk operation
      await AcademicYearStudent.bulkCreate(historicalMappings, {
        updateOnDuplicate: ["classId", "updatedAt"],
      });

      // 3. Update the active pointers on the User records to reflect their new class placement instantly
      const { User } = require("../models/index");
      await User.update(
        { classId: targetClassId },
        { where: { id: studentIds, instituteId } },
      );

      return res.status(200).json({
        message: `Successfully promoted ${studentIds.length} students to the new academic year cycle assignment container.`,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ message: `Promotion Engine Error: ${err.message}` });
    }
  }
  async closeAcademicYear(req, res) {
    try {
      const { yearId } = req.params;
      const instituteId = req.user.instituteId;
      const { AcademicYear } = require("../models/index");

      // Verify the targeted year exists and belongs to this school tenant
      const targetYear = await AcademicYear.findOne({
        where: { id: yearId, instituteId },
      });
      if (!targetYear) {
        return res
          .status(404)
          .json({ message: "Educational calendar track not found." });
      }

      // Security Constraint Guard: Block locking if it is the currently active workspace cycle
      if (targetYear.isActive) {
        return res.status(400).json({
          message:
            "Constraint Wall: You cannot archive the primary active cycle directly. Please activate another year first to displace this track safely.",
        });
      }

      // Commit the state mutation flag directly onto the row column
      await targetYear.update({ isLocked: true });

      return res.json({
        message: `Academic cycle "${targetYear.name}" has been safely archived and locked to a read-only status.`,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}

module.exports = new AttendanceController();
