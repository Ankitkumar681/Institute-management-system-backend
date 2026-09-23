const classroomRepository = require("../repositories/classroom.repository");
const { Classroom } = require("../models/index");
const { Op } = require("sequelize");

class ClassroomService {
  async createNewClassroom(instituteId, classroomData) {
    const { name, section, academicYearId } = classroomData;

    return await classroomRepository.create({
      name: name,
      section: section,
      instituteId: instituteId, // Enforces tenant context isolation
      academicYearId: academicYearId || null, // ⚡ Securely binds the classroom to the target cycle
    });
  }

  async getInstituteClassrooms(instituteId, academicYearId = null) {
    let whereCondition = { instituteId };

    if (
      academicYearId &&
      academicYearId !== "" &&
      academicYearId !== "undefined"
    ) {
      whereCondition.academicYearId = academicYearId;
    }

    return await classroomRepository.model.findAll({
      where: whereCondition,
      order: [
        ["name", "ASC"],
        ["section", "ASC"],
      ],
    });
  }
  async getPaginatedClassrooms(instituteId, params) {
    const { search, page = 1, limit = 5, academicYearId } = params;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereCondition = { instituteId };
    if (search && search.trim() !== "") {
      whereCondition.name = { [Op.like]: `%${search.trim()}%` };
    }
    if (
      academicYearId &&
      academicYearId !== "" &&
      academicYearId !== "undefined"
    ) {
      whereCondition.academicYearId = academicYearId;
    }
    if (params.classId) {
      whereCondition.id = params.classId; // Forces the grid layout to only query this matched room entry row
    }
    if (limit === "all") {
      const rows = await Classroom.findAll({
        where: whereCondition,
        order: [["createdAt", "DESC"]],
      });
      return {
        totalRecords: rows.length,
        totalPages: 1,
        currentPage: 1,
        limit: rows.length,
        records: rows,
      };
    }
    const { count, rows } = await Classroom.findAndCountAll({
      where: whereCondition,
      limit: parseInt(limit),
      offset: offset,
      order: [["createdAt", "DESC"]],
    });
    return {
      totalRecords: count,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage: parseInt(page),
      limit: parseInt(limit),
      records: rows,
    };
  }
}

module.exports = new ClassroomService();
