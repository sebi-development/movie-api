const mongoose = require('mongoose')

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
    type: String,
    enum: [['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
      'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller']],
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

  movieLength: {
    type: Number,
    required: [true, 'A movie must have a length']
  },

  rating: {
    type: Number,
    min: 0,
    max: 10
  },
})

const Movie = mongoose.model('Movie', MovieSchema)
module.exports = Movie