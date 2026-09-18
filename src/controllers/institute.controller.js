const userRepository = require("../repositories/user.repository");
const { Op } = require("sequelize");
const { Institute } = require("../models/index");
const instituteService = require("../services/institute.service");

class InstituteController {
  async listAllInstitutes(req, res) {
    try {
      const { search = "", page = 1, limit = 5 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let filter = {};
      if (search) {
        filter.name = { [Op.like]: `%${search}%` };
      }

      const { count, rows } = await Institute.findAndCountAll({
        where: filter,
        limit: parseInt(limit),
        offset: offset,
        order: [["createdAt", "DESC"]],
      });

      return res.json({
        totalRecords: count,
        totalPages: Math.ceil(count / limit) || 1,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        records: rows,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async toggleStatus(req, res) {
    try {
      const { id } = req.params; // Expects Institute ID
      const { status } = req.body;

      const institute = await Institute.findByPk(id);
      if (!institute)
        return res.status(404).json({ message: "Institute not found." });

      await institute.update({ status });
      return res.json({
        message: `Institute status updated to ${status}.`,
        data: institute,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async createInstitute(req, res) {
    try {
      const onboardResult = await instituteService.onboardNewSchool(req.body);

      return res.status(201).json({
        message: "Multi-tenant school container provisioned cleanly!",
        institute: onboardResult.institute,
        adminEmail: onboardResult.adminEmail,
        temporaryPassword: onboardResult.temporaryPassword, // Sends password block back to render SweetAlert modal prompts
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
}

module.exports = new InstituteController();
