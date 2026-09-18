class AttendanceResource {
  static single(record) {
    if (!record) return null;
    return {
      id: record._id,
      date: record.date,
      status: record.status,
      classId: record.classId,
      student: record.studentId ? {
        id: record.studentId._id,
        name: record.studentId.name
      } : null
    };
  }

  static collection(records) {
    return records.map(record => this.single(record));
  }
}

module.exports = AttendanceResource;
