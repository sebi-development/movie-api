
class APIFeatures {
  constructor(query, queryString) {
    this.query = query           // Mongoose query (Movie.find())
    this.queryString = queryString  // req.query object
  }

  filter() {
    // 1. Create querytring and remove special fields: page, sort, limit, fields
    const { page, sort, limit, fields, ...filterData } = this.queryString;
    // 2. Convert operators: gte, gt, lte, lt to $gte, $gt, $lte, $lt
    let queryStr = JSON.stringify(filterData)
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`)
    // 3. Apply filter to this.query
    this.query = this.query.find(JSON.parse(queryStr))

    return this
  }

  sort() {
    // YOUR CODE:
    // 1. Check if queryString has 'sort'
    // 2. If yes: split by comma and join with space
    //    Example: 'price,ratingsAverage' → 'price ratingsAverage'
    // 3. If no: default to '-createdAt' (newest first)
    // 4. Apply sort to this.query

    return this
  }

  limitFields() {
    // YOUR CODE:
    // 1. Check if queryString has 'fields'
    // 2. If yes: split by comma and join with space
    //    Example: 'title,director' → 'title director'
    // 3. If no: exclude '__v' field
    // 4. Apply select to this.query

    return this
  }

  paginate() {
    // YOUR CODE:
    // 1. Get page from queryString (default: 1)
    // 2. Get limit from queryString (default: 10)
    // 3. Calculate skip: (page - 1) * limit
    //    Example: page=3, limit=10 → skip=20
    // 4. Apply skip and limit to this.query
    return this
  }
}

module.exports = APIFeatures