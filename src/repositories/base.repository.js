class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data, options = {}) {
    return await this.model.create(data, options);
  }

  // ⚡ FIX: Uses standard Sequelize query object syntax
  async findOne(filter, includeOptions = []) {
    return await this.model.findOne({ where: filter, include: includeOptions });
  }

  async find(filter, includeOptions = []) {
    return await this.model.findAll({ where: filter, include: includeOptions });
  }
}

module.exports = BaseRepository;
