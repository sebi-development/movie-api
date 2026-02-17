
class APIFeatures {
  constructor(query, queryString) {
    this.query = query           // Mongoose query (Movie.find())
    this.queryString = queryString  // req.query object
  }

  filter() {
    // 1. Create querytring and remove special fields: page, sort, limit, fields
    const { page, sort, limit, fields, search, ...filterData } = this.queryString;

    // 2. Convert operators: gte, gt, lte, lt to $gte, $gt, $lte, $lt
    let queryStr = JSON.stringify(filterData)
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`)

    this.query = this.query.find(JSON.parse(queryStr))

    return this
  }

  sort() {
    if (this.queryString.sort) {
      // If yes: split by comma and join with space
      const sortBy = this.queryString.sort.split(',').join(' ')
      this.query = this.query.sort(sortBy)
    }

    return this
  }

  limitFields() {
    if (this.queryString.fields) {
      const limitBy = this.queryString.fields.split(',').join(' ')
      this.query = this.query.select(limitBy)
    } else {
      // If no: exclude '__v' field
      this.query = this.query.select('-__v')
    }

    return this
  }

  paginate() {
    // Get page from queryString (default: 1)
    const page = this.queryString.page * 1 || 1
    // Get limit from queryString (default: 10)
    const limit = this.queryString.limit || 10
    // Calculate skip: (page - 1) * limit
    const skip = (page - 1) * limit
    // Apply skip and limit to this.query
    this.query = this.query.skip(skip).limit(limit)
    return this
  }

  search() {
    if (this.queryString.search) {
      this.query = this.query.find({
        $text: { $search: this.queryString.search }
      })
    }
    return this
  }
}

module.exports = APIFeatures