const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  studentId: { type: DataTypes.UUID, allowNull: false },
  classId: { type: DataTypes.UUID, allowNull: false },
  instituteId: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('Present', 'Absent', 'Late'), allowNull: false }
}, {
  timestamps: true,
  indexes: [
    { name: 'idx_attendance_tenant_class_date', fields: ['instituteId', 'classId', 'date'] },
    { name: 'idx_attendance_tenant_student', fields: ['instituteId', 'studentId'] },
    // 🚀 FIX: Prevent duplicate date logs for the exact same student by applying a Unique Constraint link
    {
      name: 'uk_student_attendance_per_day',
      unique: true,
      fields: ['studentId', 'date']
    }
  ]
});

module.exports = Attendance;
