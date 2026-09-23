const BaseRepository = require('./base.repository');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

class AttendanceRepository extends BaseRepository {
  constructor() {
    super(Attendance);
  }

  async getTenantAttendance(filter) {
    // Performs an inner join match on the MySQL Users table
    return await this.find(filter, [
      {
        model: User,
        as: 'student',
        attributes: ['id', 'name', 'email']
      },
    ]);
  };
  async getClassStudents(instituteId, classId) {
    // 🚀 FIX: Swap out the non-existent custom string method for the unified repository find method
    return await userRepository.find({
      role: 'student',
      classId: classId,
      instituteId: instituteId
    });
  }
}

module.exports = new AttendanceRepository();
