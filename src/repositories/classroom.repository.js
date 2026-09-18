const BaseRepository = require('./base.repository');
const { Classroom } = require('../models/index');

class ClassroomRepository extends BaseRepository {
  constructor() {
    super(Classroom);
  }

  async findByTenant(instituteId) {
    return await this.find({ instituteId });
  }
}

module.exports = new ClassroomRepository();
