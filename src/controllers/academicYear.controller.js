const { AcademicYear } = require("../models/index");
const crypto = require("crypto");

class AcademicYearController {
  // 🔍 Fetch all academic cycle blocks mapped under this specific institute tenant wall
  async fetchYears(req, res) {
    try {
      const years = await AcademicYear.findAll({
        where: { instituteId: req.user.instituteId },
        order: [["startDate", "DESC"]],
      });
      return res.status(200).json(years);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // 📝 Setup a brand new educational segment track block
  async createYear(req, res) {
    try {
      const { name, startDate, endDate } = req.body;
      if (!name || !startDate || !endDate) {
        return res
          .status(400)
          .json({
            message:
              "Parameters Missing: Name, Start Date, and End Date are mandatory fields.",
          });
      }

      const newYear = await AcademicYear.create({
        instituteId: req.user.instituteId,
        name: name.trim(),
        startDate,
        endDate,
        isActive: false, // Forces administrative verification step before toggling active indicators
      });

      return res
        .status(201)
        .json({
          message: "Academic cycle configuration logged successfully.",
          data: newYear,
        });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  // ⚡ Global Year Shift Toggle Operation Engine
  async setActiveYear(req, res) {
    try {
      const { id } = req.params;
      const instituteId = req.user.instituteId;

      // 1. Deactivate all existing operational session tracking tags under this specific institution context boundary
      await AcademicYear.update(
        { isActive: false },
        { where: { instituteId } },
      );

      // 2. Set the target timeline selection frame status index dynamically to active
      await AcademicYear.update(
        { isActive: true },
        { where: { id, instituteId } },
      );

      return res
        .status(200)
        .json({
          message: "Educational processing cycle updated successfully.",
        });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}

module.exports = new AcademicYearController();
