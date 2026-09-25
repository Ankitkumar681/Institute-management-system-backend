const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AcademicYearTeacher = sequelize.define('AcademicYearTeacher', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  instituteId: { type: DataTypes.UUID, allowNull: false },
  academicYearId: { type: DataTypes.UUID, allowNull: false },
  teacherId: { type: DataTypes.UUID, allowNull: false },
  classId: { type: DataTypes.UUID, allowNull: false },
  subjectName: { type: DataTypes.STRING, allowNull: false }
}, { tableName: 'academic_year_teachers' });

module.exports = AcademicYearTeacher;
