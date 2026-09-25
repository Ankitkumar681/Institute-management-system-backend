const authService = require("../services/auth.service");
const UserResource = require("../resources/user.resource");
const userRepository = require("../repositories/user.repository");
const { User } = require("../models/index");
const { Op } = require("sequelize");

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
      } = req.query;
      const targetInstituteId = req.user.instituteId;

      const {
        User,
        Classroom,
        AcademicYearStaff,
        AcademicYearTeacher,
      } = require("../models/index");
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // 🚀 UPGRADED: Include all faculty role variations in the query search
      let whereCondition = {
        role: { [Op.in]: ["class_teacher", "teacher", "staff"] },
        instituteId: targetInstituteId,
      };
      if (search) {
        whereCondition.name = { [Op.like]: `%${String(search).trim()}%` };
      }

      // Pull faculty members along with both primary and subject assignments
      const { count, rows } = await User.findAndCountAll({
        where: whereCondition,
        limit: limit === "all" ? null : parseInt(limit),
        offset: limit === "all" ? null : offset,
        distinct: true,
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
          {
            model: AcademicYearTeacher,
            as: "subjectAssignments",
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

      // Format response so the frontend maps primary slots and subject-classes array lists perfectly
      const records = rows.map((user) => {
        const plainUser = user.get({ plain: true });
        const activeAssignment =
          plainUser.staffAssignments && plainUser.staffAssignments.length > 0
            ? plainUser.staffAssignments[0]
            : null;
        return {
          id: plainUser.id,
          name: plainUser.name,
          email: plainUser.email,
          role: plainUser.role,
          status: plainUser.status,
          // Primary class assignment (Object or null)
          classroom: activeAssignment ? activeAssignment.classroom : null,
          // 🚀 NEW: Array of multi-class subject assignments
          subjects:
            plainUser.subjectAssignments?.map((s) => ({
              assignmentId: s.id,
              classId: s.classroom?.id,
              className: s.classroom?.name,
              section: s.classroom?.section,
              subjectName: s.subjectName,
            })) || [],
        };
      });

      return res.json({
        totalRecords: count,
        totalPages: limit === "all" ? 1 : Math.ceil(count / limit) || 1,
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
    const {
      sequelize,
      AcademicYearStaff,
      AcademicYearTeacher,
    } = require("../models/index");
    const t = await sequelize.transaction();
    try {
      const {
        teacherId,
        classId,
        academicYearId,
        subjectName,
        makePrimaryClassTeacher,
        roleOverride,
      } = req.body;
      const instituteId = req.user.instituteId;
      if (!academicYearId) {
        await t.rollback();
        return res.status(400).json({
          message: "Parameters Missing: academicYearId context is required.",
        });
      }

      // 1. Locate the target teacher across expanded matching role profiles
      const teacher = await User.findOne({
        where: {
          id: teacherId,
          instituteId,
          role: { [Op.in]: ["class_teacher", "teacher", "staff"] },
        },
      });
      if (!teacher) {
        await t.rollback();
        return res
          .status(404)
          .json({ message: "Teacher record not found in this institute." });
      }

      const crypto = require("crypto");

      // 2. Process structural profile tier conversions if passed from UI controls
      if (
        roleOverride &&
        ["class_teacher", "teacher", "staff"].includes(roleOverride)
      ) {
        await teacher.update({ role: roleOverride }, { transaction: t });
      }

      // 3. 🛡️ TRACK A: Map Primary Class Teacher Accountability
      if (classId && classId !== "undefined" && classId !== "") {
        if (makePrimaryClassTeacher === true) {
          await AcademicYearStaff.destroy({
            where: { classId, academicYearId, instituteId },
            transaction: t,
          });

          // 🚀 FIX B: Clean up this specific teacher's other primary slots for this year track cycle
          // A teacher can only be a primary class teacher for ONE class per academic cycle!
          await AcademicYearStaff.destroy({
            where: { teacherId, academicYearId, instituteId },
            transaction: t,
          });

          // Force upgrade core role context flag cleanly
          await teacher.update(
            { role: "class_teacher", classId },
            { transaction: t },
          );

          // Set the new primary holder row mapping context
          await AcademicYearStaff.create(
            {
              id: crypto.randomUUID(),
              instituteId,
              academicYearId,
              teacherId,
              classId,
            },
            { transaction: t },
          );
        } else {
          // ==========================================
          // UNCHECKED / UNASSIGN PROCESS LOOP
          // ==========================================
          // If they were previously mapped to this class, clear the primary slot link
          const wasClassTeacher = await AcademicYearStaff.findOne({
            where: { classId, teacherId, academicYearId, instituteId },
            transaction: t,
          });

          if (wasClassTeacher) {
            await wasClassTeacher.destroy({ transaction: t });

            // Demote to a regular teacher role and nullify their core class pointer
            await teacher.update(
              {
                role: "teacher",
                classId: null,
              },
              { transaction: t },
            );
          }
        }
      }

      // 4. TRACK B: Map General Subject Multi-Class Coverage Linkages
      if (
        subjectName &&
        subjectName.trim().length > 0 &&
        classId &&
        classId !== "undefined" &&
        classId !== ""
      ) {
        const cleanSubject = subjectName.trim();

        if (teacher.role === "staff") {
          await teacher.update({ role: "teacher" }, { transaction: t });
        }

        const duplicateExists = await AcademicYearTeacher.findOne({
          where: {
            academicYearId,
            teacherId,
            classId,
            subjectName: cleanSubject,
            instituteId,
          },
        });

        if (!duplicateExists) {
          await AcademicYearTeacher.create(
            {
              id: crypto.randomUUID(),
              instituteId,
              academicYearId,
              teacherId,
              classId,
              subjectName: cleanSubject,
            },
            { transaction: t },
          );
        }
      }

      await t.commit();
      return res.json({
        message:
          "Faculty multi-class subject assignment matrix synchronized successfully.",
      });
    } catch (err) {
      await t.rollback();
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
  async revokeSubjectAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const { AcademicYearTeacher } = require("../models/index");

      const entry = await AcademicYearTeacher.findOne({
        where: { id: assignmentId, instituteId: req.user.instituteId },
      });
      if (!entry)
        return res.status(404).json({
          message: "Subject assignment mapping record not discovered.",
        });

      await entry.destroy();
      return res.json({
        message: "Subject allocation dropped cleanly from matrix directories.",
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }
}
module.exports = new AuthController();
