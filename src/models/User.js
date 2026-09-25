const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM(
        "super_admin",
        "institute_admin",
        "staff",
        "class_teacher",
        "student",
        "teacher"
      ),
      allowNull: false,
    },
    classId: { type: DataTypes.UUID, allowNull: true },
    instituteId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "Institutes", // ⚡ FIX: Maps to the new independent master table
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active", // 🚀 Active by default on registration onboarding
    },
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resetTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = User;
