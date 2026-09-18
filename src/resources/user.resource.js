class UserResource {
  static single(user) {
    if (!user) return null;
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || 'active', 
      classId: user.classId || null,
      instituteId: user.instituteId || null,
      
      // 🚀 FIXED: Wrapped with an explicit null-safety gate check to block Super Admin crashes!
      institute: user.institute ? {
        name: user.institute.name,
        status: user.institute.status
      } : null, 

      classroom: user.classroom ? {
        id: user.classroom.id,
        name: user.classroom.name,
        section: user.classroom.section
      } : null,
      joinedAt: user.createdAt
    };
  }

  static collection(users) {
    if (!Array.isArray(users)) return [];
    return users.map(user => this.single(user));
  }
}

module.exports = UserResource;
