const authService = require("../services/auth.service");
const UserResource = require("../resources/user.resource");
const userRepository = require("../repositories/user.repository");
const { User } = require("../models/index");

class AuthController {
  async register(req, res) {
    try {
      const newUser = await authService.registerUser(req.body);
      return res.status(201).json({
        message: "Registration successful",
        user: UserResource.single(newUser),
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }

  async login(req, res) {
    try {
      const { token, user } = await authService.loginUser(req.body);
      return res.json({
        token,
        user: UserResource.single(user),
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
  async listStaff(req, res) {
    try {
      const {
        search,
        sortBy = "name",
        sortOrder = "ASC",
        page = 1,
        limit = 5,
      } = req.query;

      // 🚀 CRITICAL FIX: Fallback to lookup the admin's true live database record if token payload is unpopulated
      let targetInstituteId = req.user.instituteId;

      if (!targetInstituteId) {
        const currentOperatorProfile = await User.findByPk(req.user.id, {
          attributes: ["instituteId"],
        });
        if (currentOperatorProfile) {
          targetInstituteId = currentOperatorProfile.instituteId;
        }
      }

      // If no valid institute scope container can be parsed, block request parameters defensively
      if (!targetInstituteId) {
        return res.status(400).json({
          message:
            "Authorization scope mismatch. No institute linked to your identity profile.",
        });
      }

      const result = await userRepository.getPaginatedFilteredUsers(
        {
          role: ["class_teacher", "staff"],
          instituteId: targetInstituteId, // ⚡ Enforces the verified database identifier layout
          search: search ? String(search).trim() : "",
        },
        { sortBy, sortOrder, page, limit },
      );

      return res.json({
        ...result,
        records: UserResource.collection(result.records),
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  async listStudents(req, res) {
    try {
      const {
        search,
        classId,
        sortBy = "name",
        sortOrder = "ASC",
        page = 1,
        limit = 5,
      } = req.query;
      const filterContext = {
        role: "student",
        instituteId: req.user.instituteId,
        search: search ? String(search).trim() : "",
      };

      // Only apply the classId constraint if it's explicitly passed as a valid value
      if (classId && classId !== "" && classId !== "undefined") {
        filterContext.classId = classId;
      }

      const result = await userRepository.getPaginatedFilteredUsers(
        filterContext,
        { sortBy, sortOrder, page, limit },
      );
      return res.json({
        ...result,
        records: UserResource.collection(result.records),
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async toggleStaffStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body; // Expects 'active' or 'inactive' string

      if (!["active", "inactive"].includes(status)) {
        return res
          .status(400)
          .json({ message: "Invalid status parameter context." });
      }

      // Find the targeted user ensuring they belong exclusively to the same school tenant branch
      const staffMember = await userRepository.findOne({
        id,
        instituteId: req.user.instituteId,
      });
      if (!staffMember)
        return res
          .status(404)
          .json({ message: "Staff member record not discovered." });

      // Block institute administrators from self-deactivating accidentally
      if (staffMember.role === "institute_admin") {
        return res.status(400).json({
          message: "Administrative root owners cannot be suspended here.",
        });
      }

      await staffMember.update({ status });
      return res.json({
        message: `Staff status successfully changed to ${status}.`,
        data: staffMember,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async assignTeacherClass(req, res) {
    try {
      const { teacherId, classId } = req.body;
      const instituteId = req.user.instituteId;

      // 1. Verify the teacher exists and belongs to this school tenant
      const teacher = await userRepository.findOne({
        id: teacherId,
        instituteId,
        role: "class_teacher",
      });
      if (!teacher)
        return res
          .status(404)
          .json({ message: "Teacher record not found in this institute." });

      // 2. Commit class assignment mapping (set to null if removing class)
      await teacher.update({ classId: classId || null });

      return res.json({
        message: "Classroom assignment synchronized successfully.",
        data: teacher,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async checkStatus(req, res) {
    try {
      const statusContext = await authService.checkUserStatus(req.user.id);
      return res.json(statusContext);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;
      const recoveryResult = await authService.generateRecoveryToken(email);
      return res.json({
        message:
          "Recovery reference passcode token generated on backend ledger data registers.",
        email: recoveryResult.email,
        // For testing/development convenience, we pass it down so it prints or logs cleanly
        debugToken: recoveryResult.token,
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }

  async confirmPasswordReset(req, res) {
    try {
      const { email, passcode, newPassword } = req.body;
      const resetResult = await authService.commitPasswordReset(
        email,
        passcode,
        newPassword,
      );
      return res.json(resetResult);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
}
module.exports = new AuthController();
