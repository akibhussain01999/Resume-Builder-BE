const parsePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const parseSort = (sortValue, allowedFields = ['createdAt', 'updatedAt']) => {
  if (!sortValue) {
    return { updatedAt: -1 };
  }

  const [field, direction] = String(sortValue).split(':');
  if (!allowedFields.includes(field)) {
    return { updatedAt: -1 };
  }

  return { [field]: direction === 'asc' ? 1 : -1 };
};

module.exports = {
  parsePagination,
  parseSort
};
