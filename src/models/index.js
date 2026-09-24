const sequelize = require('../config/db');
const Institute = require('./Institute'); 
const User = require('./User');
const Attendance = require('./Attendance');
const Classroom = require('./Classroom');
const AcademicYear = require('./AcademicYear');
const AcademicYearStudent = require('./AcademicYearStudent');
const AcademicYearStaff = require('./AcademicYearStaff');
const StudentProfile = require('./StudentProfile');

// ========================================================
// DEFINE RELATIONSHIPS AND TARGET ALIASES SECURELY
// ========================================================

// 🏫 A. Institute Relationships
Institute.hasMany(User, { foreignKey: 'instituteId', as: 'users', onDelete: 'CASCADE' });
User.belongsTo(Institute, { foreignKey: 'instituteId', as: 'institute' }); 

Institute.hasMany(Classroom, { foreignKey: 'instituteId', as: 'classrooms', onDelete: 'CASCADE' });
Classroom.belongsTo(Institute, { foreignKey: 'instituteId', as: 'instituteClassroom' }); 


// 🧑‍🎓 B. User (Student) <-> Attendance Relational Links
User.hasMany(Attendance, { foreignKey: 'studentId', as: 'attendanceLogs', onDelete: 'CASCADE' });
Attendance.belongsTo(User, { foreignKey: 'studentId', as: 'student' }); 


// 🏫 C. Classroom <-> Attendance Relational Links (Snapshot Mapping Fix)
Classroom.hasMany(Attendance, { 
  foreignKey: 'classId', 
  as: 'attendanceRecords', 
  onDelete: 'CASCADE' 
});
// 🚀 FIXED: Explicitly bind Attendance straight to Classroom via the log row's classId snapshot!
Attendance.belongsTo(Classroom, {
  foreignKey: 'classId',
  as: 'classroom'
});


// 🏫 D. Classroom <-> User (Students Matrix) Mappings
Classroom.hasMany(User, { foreignKey: 'classId', as: 'students', onDelete: 'SET NULL' });
User.belongsTo(Classroom, { foreignKey: 'classId', as: 'classroom' });

Institute.hasMany(AcademicYear, { foreignKey: 'instituteId', as: 'academicYears', onDelete: 'CASCADE' });
AcademicYear.belongsTo(Institute, { foreignKey: 'instituteId', as: 'instituteYear' });

AcademicYear.hasMany(Attendance, { foreignKey: 'academicYearId', as: 'yearLogs', onDelete: 'CASCADE' });
Attendance.belongsTo(AcademicYear, { foreignKey: 'academicYearId', as: 'academicYear' });

AcademicYear.hasMany(AcademicYearStudent, { foreignKey: 'academicYearId', as: 'enrolledStudents', onDelete: 'CASCADE' });
AcademicYearStudent.belongsTo(AcademicYear, { foreignKey: 'academicYearId', as: 'academicYear' });

User.hasMany(AcademicYearStudent, { foreignKey: 'studentId', as: 'yearlyEnrollments', onDelete: 'CASCADE' });
AcademicYearStudent.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

Classroom.hasMany(AcademicYearStudent, { foreignKey: 'classId', as: 'yearlyRosters', onDelete: 'CASCADE' });
AcademicYearStudent.belongsTo(Classroom, { foreignKey: 'classId', as: 'classroom' });

AcademicYear.hasMany(Classroom, { 
  foreignKey: 'academicYearId', 
  as: 'yearClassrooms', 
  onDelete: 'CASCADE' 
});
Classroom.belongsTo(AcademicYear, { 
  foreignKey: 'academicYearId', 
  as: 'academicYear' 
});

User.hasMany(AcademicYearStaff, { foreignKey: 'teacherId', as: 'staffAssignments' });
AcademicYearStaff.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });
AcademicYearStaff.belongsTo(Classroom, { foreignKey: 'classId', as: 'classroom' });

User.hasOne(StudentProfile, { foreignKey: 'studentId', as: 'profileExtension', onDelete: 'CASCADE' });
StudentProfile.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

module.exports = {
  sequelize,
  Institute,
  User,
  Attendance,
  Classroom,
  AcademicYear,
  AcademicYearStudent,
  AcademicYearStaff,
  StudentProfile
};
