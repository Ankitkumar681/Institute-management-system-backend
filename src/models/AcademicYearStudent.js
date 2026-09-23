const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AcademicYearStudent = sequelize.define('AcademicYearStudent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  instituteId: { type: DataTypes.UUID, allowNull: false },
  academicYearId: { type: DataTypes.UUID, allowNull: false },
  studentId: { type: DataTypes.UUID, allowNull: false },
  classId: { type: DataTypes.UUID, allowNull: false }
}, { tableName: 'academic_year_students', timestamps: true });

module.exports = AcademicYearStudent;
