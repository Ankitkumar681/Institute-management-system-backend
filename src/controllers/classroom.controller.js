const classroomRepository = require("../repositories/classroom.repository");
const classroomService = require("../services/classroom.service");
const { Op } = require("sequelize");
const { AcademicYear } = require("../models/index");

class ClassroomController {
  async create(req, res) {
    try {
      const { name, section, academicYearId } = req.body;
      const instituteId = req.user.instituteId;
      let targetYearId = academicYearId;
      if (!targetYearId && AcademicYear) {
        const activeYear = await AcademicYear.findOne({
          where: { instituteId, isActive: true },
        });
        if (activeYear) {
          targetYearId = activeYear.id;
        }
      }
      // 🚀 FIX: Check if this specific combination already exists for this institute
      const duplicateExists = await classroomRepository.findOne({
        name,
        section,
        instituteId,
        academicYearId: targetYearId || null,
      });

      if (duplicateExists) {
        return res.status(400).json({
          message: `A classroom named "${name}" with section "${section}" already exists in your institute.`,
        });
      }

      const classroom = await classroomService.createNewClassroom(instituteId, {
        name,
        section,
        academicYearId: targetYearId || null,
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
      const {
        search = "",
        page = 1,
        limit = 5,
        academicYearId = "",
      } = req.query;
      const instituteId = req.user.instituteId;

      // 1. Structure default filter parameters container
      let targetYearId = academicYearId;
      let targetClassId = null;

      // Backward-Compatible Fallback: If no year context is specified by query params, fetch the active period
      if (!targetYearId && targetYearId !== "0") {
        const { AcademicYear } = require("../models/index");
        const activeYear = await AcademicYear.findOne({
          where: { instituteId, isActive: true },
        });
        if (activeYear) {
          targetYearId = activeYear.id;
        }
      }

      // ========================================================================
      // 🚀 DYNAMIC YEAR-AWARE TEACHER GUARD INTERCEPTOR
      // ========================================================================
      // If the requester is a class teacher, restrict lookup parameters to match their historical track
      if (req.user.role === "class_teacher") {
        const { AcademicYearStaff } = require("../models/index");

        if (AcademicYearStaff && targetYearId) {
          const activeAssignment = await AcademicYearStaff.findOne({
            where: {
              teacherId: req.user.id,
              academicYearId: targetYearId,
              instituteId: instituteId,
            },
          });

          if (activeAssignment) {
            // Force the service layer lookup conditions to match only this year-specific classroom assignment
            targetClassId = activeAssignment.classId;
          } else {
            // If they aren't assigned to any class for this selected year, force an empty dataset response cleanly
            return res.json({
              totalRecords: 0,
              totalPages: 1,
              currentPage: parseInt(page),
              limit: parseInt(limit),
              records: [],
            });
          }
        }
      }

      // 2. Forward compiled parameters down to your existing classrooms service layer
      const dataContext = await classroomService.getPaginatedClassrooms(
        instituteId,
        {
          search,
          page,
          limit,
          academicYearId: targetYearId || null,
          // ⚡ Pass downstream class constraint filter (will handle empty overrides naturally)
          ...(targetClassId && { classId: targetClassId }),
        },
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
          academicYearId: classroom.academicYearId || null,
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
