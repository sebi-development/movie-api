// Returns a shallow copy of `obj` containing only the whitelisted fields.
// Used to stop clients from mass-assigning protected fields (role, ratingsAverage, ...).
module.exports = (obj, ...allowedFields) => {
  const filtered = {}

  allowedFields.forEach(field => {
    if (obj[field] !== undefined) filtered[field] = obj[field]
  })
  return filtered
}
