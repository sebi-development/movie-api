const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100
const RESERVED_FIELDS = ['page', 'sort', 'limit', 'fields', 'search']
const ALLOWED_OPERATORS = ['gte', 'gt', 'lte', 'lt', 'ne']

class APIFeatures {
  constructor (query, queryString) {
    this.query = query // Mongoose query (e.g. Movie.find())
    this.queryString = queryString // req.query object
  }

  // ?genre=Drama&duration[gte]=120&genre=Crime
  //   -> { genre: { $in: ['Drama', 'Crime'] }, duration: { $gte: 120 } }
  filter () {
    const filter = {}

    Object.entries(this.queryString).forEach(([field, value]) => {
      if (RESERVED_FIELDS.includes(field)) return

      if (Array.isArray(value)) {
        filter[field] = { $in: value }
      } else if (value !== null && typeof value === 'object') {
        // Only map whitelisted comparison operators, silently drop anything else
        const operators = {}
        Object.entries(value).forEach(([op, opValue]) => {
          if (ALLOWED_OPERATORS.includes(op)) operators[`$${op}`] = opValue
        })
        if (Object.keys(operators).length) filter[field] = operators
      } else {
        filter[field] = value
      }
    })

    this.query = this.query.find(filter)
    return this
  }

  // ?search=dark knight -> MongoDB full-text search (requires a text index)
  search () {
    if (this.queryString.search) {
      this.query = this.query.find({ $text: { $search: String(this.queryString.search) } })
    }
    return this
  }

  // ?sort=-ratingsAverage,releaseYear
  sort () {
    if (this.queryString.sort) {
      const sortBy = String(this.queryString.sort).split(',').join(' ')
      this.query = this.query.sort(sortBy)
    } else if (this.queryString.search) {
      this.query = this.query.sort({ score: { $meta: 'textScore' } })
    } else {
      // _id as tie-breaker keeps pagination deterministic
      this.query = this.query.sort('-createdAt _id')
    }
    return this
  }

  // ?fields=title,releaseYear
  limitFields () {
    if (this.queryString.fields) {
      // Strip "+" so clients can't force-select hidden fields such as +password
      const fields = String(this.queryString.fields)
        .split(',')
        .map(field => field.trim().replace(/^\+/, ''))
        .filter(Boolean)
        .join(' ')
      this.query = this.query.select(fields)
    } else {
      this.query = this.query.select('-__v')
    }
    return this
  }

  // ?page=2&limit=20
  paginate () {
    const page = Math.max(parseInt(this.queryString.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(this.queryString.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)

    this.page = page
    this.limit = limit
    this.query = this.query.skip((page - 1) * limit).limit(limit)
    return this
  }

  // Counts every document matching the filter/search, ignoring pagination
  async count () {
    return this.query.model.countDocuments(this.query.getFilter())
  }
}

module.exports = APIFeatures
