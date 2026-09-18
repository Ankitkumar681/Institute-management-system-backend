const BaseRepository = require("./base.repository");
const { User, Classroom } = require("../models/index"); // ⚡ Import from unified context index
const { Op } = require("sequelize");

class UserRepository extends BaseRepository {
  constructor() {
    // ⚡ FIX: Explicitly passes the Sequelize User model into the parent class
    super(User);
  }

  async findByEmail(email) {
    return await this.findOne({ email });
  }

  async createInstituteAdmin(data, hashedPassword) {
    const t = await sequelize.transaction();
    try {
      const user = await this.model.create(
        {
          ...data,
          password: hashedPassword,
          role: "institute_admin",
        },
        { transaction: t },
      );

      await user.update({ instituteId: user.id }, { transaction: t });

      await t.commit();
      return user;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
  async getPaginatedFilteredUsers(filterContext, queryOptions) {
    const { role, instituteId, classId, search } = filterContext;
    const {
      sortBy = "name",
      sortOrder = "ASC",
      page = 1,
      limit = 10,
    } = queryOptions;

    // 1. Structure the matching criteria object safely
    let whereCondition = {};
    if (role) {
      if (Array.isArray(role)) {
        whereCondition.role = { [Op.in]: role };
      } else {
        whereCondition.role = role;
      }
    }

    if (instituteId) whereCondition.instituteId = instituteId;
    if (classId) whereCondition.classId = classId;

    if (search && String(search).trim().length > 0) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${String(search).trim()}%` } },
        { email: { [Op.like]: `%${String(search).trim()}%` } },
      ];
    }

    // 🚀 FIXED: Skip limit/offset query conditions altogether if 'all' is passed from the client!
    if (limit === "all") {
      const rows = await this.model.findAll({
        where: whereCondition,
        include: [
          {
            model: Classroom,
            as: "classroom",
            attributes: ["id", "name", "section"],
          },
        ],
        order: [[sortBy, sortOrder]],
      });

      return {
        totalRecords: rows.length,
        totalPages: 1,
        currentPage: 1,
        limit: rows.length,
        records: rows,
      };
    }

    // Regular paginated calculation flow handles normal limits safely
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await this.model.findAndCountAll({
      where: whereCondition,
      distinct: true,
      limit: parseInt(limit),
      offset: offset,
      include: [
        {
          model: Classroom,
          as: "classroom",
          attributes: ["id", "name", "section"],
        },
      ],
      order: [[sortBy, sortOrder]],
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

module.exports = new UserRepository();
