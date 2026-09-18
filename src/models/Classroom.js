const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Classroom = sequelize.define('Classroom', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  section: {
    type: DataTypes.STRING,
    allowNull: true
  },
  instituteId: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    {
      name: 'idx_classroom_tenant',
      fields: ['instituteId']
    },
    // 🚀 FIX: Prevent duplicate combination of Name + Section inside the same School branch
    {
      name: 'uk_classroom_name_section_tenant',
      unique: true,
      fields: ['name', 'section', 'instituteId']
    }
  ]
});

module.exports = Classroom;