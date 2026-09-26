const mongoose = require('mongoose')
const slugify = require('slugify')
const Actor = require('./actorModel')

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror',
  'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Psychological'
]

const FIRST_FILM_YEAR = 1888

const MovieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'A movie must have a title'],
    trim: true,
    maxlength: [150, 'A movie title must have at most 150 characters']
  },

  description: {
    type: String,
    required: [true, 'A movie must have a description'],
    trim: true,
    maxlength: [2000, 'A movie description must have at most 2000 characters']
  },

  genre: {
    type: [String],
    required: [true, 'A movie must have at least one genre'],
    enum: {
      values: GENRES,
      message: 'Genre must be one of: ' + GENRES.join(', ')
    },
    validate: {
      validator: arr => arr.length > 0 && arr.length <= 3,
      message: 'A movie must have 1-3 genres'
    }
  },

  releaseYear: {
    type: Number,
    required: [true, 'A movie must have a year of release'],
    min: [FIRST_FILM_YEAR, `Release year must be ${FIRST_FILM_YEAR} or later`],
    validate: {
      validator: year => year <= new Date().getFullYear() + 5,
      message: 'Release year is too far in the future'
    }
  },

  duration: {
    type: Number,
    required: [true, 'A movie must have a length'],
    min: [1, 'Duration must be at least 1 minute']
  },

  // External critics score (e.g. IMDb). User score lives in ratingsAverage.
  rating: {
    type: Number,
    min: [0, 'Rating must be between 0 and 10'],
    max: [10, 'Rating must be between 0 and 10']
  },

  director: {
    type: String,
    required: [true, 'A movie must have a director'],
    trim: true
  },

  cast: {
    type: [{
      type: mongoose.Schema.ObjectId,
      ref: 'Actor'
    }],
    validate: {
      // Every referenced actor must exist
      validator: async ids => {
        const uniqueIds = [...new Set(ids.map(String))]
        return (await Actor.countDocuments({ _id: { $in: uniqueIds } })) === uniqueIds.length
      },
      message: 'Cast contains an actor that does not exist'
    }
  },

  posterUrl: {
    type: String,
    default: 'default-movie.jpg'
  },

  slug: String,

  // Calculated from reviews (see Review.calcAverageRatings) — never set by clients
  ratingsAverage: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
    set: val => Math.round(val * 10) / 10 // Round to 1 decimal
  },

  ratingsQuantity: {
    type: Number,
    default: 0
  },

  tmdbId: {
    type: Number,
    unique: true,
    sparse: true // Optional, but must be unique when present
  }
}, {
  timestamps: true,
  id: false,
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true }
})

// INDEXES
MovieSchema.index({ title: 'text', description: 'text' })
MovieSchema.index({ ratingsAverage: -1, rating: -1 })
MovieSchema.index({ genre: 1, releaseYear: -1 })
MovieSchema.index({ slug: 1 })

// VIRTUALS
// Virtual populate: reviews are stored on the Review side, not embedded here
MovieSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'movie',
  localField: '_id'
})

// MIDDLEWARE
MovieSchema.pre('save', function () {
  if (this.isModified('title')) this.slug = slugify(this.title, { lower: true, strict: true })
})

MovieSchema.pre(/^find/, function () {
  this.populate({
    path: 'cast',
    select: 'firstName lastName photo'
  })
})

const Movie = mongoose.model('Movie', MovieSchema)

Movie.GENRES = GENRES

module.exports = Movie
