const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Institute = sequelize.define('Institute', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isEmail: true } // ⚡ FIXED: No indexes or uniqueness rules here to confuse Sequelize
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  timestamps: true
});

module.exports = Institute;
