const { Parser } = require("json2csv");
const puppeteer = require("puppeteer");
const attendanceService = require("../services/attendance.service");
const AttendanceResource = require("../resources/attendance.resource");
const { User } = require("../models/index");

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
      // 🚀 FIXED: Now uses the new unpaginated export method from the service layer to download ALL records
      const result = await attendanceService.fetchRecordsForExport(req.user);
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
      const analyticsData =
        await attendanceService.fetchInstituteDashboardMetrics(req.user);
      return res.json(analyticsData);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
  async exportPDF(req, res) {
    let browser = null;
    try {
      const { classId, date } = req.query;
      if (!classId || !date) {
        return res.status(400).json({
          message: "Parameters Missing: Both classId and date fields required.",
        });
      }

      // 1. Fetch raw logs using the unpaginated multi-tenant isolation service wrapper
      const result = await attendanceService.fetchRecordsForExport(req.user);
      const rawLogs = result.records || [];

      // 2. Filter data logs strictly to match BOTH the classId and the requested target date parameters safely

      const targetedLogs = rawLogs.filter((log) => {
        // String conversion normalization forces exact matches across strings/numbers/dates
        const matchClass = String(log.classId) === String(classId);
        const matchDate = String(log.date) === String(date);
        return matchClass && matchDate;
      });

      // 3. ✨ FIX: Extract classroom metadata info cleanly from the FIRST matched array index element
      const classroom =
        targetedLogs.length > 0 ? targetedLogs[0].classroom : null;
      console.log(targetedLogs, "targetedLogs");
      console.log(date, "date11");
      console.log(classroom, "classroom11");

      // 4. Pass gathered records down to our HTML document design canvas builder
      const htmlContent = generateAttendanceHTML(targetedLogs, date, classroom);

      // 5. Launch the backend headless Puppeteer browser sub-process worker thread
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
      browser = null; // Clean up memory reference pointer

      // 6. Stream the compiled binary file down to the React frontend interface client
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
}

module.exports = new AttendanceController();
