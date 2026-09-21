// utils/pdfTemplate.js

/**
 * Generates a clean HTML dashboard template for the attendance report
 * @param {Array} records - Array of attendance database rows
 * @param {String} date - The target tracking date
 * @param {Object} classroom - The active classroom details object
 */
const generateAttendanceHTML = (records, date, classroom) => {
    const className = classroom ? `${classroom.name} — ${classroom.section}` : "N/A";
    
    // Map individual database records into strict HTML table row tags
    const tableRows = records.map((log, index) => {
        const studentName = log.student ? log.student.name : "N/A";
        const studentEmail = log.student ? log.student.email : "N/A";
        const statusColor = log.status === "Present" ? "#047857" : "#b91c1c"; // Emerald Green vs Deep Rose Red
        
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
    }).join('');

    // Return the full-scale styling document canvas framework
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
                th { background-color: #f8fafc; border: 1px solid #e2e8f0; color: #475569; font-weight: 700; uppercase tracking-wider; padding: 12px 10px; text-align: left; }
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

            ${records.length === 0 ? `
                <div style="padding: 40px; text-align: center; border: 2px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; font-size: 14px;">
                    No attendance records exist in this institutional block frame container for the matching date matrix.
                </div>
            ` : `
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
                        \${tableRows}
                    </tbody>
                </table>
            `}

            <div class="footer-signatures">
                <div class="sig-line">Class Teacher Signature</div>
                <div class="sig-line">Verified Authority Stamp</div>
            </div>
        </body>
        </html>
    `;
};

module.exports = { generateAttendanceHTML };
