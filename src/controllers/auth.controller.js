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
        academicYearId,
      } = req.query; // 🚀 Capture year query params
      const targetInstituteId = req.user.instituteId;

      const { User, Classroom, AcademicYearStaff } = require("../models/index");
      const { Op } = require("sequelize");
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let whereCondition = {
        role: "class_teacher",
        instituteId: targetInstituteId,
      };
      if (search) {
        whereCondition.name = { [Op.like]: `%${String(search).trim()}%` };
      }

      // Pull faculty members along with their year-scoped assignment allocations rows
      const { count, rows } = await User.findAndCountAll({
        where: whereCondition,
        limit: limit === "all" ? null : parseInt(limit),
        offset: limit === "all" ? null : offset,
        include: [
          {
            model: AcademicYearStaff,
            as: "staffAssignments",
            where: academicYearId ? { academicYearId } : {},
            required: false,
            include: [
              {
                model: Classroom,
                as: "classroom",
                attributes: ["id", "name", "section"],
              },
            ],
          },
        ],
        order: [[sortBy, sortOrder]],
      });

      // Format response cleanly so the frontend sees the correct classroom object based on the timeline choice
      const records = rows.map((user) => {
        const activeAssignment =
          user.staffAssignments && user.staffAssignments[0];
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          classroom: activeAssignment ? activeAssignment.classroom : null,
        };
      });

      return res.json({
        totalRecords: count,
        totalPages: Math.ceil(count / limit) || 1,
        currentPage: parseInt(page),
        records,
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
        academicYearId,
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
      if (
        academicYearId &&
        academicYearId !== "" &&
        academicYearId !== "undefined"
      ) {
        filterContext.academicYearId = academicYearId;
      }

      const result = await userRepository.getPaginatedFilteredUsers(
        filterContext,
        { sortBy, sortOrder, page, limit },
      );

      // 🚀 THE SELF-HEALING SEED PIPELINE:
      // Loop through the raw records. If an older student doesn't have an extension row, create a default one!
      const { StudentProfile } = require("../models/index");
      const crypto = require("crypto");

      if (result.records && result.records.length > 0) {
        for (const userInstance of result.records) {
          if (
            userInstance.role === "student" &&
            !userInstance.profileExtension
          ) {
            const [newProfile] = await StudentProfile.findOrCreate({
              where: { studentId: userInstance.id },
              defaults: {
                id: crypto.randomUUID(),
                studentId: userInstance.id,
                parentName: "Not Provided",
                parentContact: "Not Provided",
                parentEmail: null,
                bloodGroup: "N/A",
              },
            });
            // Force link the instance row inside memory
            userInstance.profileExtension = newProfile;
          }
        }
      }

      const plainRecords = result.records.map((record) => {
        const rawJson = record.toJSON ? record.toJSON() : record;
        return {
          ...rawJson,
          // Explicitly map profileExtension property to guarantee it reaches the network wire
          profileExtension: rawJson.profileExtension || {
            parentName: "Not Provided",
            parentContact: "Not Provided",
            parentEmail: null,
            bloodGroup: "N/A",
          },
          joinedAt: rawJson.createdAt,
        };
      });

      return res.json({
        ...result,
        records: plainRecords, 
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
      const { teacherId, classId, academicYearId } = req.body; // 🚀 NEW: Extracted year choice from body parameters
      const instituteId = req.user.instituteId;

      if (!academicYearId) {
        return res.status(400).json({
          message: "Parameters Missing: academicYearId context is required.",
        });
      }

      // 1. Verify the targeted teacher exists and belongs to this school tenant branch
      const teacher = await userRepository.findOne({
        id: teacherId,
        instituteId,
        role: "class_teacher",
      });
      if (!teacher)
        return res
          .status(404)
          .json({ message: "Teacher record not found in this institute." });

      const { AcademicYearStaff } = require("../models/index");
      const crypto = require("crypto");

      // 2. Clear out any existing assignment row for this teacher inside THIS specific year session block
      await AcademicYearStaff.destroy({
        where: { teacherId, academicYearId, instituteId },
      });

      // 3. If a new classId allocation link is provided, create the timeline record row entry block
      if (classId && classId !== "" && classId !== "undefined") {
        await AcademicYearStaff.create({
          id: crypto.randomUUID(),
          instituteId,
          academicYearId,
          teacherId,
          classId,
        });

        // Soft Fallback: Keep current active user column updated for real-time legacy checks if needed
        await teacher.update({ classId });
      } else {
        await teacher.update({ classId: null });
      }

      return res.json({
        message:
          "Classroom assignment synchronized successfully for the selected educational cycle.",
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
  async importStudentsCSV(req, res) {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ message: "No spreadsheet file uploaded." });

      const { classId } = req.body;
      const { academicYearId } = req.query; // Captures chosen session parameter contexts from network interceptors
      const instituteId = req.user.instituteId;

      const result = await authService.importStudentsBulk(
        req.file.buffer,
        instituteId,
        classId,
        academicYearId,
      );

      return res.status(200).json({
        message: `Successfully onboarded ${result.totalImported} student profiles for this selected year context cycle.`,
        data: result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async updateStudentInline(req, res) {
    try {
      const { studentId } = req.params;
      const { name, email, classId, academicYearId } = req.body;
      const instituteId = req.user.instituteId;

      const { User, AcademicYearStudent } = require("../models/index");

      // 1. Locate student footprint profile
      const student = await User.findOne({
        where: { id: studentId, instituteId, role: "student" },
      });
      if (!student)
        return res.status(404).json({ message: "Student record not found." });

      // 2. Mutate global core user parameters
      await student.update({
        name: name || student.name,
        email: email ? email.trim().toLowerCase() : student.email,
        classId: classId || student.classId,
      });

      // 3. 🚀 MULTI-YEAR ENGINE TIMELINE SYNC: Update their historical classroom placement row for this year
      if (academicYearId) {
        const activePlacement = await AcademicYearStudent.findOne({
          where: { studentId, academicYearId, instituteId },
        });

        if (activePlacement) {
          await activePlacement.update({
            classId: classId || activePlacement.classId,
          });
        }
      }

      return res.json({
        message: "Student information profile synchronized successfully.",
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
  async updateStudentProfileExtension(req, res) {
    try {
      const { studentId } = req.params;
      const {
        name,
        email,
        classId,
        academicYearId,
        parentName,
        parentContact,
        parentEmail,
        bloodGroup,
      } = req.body;
      const instituteId = req.user.instituteId;

      const {
        User,
        AcademicYearStudent,
        StudentProfile,
      } = require("../models/index");

      // 1. Locate student user profile
      const student = await User.findOne({
        where: { id: studentId, instituteId, role: "student" },
      });
      if (!student)
        return res.status(404).json({ message: "Student record not found." });

      // 2. Mutate global core user parameters
      await student.update({
        name: name || student.name,
        email: email ? email.trim().toLowerCase() : student.email,
        classId: classId || student.classId,
      });

      // 3. 🚀 MULTI-YEAR ENGINE TIMELINE SYNC: Update their historical classroom placement row for this year
      if (academicYearId && AcademicYearStudent) {
        const activePlacement = await AcademicYearStudent.findOne({
          where: { studentId, academicYearId, instituteId },
        });
        if (activePlacement) {
          await activePlacement.update({
            classId: classId || activePlacement.classId,
          });
        }
      }

      // 4. 🚀 EXTENSION LEDGER UPSERT: Sync parental metadata properties fields cleanly
      if (StudentProfile) {
        const profile = await StudentProfile.findOne({ where: { studentId } });
        if (profile) {
          await profile.update({
            parentName: parentName || profile.parentName,
            parentContact: parentContact || profile.parentContact,
            parentEmail:
              parentEmail !== undefined ? parentEmail : profile.parentEmail,
            bloodGroup: bloodGroup || profile.bloodGroup,
          });
        } else {
          await StudentProfile.create({
            id: require("crypto").randomUUID(),
            studentId,
            parentName: parentName || "Not Provided",
            parentContact: parentContact || "Not Provided",
            parentEmail: parentEmail || null,
            bloodGroup: bloodGroup || "N/A",
          });
        }
      }

      return res.json({
        message: "Student profile extensions updated successfully.",
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}
module.exports = new AuthController();
