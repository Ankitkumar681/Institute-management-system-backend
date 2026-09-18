const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/db');
// ⚡ FIX: Import your models context layer to ensure relationships are loaded
const { User, Classroom } = require('../models/index'); 

const seedSampleStudents = async () => {
  try {
    await sequelize.authenticate();
    console.log('🔄 Connected to MySQL for student seeding...');
    
    console.log('🔄 Altering table structures to match current model files...');
    await sequelize.sync({ alter: true });

    // 1. Locate an active school administrator to grab the tenant workspace ID
    const instituteAdmin = await User.findOne({ where: { role: 'institute_admin' } });
    if (!instituteAdmin) {
      ('❌ No Institute Admin found. Please register a school via the dashboard UI first.');
      process.exit(1);
    }

    const schoolId = instituteAdmin.instituteId;
    console.log(`🏫 Mapping sample data to School Workspace ID: ${schoolId}`);

    // 2. ⚡ FIX: Find or create a valid parent Classroom row inside the database first!
    let targetClass = await Classroom.findOne({ 
      where: { name: 'Grade-10', section: 'Section-A', instituteId: schoolId } 
    });

    if (!targetClass) {
      console.log('📝 Creating required parent Classroom entry to satisfy Foreign Key rules...');
      targetClass = await Classroom.create({
        id: uuidv4(),
        name: 'Grade-10',
        section: 'Section-A',
        instituteId: schoolId
      });
    }

    // 3. Clean out old student records matching this specific class instance safely
    await User.destroy({ where: { role: 'student', classId: targetClass.id } });

    const passwordHash = await bcrypt.hash('StudentPass123!', 10);
    const mockStudents = [
      { name: 'Aarav Sharma', email: 'aarav@school.com' },
      { name: 'Diya Patel', email: 'diya@school.com' },
      { name: 'Kabir Singh', email: 'kabir@school.com' },
      { name: 'Ananya Rao', email: 'ananya@school.com' },
      { name: 'Vivaan Joshi', email: 'vivaan@school.com' }
    ];

    // 4. Map the valid targetClass.id UUID field instead of a legacy string text
    const studentRecords = mockStudents.map(student => ({
      id: uuidv4(),
      name: student.name,
      email: student.email,
      password: passwordHash,
      role: 'student',
      classId: targetClass.id, // ⚡ Maps the perfectly validated primary key UUID link!
      instituteId: schoolId
    }));

    // 5. Commit row array insertion safely
    await User.bulkCreate(studentRecords);
    
    console.log(`🎉 Successfully seeded 5 sample students into Class "${targetClass.name} (${targetClass.section})"!`);
    console.log('🔑 Default Student Password: StudentPass123!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedSampleStudents();
