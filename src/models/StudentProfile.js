const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StudentProfile = sequelize.define('StudentProfile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  studentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'studentId'  },
  parentName: { type: DataTypes.STRING, allowNull: false, field: 'parentName' },
  parentContact: { type: DataTypes.STRING, allowNull: false, field: 'parentContact' },
  parentEmail: { type: DataTypes.STRING, allowNull: true, field: 'parentEmail' },
  bloodGroup: { type: DataTypes.STRING, allowNull: true, field: 'bloodGroup' }
}, { tableName: 'student_profiles' });

module.exports = StudentProfile;