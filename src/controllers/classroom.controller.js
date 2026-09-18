const classroomRepository = require("../repositories/classroom.repository");
const classroomService = require("../services/classroom.service");
const { Op } = require("sequelize");
const { Classroom } = require("../models/index");

class ClassroomController {
  async create(req, res) {
    try {
      const { name, section } = req.body;
      const instituteId = req.user.instituteId;

      // 🚀 FIX: Check if this specific combination already exists for this institute
      const duplicateExists = await classroomRepository.findOne({
        name,
        section,
        instituteId,
      });

      if (duplicateExists) {
        return res.status(400).json({
          message: `A classroom named "${name}" with section "${section}" already exists in your institute.`,
        });
      }

      const classroom = await classroomRepository.create({
        name,
        section,
        instituteId,
      });

      return res
        .status(201)
        .json({ message: "Classroom created successfully", data: classroom });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  async getAll(req, res) {
    try {
      const { search = "", page = 1, limit = 5 } = req.query;
      const dataContext = await classroomService.getPaginatedClassrooms(
        req.user.instituteId,
        { search, page, limit },
      );
      return res.json(dataContext);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async deleteClass(req, res) {
    try {
      const { id } = req.params;
      const instituteId = req.user.instituteId;

      // Purge entry matching tenant workspace bounds perfectly
      const deletedCount = await classroomRepository.model.destroy({
        where: { id, instituteId },
      });

      if (!deletedCount)
        return res
          .status(404)
          .json({ message: "Classroom entity entry not found." });
      return res.json({ message: "Classroom node dropped successfully." });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async updateClass(req, res) {
    try {
      const { id } = req.params;
      const { name, section } = req.body;
      const instituteId = req.user.instituteId;

      // 1. Verify existence within tenant boundaries
      const classroom = await classroomRepository.findOne({ id, instituteId });
      if (!classroom)
        return res.status(404).json({ message: "Classroom not found." });

      // 2. Prevent unique combination collision with other existing rows
      const duplicateExists = await classroomRepository.model.findOne({
        where: {
          name,
          section,
          instituteId,
          id: { [Op.ne]: id }, // Exclude the current classroom being updated
        },
      });

      if (duplicateExists) {
        return res.status(400).json({
          message: `Another classroom named "${name}" with section "${section}" already exists in your institute.`,
        });
      }

      // 3. Commit mutations securely
      await classroom.update({ name, section });
      return res.json({
        message: "Classroom updated successfully",
        data: classroom,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}

module.exports = new ClassroomController();
