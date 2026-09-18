const classroomRepository = require("../repositories/classroom.repository");
const { Classroom } = require("../models/index");
const { Op } = require("sequelize");

class ClassroomService {
  async createClassroom(data, actor) {
    return await classroomRepository.create({
      name: data.name,
      section: data.section,
      instituteId: actor.instituteId, // Enforces tenant context isolation
    });
  }

  async getInstituteClassrooms(actor) {
    return await classroomRepository.findByTenant(actor.instituteId);
  }
  async getPaginatedClassrooms(instituteId, params) {
    const { search, page = 1, limit = 5 } = params;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereCondition = { instituteId };
    if (search && search.trim() !== "") {
      whereCondition.name = { [Op.like]: `%${search.trim()}%` };
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
