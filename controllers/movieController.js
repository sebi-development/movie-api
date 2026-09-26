const Movie = require('../models/movieModel')
const Review = require('../models/reviewModel')
const User = require('../models/userModel')
const catchAsync = require('../utils/catchAsync')
const factory = require('./handlerFactory')

// ratingsAverage / ratingsQuantity / slug are managed by the server
const ALLOWED_FIELDS = [
  'title', 'description', 'director', 'genre', 'cast',
  'releaseYear', 'duration', 'rating', 'posterUrl', 'tmdbId'
]

// Alias middleware: GET /movies/top-5-movies
exports.aliasTopMovies = (req, res, next) => {
  req.query.limit = '5'
  req.query.sort = '-ratingsAverage,-rating'
  req.query.fields = req.query.fields || 'title,releaseYear,genre,director,ratingsAverage,ratingsQuantity,rating,posterUrl'
  next()
}

exports.getAllMovies = factory.getAll(Movie, { key: 'movies', searchable: true })

exports.getMovie = factory.getOne(Movie, {
  key: 'movie',
  populate: { path: 'reviews', select: 'review rating user createdAt', options: { sort: '-createdAt' } }
})

exports.createMovie = factory.createOne(Movie, { key: 'movie', allowedFields: ALLOWED_FIELDS })

exports.updateMovie = factory.updateOne(Movie, { key: 'movie', allowedFields: ALLOWED_FIELDS })

// Deleting a movie also removes its reviews and pulls it from every watchlist
exports.deleteMovie = factory.deleteOne(Movie, {
  afterDelete: movie => Promise.all([
    Review.deleteMany({ movie: movie._id }),
    User.updateMany({ watchlist: movie._id }, { $pull: { watchlist: movie._id } })
  ])
})

// GET /movies/movie-stats — aggregation pipeline grouped by genre
exports.getMovieStats = catchAsync(async (req, res, next) => {
  const stats = await Movie.aggregate([
    { $unwind: '$genre' },
    {
      $group: {
        _id: '$genre',
        numMovies: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgUserRating: { $avg: '$ratingsAverage' },
        avgCriticRating: { $avg: '$rating' },
        avgDuration: { $avg: '$duration' },
        minDuration: { $min: '$duration' },
        maxDuration: { $max: '$duration' },
        oldestRelease: { $min: '$releaseYear' },
        newestRelease: { $max: '$releaseYear' },
        movies: { $push: '$title' }
      }
    },
    {
      $project: {
        _id: 0,
        genre: '$_id',
        numMovies: 1,
        numRatings: 1,
        avgUserRating: { $round: ['$avgUserRating', 1] },
        avgCriticRating: { $round: ['$avgCriticRating', 1] },
        avgDuration: { $round: ['$avgDuration', 0] },
        minDuration: 1,
        maxDuration: 1,
        oldestRelease: 1,
        newestRelease: 1,
        movies: 1
      }
    },
    { $sort: { numMovies: -1, genre: 1 } }
  ])

  res.status(200).json({
    status: 'success',
    results: stats.length,
    data: { stats }
  })
})
