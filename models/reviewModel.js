const mongoose = require('mongoose')
const Movie = require('./movieModel')

const reviewSchema = new mongoose.Schema({
  review: {
    type: String,
    required: [true, 'Review cannot be empty'],
    trim: true,
    minlength: [10, 'Review must be at least 10 characters'],
    maxlength: [500, 'Review must be less than 500 characters']
  },

  rating: {
    type: Number,
    required: [true, 'A review must contain a rating'],
    min: [1, 'Rating must be at least 1'],
    max: [10, 'Rating cannot exceed 10']
  },

  // RELATIONSHIPS

  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Review must be published by a user']
  },

  movie: {
    type: mongoose.Schema.ObjectId,
    ref: 'Movie',
    required: [true, 'Review must belong to a movie']
  }
}, {
  timestamps: true,
  id: false,
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true }
})

// One review per user per movie
reviewSchema.index({ movie: 1, user: 1 }, { unique: true })

// STATICS
// Recalculates ratingsAverage / ratingsQuantity on the movie from its reviews
reviewSchema.statics.calcAverageRatings = async function (movieId) {
  const stats = await this.aggregate([
    { $match: { movie: new mongoose.Types.ObjectId(String(movieId)) } },
    {
      $group: {
        _id: '$movie',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ])

  await Movie.updateOne({ _id: movieId }, {
    ratingsQuantity: stats.length ? stats[0].nRating : 0,
    ratingsAverage: stats.length ? stats[0].avgRating : 0
  })
}

// MIDDLEWARE

// Populate author info automatically (null if the account was deactivated)
reviewSchema.pre(/^find/, function () {
  this.populate({
    path: 'user',
    select: 'name photo'
  })
})

// Keep the movie's rating stats in sync. Hooks are awaited, so the response
// is only sent once the movie has been updated.

// review.save() — create and update
reviewSchema.post('save', async function () {
  await this.constructor.calcAverageRatings(this.movie)
})

// review.deleteOne() on a document
reviewSchema.post('deleteOne', { document: true, query: false }, async function () {
  await this.constructor.calcAverageRatings(this.movie)
})

// Review.findByIdAndUpdate / findByIdAndDelete / findOneAnd* — post hook receives the doc
reviewSchema.post(/^findOneAnd/, async function (doc) {
  if (doc) await doc.constructor.calcAverageRatings(doc.movie)
})

const Review = mongoose.model('Review', reviewSchema)
module.exports = Review
