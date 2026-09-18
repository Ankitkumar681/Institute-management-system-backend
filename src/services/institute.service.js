const { Institute, User, sequelize } = require('../models/index');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class InstituteService {
  async onboardNewSchool(body) {
    // 1. Unpack properties mapping defensively to capture flat and nested form parameters seamlessly
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    
    // Parse master administrator parameters fields
    const adminName = (body.adminName || body.admin?.name)?.trim();
    const adminEmail = (body.adminEmail || body.admin?.email)?.trim().toLowerCase();

    if (!name || !email || !adminName || !adminEmail) {
      const error = new Error('Mandatory onboarding parameter attributes missing.');
      error.statusCode = 400;
      throw error;
    }

    // 2. Validate email footprint clashes across active system tables
    const emailExists = await Institute.findOne({ where: { email } });
    const adminExists = await User.findOne({ where: { email: adminEmail } });

    if (emailExists || adminExists) {
      const error = new Error('Conflict Error: This school workspace or administrator email is already registered.');
      error.statusCode = 409;
      throw error;
    }

    // 🚀 EXECUTE ATOMIC TRANSACTION TO PREVENT PARTIAL OR CORRUPTED DATABASE RECORDS
    const transaction = await sequelize.transaction();

    try {
      // 3. Commit the Institutional profile row entry block
      const institute = await Institute.create({
        name,
        email,
        status: 'active'
      }, { transaction });

      // 4. Seeder auto-generated baseline password block (Secure temporary baseline string)
      // In production, this temporary string can be modified or dispatched via email workers!
      const temporaryPassword = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A1B2C3D4"
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

      // 5. Commit the linked Master Administrator account credentials row link profile
      const masterAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'institute_admin',
        status: 'active',
        instituteId: institute.id, // Binds the tenant foreign key constraint cleanly
        classId: null
      }, { transaction });

      // Commit transaction variables to disk memory safely
      await transaction.commit();
      return {
        institute,
        adminEmail,
        temporaryPassword // Passed back to controller to map custom UI overlays notifications
      };

    } catch (err) {
      // Revert records changes safely if database engine breaks during build executions steps
      await transaction.rollback();
      throw err;
    }
  }
}

module.exports = new InstituteService();
