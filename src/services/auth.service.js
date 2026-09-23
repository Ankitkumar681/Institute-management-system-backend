const userRepository = require("../repositories/user.repository");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Institute, User, AcademicYear } = require("../models/index");
const sequelize = require("../config/db");

class AuthService {
  async registerUser(data) {
    const { name, email, password, role, academicYearId } = data;
    const cleanEmail = email.trim().toLowerCase();

    // 🚀 STEP 1: Find if a user footprint already exists with this email address
    const existingUser = await userRepository.findByEmail(cleanEmail);

    if (existingUser) {
      // Security Guard A: If it's a teacher or admin clashing, block it immediately
      if (role !== "student" || existingUser.role !== "student") {
        throw Object.assign(
          new Error("Email already exists across system staff directories"),
          {
            statusCode: 400,
          },
        );
      }

      // ========================================================================
      // 🚀 MULTI-YEAR CROSSOVER ENROLLMENT (Non-Breaking Promotion Route)
      // ========================================================================
      // The student is already a user! We just link them to the new year roster.
      const models = require("../models/index");
      const AcademicYearStudent = models.AcademicYearStudent;

      if (AcademicYearStudent && data.classId && academicYearId) {
        // Prevent duplicate junction enrollment seeds within the SAME active year frame
        const alreadyLinked = await AcademicYearStudent.findOne({
          where: {
            academicYearId,
            studentId: existingUser.id,
            instituteId: data.instituteId,
          },
        });

        if (alreadyLinked) {
          // 🚀 FLEXIBLE UPGRADE: Instead of throwing an error, update their classroom placement dynamically!
          await alreadyLinked.update({ classId: data.classId });
          await existingUser.update({ classId: data.classId });

          console.log(
            `[Cross-Year Move] Re-assigned existing student ${existingUser.name} to Class ID: ${data.classId} for Year ID: ${academicYearId}`,
          );
          return existingUser;
        }

        // 1. Provision a new history roadmap node row entry natively
        await AcademicYearStudent.create({
          id: require("crypto").randomUUID(),
          instituteId: data.instituteId,
          academicYearId: academicYearId,
          studentId: existingUser.id,
          classId: data.classId,
        });

        // 2. Update their active class pointer so current dashboard sessions pick it up instantly
        await existingUser.update({ classId: data.classId });

        console.log(
          `[Cross-Year Enrollment] Linked existing student ${existingUser.name} to new Year ID: ${academicYearId}`,
        );
        return existingUser; // Return the student profile safely bypassing user generation errors!
      }
    }

    // ========================================================================
    // STEP 2: Standard Freshman Enrollment Flow (Runs only if email is brand new)
    // ========================================================================
    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === "institute_admin") {
      const t = await sequelize.transaction();
      try {
        const newInstitute = await Institute.create(
          { name, email: cleanEmail },
          { transaction: t },
        );
        const newAdmin = await User.create(
          {
            name,
            email: cleanEmail,
            password: hashedPassword,
            role: "institute_admin",
            instituteId: newInstitute.id,
          },
          { transaction: t },
        );

        await t.commit();
        return newAdmin;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    const newUser = await User.create({
      name,
      email: cleanEmail,
      password: hashedPassword,
      role,
      instituteId: data.instituteId,
      classId: data.classId || null,
    });

    // Seed initial freshman year timeline maps
    if (role === "student" && data.classId && academicYearId) {
      try {
        const models = require("../models/index");
        const AcademicYearStudent = models.AcademicYearStudent;

        if (AcademicYearStudent) {
          await AcademicYearStudent.create({
            id: require("crypto").randomUUID(),
            instituteId: data.instituteId,
            academicYearId: academicYearId,
            studentId: newUser.id,
            classId: data.classId,
          });
        }
      } catch (err) {
        console.error(
          "Baseline tracking registry seed skipped safely: ",
          err.message,
        );
      }
    }

    return newUser;
  }
  async loginUser(body) {
    const { email, password } = body;

    if (!email || !password) {
      const error = new Error("Please provide both email and password.");
      error.statusCode = 400;
      throw error;
    }

    const cleanEmail = email.trim().toLowerCase();

    // 🚀 STEP 1: Fetch the user row with zero join queries to prevent association crashes completely
    const user = await User.findOne({ where: { email: cleanEmail } });

    if (!user) {
      const error = new Error(
        "Invalid credentials. User profile footprint not found.",
      );
      error.statusCode = 401;
      throw error;
    }

    // 🚀 STEP 2: Verify password hashing metrics BEFORE checking workspace activations
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const error = new Error("Invalid credentials.");
      error.statusCode = 401;
      throw error;
    }

    // 🚀 STEP 3: Handle structural status checks safely based on role definitions
    if (user.status === "inactive") {
      const error = new Error(
        "Your profile account has been deactivated by your administrator.",
      );
      error.statusCode = 403;
      throw error;
    }

    // If it's a school tenant, verify their institute status as an independent, isolated query
    if (user.role !== "super_admin" && user.instituteId) {
      const school = await Institute.findByPk(user.instituteId);
      if (school && school.status === "inactive") {
        const error = new Error(
          "Your multi-tenant school workspace has been suspended by the Super Admin.",
        );
        error.statusCode = 403;
        throw error;
      }

      // Inject the school properties onto the user object manually to satisfy your resource serializer
      user.institute = school;
    }
    const activeYear = await AcademicYear.findOne({
      where: { instituteId: user.instituteId, isActive: true },
    });

    const yearIdValue = activeYear ? activeYear.id : null;
    if (user.setDataValue) {
      user.setDataValue("academicYearId", yearIdValue);
    } else {
      user.academicYearId = yearIdValue;
    }
    // 🚀 STEP 4: Sign and return the multi-tenant JWT session token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        instituteId: user.instituteId || null,
        classId: user.classId || null,
        academicYearId: yearIdValue,
      },
      process.env.JWT_SECRET || "your_super_secret_jwt_key",
      { expiresIn: "24h" },
    );

    return { token, user };
  }
  async checkUserStatus(userId) {
    // 1. Fetch user data including their institute profile context
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Institute,
          as: "institute",
          required: false,
          attributes: ["status"],
        },
      ],
    });

    if (!user) {
      const error = new Error("Profile record footprint not discovered.");
      error.statusCode = 404;
      throw error;
    }

    // 2. Security Gate A: Instantly block deactivated personal user accounts
    if (user.status === "inactive") {
      const error = new Error(
        "Your profile account has been marked inactive by the administrator.",
      );
      error.statusCode = 403;
      throw error;
    }

    if (user.role !== "super_admin" && user.institute) {
      if (user.institute.status === "inactive") {
        const error = new Error("INSTITUTE_SUSPENDED");
        error.statusCode = 403;
        throw error;
      }
    }

    return { status: "active", role: user.role };
  }
  async generateRecoveryToken(email) {
    if (!email) {
      const error = new Error(
        "Please provide a valid account email parameter.",
      );
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
      const error = new Error(
        "Account record footprint not discovered inside database.",
      );
      error.statusCode = 404;
      throw error;
    }

    // Generate a unique 6-character clean numeric string passcode token (e.g. "589214")
    const numericPasscode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Store token parameters safely with an explicit 15-minute expiration timestamp
    user.resetToken = numericPasscode;
    user.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 Minutes
    await user.save();

    return {
      message: "Recovery reference token generated successfully.",
      email: user.email,
      role: user.role,
      token: numericPasscode, // Displayed in admin dashboards or logs for quick manual recovery handoff
    };
  }

  // 🚀 VALIDATE PASSCODE HASH AND COMMIT NEW SECURE PASSWORD CELL
  async commitPasswordReset(email, passcode, newPassword) {
    if (!email || !passcode || !newPassword) {
      const error = new Error(
        "Mandatory password reset confirmation parameters missing.",
      );
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
      const error = new Error("Authentication window mismatch.");
      error.statusCode = 404;
      throw error;
    }

    // Validate token payload matching constraints
    if (!user.resetToken || user.resetToken !== String(passcode).trim()) {
      const error = new Error(
        "Invalid recovery passcode verification token mismatch.",
      );
      error.statusCode = 400;
      throw error;
    }

    // Verify token lifecycle time constraints parameters
    if (new Date() > new Date(user.resetTokenExpires)) {
      const error = new Error(
        "Recovery passcode footprint has expired. Request a new token block.",
      );
      error.statusCode = 400;
      throw error;
    }

    // Encrypt the new target credentials master password safely
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword.trim(), salt);

    // Clear out token parameters memory cells on success to prevent reuse exploits
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    return {
      message: "Master account credentials password reset completed cleanly.",
    };
  }
  async importStudentsBulk(
    fileBuffer,
    instituteId,
    targetClassId,
    targetAcademicYearId,
  ) {
    if (!targetClassId || !targetAcademicYearId) {
      throw new Error(
        "Parameters Missing: Both Class selection and Academic Year context are required.",
      );
    }
    const { User, AcademicYearStudent } = require("../models/index");

    if (!AcademicYearStudent) {
      throw new Error(
        "Infrastructure Error: AcademicYearStudent model could not be verified inside database schema contexts.",
      );
    }
    // Convert raw spreadsheet file byte buffers into clear readable lines string arrays
    const fileContent = fileBuffer.toString("utf8");
    const rows = fileContent
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");

    if (rows.length <= 1)
      throw new Error(
        "The uploaded CSV spreadsheet file contains no student record rows.",
      );

    // Parse header rows indexes (Expected format columns: Name, Email, TemporaryPassword)
    const recordsEnrolled = [];
    const defaultHashedPassword = await bcrypt.hash("Student@123", 10); // Standard temporary login credential code

    // Loop through row entries skipping column headers line index 0
    for (let i = 1; i < rows.length; i++) {
      const columns = rows[i]
        .split(",")
        .map((cell) => cell.trim().replace(/^["']|["']$/g, ""));
      if (columns.length < 2 || !columns[0] || !columns[1]) continue; // Skip incomplete blank rows

      const studentName = columns[0];
      const studentEmail = columns[1].toLowerCase();

      // Check if user account email exists globally first to map duplicates gracefully
      let studentUser = await User.findOne({ where: { email: studentEmail } });

      if (!studentUser) {
        studentUser = await User.create({
          id: crypto.randomUUID(),
          name: studentName,
          email: studentEmail,
          password: defaultHashedPassword,
          role: "student",
          instituteId,
          classId: targetClassId,
        });
      } else {
        // Overwrite their primary class pointer to align active dashboards instantly
        await studentUser.update({ classId: targetClassId });
      }

      // Check for or provision history timeline ledger junction table links
      const alreadyMapped = await AcademicYearStudent.findOne({
        where: {
          academicYearId: targetAcademicYearId,
          studentId: studentUser.id,
          instituteId,
        },
      });

      if (!alreadyMapped) {
        await AcademicYearStudent.create({
          id: crypto.randomUUID(),
          instituteId,
          academicYearId: targetAcademicYearId,
          studentId: studentUser.id,
          classId: targetClassId,
        });
      } else {
        await alreadyMapped.update({ classId: targetClassId });
      }

      recordsEnrolled.push({ name: studentName, email: studentEmail });
    }

    return { totalImported: recordsEnrolled.length, students: recordsEnrolled };
  }
}

module.exports = new AuthService();
