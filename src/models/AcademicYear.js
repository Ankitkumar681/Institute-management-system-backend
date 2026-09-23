const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AcademicYear = sequelize.define(
  "AcademicYear",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    instituteId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false }, // e.g., "2025-2026"
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: false },
    isLocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "isLocked",
    },
  },
  { tableName: "academic_years", timestamps: true },
);

module.exports = AcademicYear;
