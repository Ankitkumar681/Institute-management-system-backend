const userRepository = require("../repositories/user.repository");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Institute, User } = require("../models/index");
const sequelize = require("../config/db");

class AuthService {
  async registerUser(data) {
    const { name, email, password, role } = data;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser)
      throw Object.assign(new Error("Email already exists"), {
        statusCode: 400,
      });

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🚀 If role is institute_admin, run an ACID transaction to seed both tables
    if (role === "institute_admin") {
      const t = await sequelize.transaction();
      try {
        // 1. Provision Master Tenant Container Row
        const newInstitute = await Institute.create(
          { name, email },
          { transaction: t },
        );

        // 2. Create the associated Admin User mapping to the new Institute ID
        const newAdmin = await User.create(
          {
            name,
            email,
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

    // Handle standard teacher/student insertions below
    return await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      instituteId: data.instituteId,
      classId: data.classId || null,
    });
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

    // 🚀 STEP 4: Sign and return the multi-tenant JWT session token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        instituteId: user.instituteId || null,
        classId: user.classId || null,
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
}

module.exports = new AuthService();
