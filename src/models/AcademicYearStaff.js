const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AcademicYearStaff = sequelize.define('AcademicYearStaff', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  instituteId: { type: DataTypes.UUID, allowNull: false },
  academicYearId: { type: DataTypes.UUID, allowNull: false },
  teacherId: { type: DataTypes.UUID, allowNull: false },
  classId: { type: DataTypes.UUID, allowNull: false }
}, { tableName: 'academic_year_staff' });

module.exports = AcademicYearStaff;