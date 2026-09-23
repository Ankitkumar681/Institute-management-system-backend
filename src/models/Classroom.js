const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Classroom = sequelize.define(
  "Classroom",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'classrooms_year_scoped_unique'
    },
    section: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: 'classrooms_year_scoped_unique'
    },
    instituteId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    academicYearId: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: 'classrooms_year_scoped_unique'
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        name: "idx_classroom_tenant",
        fields: ["instituteId"],
      },
      // 🚀 FIX: Prevent duplicate combination of Name + Section inside the same School branch
      {
        name: "uk_classroom_name_section_tenant",
        unique: true,
        fields: ["name", "section", "instituteId"],
      },
    ],
  },
);

module.exports = Classroom;
