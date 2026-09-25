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
   async getPaginatedClassrooms(instituteId, filters) {
    const { Classroom } = require("../models/index");
    const { Op } = require("sequelize");

    // 1. Set baseline query criteria
    let whereCondition = { instituteId };

    if (filters.academicYearId && filters.academicYearId !== "all") {
      whereCondition.academicYearId = filters.academicYearId;
    }

    if (filters.search && String(filters.search).trim().length > 0) {
      whereCondition.name = { [Op.like]: `%${String(filters.search).trim()}%` };
    }

    // ========================================================================
    // 🚀 FIXED: ENFORCE THE CLASSROOM ID MATRIX CONTAINMENT BOUNDARY
    // ========================================================================
    // If the controller specifies a limited list of authorized classes, 
    // strictly limit the database response rows to this array pool!
    if (filters.classIds && Array.isArray(filters.classIds)) {
      whereCondition.id = { [Op.in]: filters.classIds };
    } else if (filters.classId) {
      whereCondition.id = filters.classId;
    }

    // 2. Execute query execution mapping
    const page = parseInt(filters.page) || 1;
    const limit = filters.limit === "all" ? null : (parseInt(filters.limit) || 5);
    const offset = filters.limit === "all" ? null : (page - 1) * limit;

    const { count, rows } = await Classroom.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["name", "ASC"], ["section", "ASC"]],
    });

    return {
      totalRecords: count,
      totalPages: limit ? Math.ceil(count / limit) : 1,
      currentPage: page,
      records: rows,
    };
  }
}

module.exports = new ClassroomService();
