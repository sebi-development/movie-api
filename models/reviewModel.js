const mongoose = require('mongoose')
const Movie = require('./movieModel')

const reviewSchema = mongoose.Schema({
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

  createdAt: {
    type: Date,
    default: Date.now
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

reviewSchema.statics.calcAverageRatings = async function (movieId) {
  const stats = await this.aggregate([
    {
      $match: { movie: movieId }
    },
    {
      $group: {
        _id: '$movie',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ])

  if (stats.length > 0) {
    await Movie.findByIdAndUpdate(movieId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating
    })
  } else {
    await Movie.findByIdAndUpdate(movieId, {
      ratingsQuantity: 0,
      ratingsAverage: 0
    })
  }
}

reviewSchema.index({ movie: 1, user: 1 }, { unique: true })

// Populate user info automatically
reviewSchema.pre(/^find/, function () {
  this.populate({
    path: 'user',
    select: 'name photo'
  })
})

// Trigger calculation on save
reviewSchema.post('save', function () {
  this.constructor.calcAverageRatings(this.movie).catch(err => console.error('Failed to calculate ratings:', err))
})
// Trigger calculation on update/delete
reviewSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne()
  next()
})

reviewSchema.post(/^findOneAnd/, async function () {
  await this.r.constructor.calcAverageRatings(this.r.movie).catch(err => console.error('Rating calc failed:', err))
})

const Review = mongoose.model('Review', reviewSchema)
module.exports = Review