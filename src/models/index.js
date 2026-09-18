const sequelize = require('../config/db');
const Institute = require('./Institute'); 
const User = require('./User');
const Attendance = require('./Attendance');
const Classroom = require('./Classroom');

// ========================================================
// DEFINE RELATIONSHIPS AND TARGET ALIASES SECURELY
// ========================================================

// 🏫 A. Institute Relationships
Institute.hasMany(User, { foreignKey: 'instituteId', as: 'users', onDelete: 'CASCADE' });
User.belongsTo(Institute, { foreignKey: 'instituteId', as: 'institute' }); // 🚀 ONLY ONCE HERE

Institute.hasMany(Classroom, { foreignKey: 'instituteId', as: 'classrooms', onDelete: 'CASCADE' });
Classroom.belongsTo(Institute, { foreignKey: 'instituteId', as: 'instituteClassroom' }); 


// 🧑‍🎓 B. User (Student) <-> Attendance Relational Links
User.hasMany(Attendance, { foreignKey: 'studentId', as: 'attendanceLogs', onDelete: 'CASCADE' });
Attendance.belongsTo(User, { foreignKey: 'studentId', as: 'student' }); 


// 🏫 C. Classroom <-> Attendance Relational Links
Classroom.hasMany(Attendance, { 
  foreignKey: 'classId', 
  as: 'attendanceRecords', 
  onDelete: 'CASCADE' 
});
Attendance.belongsTo(Classroom, { 
  foreignKey: 'classId', 
  as: 'classroom' 
});


// 🏫 D. Classroom <-> User (Students Matrix) Mappings
Classroom.hasMany(User, { foreignKey: 'classId', as: 'students', onDelete: 'SET NULL' });
User.belongsTo(Classroom, { foreignKey: 'classId', as: 'classroom' });

module.exports = {
  sequelize,
  Institute,
  User,
  Attendance,
  Classroom
};
