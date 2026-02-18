exports.filterObj = (obj, ...allowedFields) => {
  const filtered = {}

  allowedFields.forEach(field => {
    if (obj[field] !== undefined) filtered[field] = obj[field]
  })
  return filtered
}