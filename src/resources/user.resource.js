class UserResource {
  static single(user) {
    if (!user) return null;
    let mappedClassroom = user.classroom;

    if (user.yearlyEnrollments && user.yearlyEnrollments.length > 0) {
      const historicalData = user.yearlyEnrollments[0]; // Extract the targeted year block row
      if (historicalData && historicalData.classroom) {
        mappedClassroom = historicalData.classroom;
      }
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || "active",
      classId: user.classId || null,
      instituteId: user.instituteId || null,

      // 🚀 FIXED: Wrapped with an explicit null-safety gate check to block Super Admin crashes!
      institute: user.institute
        ? {
            name: user.institute.name,
            status: user.institute.status,
          }
        : null,

      classroom: mappedClassroom
        ? {
            id: mappedClassroom.id,
            name: mappedClassroom.name,
            section: mappedClassroom.section,
          }
        : null,
      profileExtension: user.profileExtension
        ? {
            parentName: user.profileExtension.parentName,
            parentContact: user.profileExtension.parentContact,
            parentEmail: user.profileExtension.parentEmail,
            bloodGroup: user.profileExtension.bloodGroup,
          }
        : {
            parentName: "Not Provided",
            parentContact: "Not Provided",
            parentEmail: null,
            bloodGroup: "N/A",
          },
      joinedAt: user.createdAt,
    };
  }

  static collection(users) {
    if (!Array.isArray(users)) return [];
    return users.map((user) => this.single(user));
  }
}

module.exports = UserResource;
