const BaseRepository = require("./base.repository");
const {
  User,
  Classroom,
  AcademicYearStudent,
  StudentProfile,
} = require("../models/index");
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
    const { role, instituteId, classId, search, academicYearId } =
      filterContext;
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

    // 🚀 YEAR ENGINE PATCH: Only filter by root classId if we aren't looking up historical data.
    // For historical year lookups, the classroom constraint is handled below inside the junction table query.
    const isHistoricalStudentQuery =
      role === "student" &&
      academicYearId &&
      academicYearId !== "" &&
      academicYearId !== "undefined";

    if (classId && !isHistoricalStudentQuery) {
      whereCondition.classId = classId;
    }

    if (search && String(search).trim().length > 0) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${String(search).trim()}%` } },
        { email: { [Op.like]: `%${String(search).trim()}%` } },
      ];
    }

    // Dynamic Tracking Variable: Determines which models to include in the query lookup
    let inclusionModels = [
      {
        model: Classroom,
        as: "classroom",
        attributes: ["id", "name", "section"],
      },
    ];
    if (role === "student" && StudentProfile) {
      inclusionModels.push({
        model: StudentProfile,
        as: "profileExtension",
        attributes: [
          "parentName",
          "parentContact",
          "parentEmail",
          "bloodGroup",
        ],
      });
    }

    if (isHistoricalStudentQuery && AcademicYearStudent) {
      try {
        // Build the query options to look up students enrolled inside this year
        let timelineFilter = { academicYearId, instituteId };

        // 🚀 YEAR ENGINE PATCH: If the user also selected a specific classroom dropdown filter,
        // scope the timeline search to only pull students registered to that classroom for that targeted year.
        if (classId) {
          timelineFilter.classId = classId;
        }
        const matchingTimelineRecords = await AcademicYearStudent.findAll({
          where: timelineFilter,
          attributes: ["studentId"],
          raw: true,
        });

        const registeredStudentIds = matchingTimelineRecords.map(
          (r) => r.studentId,
        );

        // Inject an explicit list matching constraint mapping.
        whereCondition.id = {
          [Op.in]:
            registeredStudentIds.length > 0
              ? registeredStudentIds
              : ["_FORCE_EMPTY_RESULT_"],
        };

        inclusionModels.push({
          model: AcademicYearStudent,
          as: "yearlyEnrollments", // ⚡ Assumes User.hasMany(AcademicYearStudent, { as: "yearPlacements" }) exists in models/index.js
          where: { academicYearId },
          required: false,
          include: [
            {
              model: Classroom,
              as: "classroom",
              attributes: ["id", "name", "section"],
            },
          ],
        });
      } catch (dbError) {
        console.error(
          "Historical timeline filtering bypassed safely due to missing schemas: ",
          dbError.message,
        );
      }
    }

    // 🚀 FIXED: Skip limit/offset query conditions altogether if 'all' is passed from the client!
    if (limit === "all") {
      const rows = await this.model.findAll({
        where: whereCondition,
        include: inclusionModels, // ⚡ Uses dynamic year-aware mapping models context lists
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
      include: inclusionModels, // ⚡ Uses dynamic year-aware mapping models context lists
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
