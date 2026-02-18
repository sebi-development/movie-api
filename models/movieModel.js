const mongoose = require('mongoose')
const slugify = require('slugify')

const MovieSchema = mongoose.Schema({
  title: {
    type: String,
    required: [true, 'A movie must have a title']
  },
  description: {
    type: String,
    required: [true, 'A movie must have a description']
  },
  genre: {
    type: [String],
    required: [true, 'A movie must have at least one genre'],
    enum: {
      values: [
        'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
        'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror',
        'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Psychological'
      ],
      message: 'Genre must be one of the predefined categories'
    },
    validate: {
      validator: function (arr) {
        return arr.length > 0 && arr.length <= 3
      },
      message: 'A movie must have 1-3 genres'
    }
  },

  releaseYear: {
    type: Number,
    required: [true, 'A movie must have a year of release']
  },

  duration: {
    type: Number,
    required: [true, 'A movie must have a length'],
    min: [1, 'Duration must be at least 1 minute']
  },

  rating: {
    type: Number,
    min: 0,
    max: 10
  },

  director: {
    type: String,
    required: [true, 'A movie must have a director']
  },

  cast: [String],

  posterUrl: {
    type: String,
    default: 'default-movie.jpg'
  },

  slug: String,

  ratingsAverage: {
    type: Number,
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
    sparse: true  // Allows null, but if exists must be unique
  }
}, {
  // Enable virtual properties in JSON/Object output
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// INDEXES
MovieSchema.index({ title: 'text', description: 'text' })

// MIDDLEWARE
MovieSchema.pre('save', async function () {
  this.slug = slugify(this.title, { lower: true })
})

// VIRTUALS
MovieSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'movie',
  localField: '_id'
})

const Movie = mongoose.model('Movie', MovieSchema)

module.exports = Movie