const Movie = require('../models/movieModel')
const AppError = require('../utils/AppError')
const APIFeatures = require('../utils/apiFeatures')
const catchAsync = require('../utils/catchAsync')
const filterObj = require('../utils/filterObj')

exports.getAllMovies = catchAsync(async (req, res, next) => {
  // BUILD QUERY
  const features = new APIFeatures(Movie.find(), req.query).search().filter().sort().limitFields().paginate()
  const movies = await features.query

  res.status(200).json({
    status: 'success',
    data: {
      results: movies.length,
      data: { movies }
    }
  })
})

exports.getMovie = catchAsync(async (req, res, next) => {

  const movie = await Movie.findById(req.params.id).populate('reviews')

  if (!movie) {
    return next(new AppError('Movie not found', 404))
  }

  res.status(200).json({
    status: 'success',
    data: {
      movie
    }
  })
})

exports.createMovie = catchAsync(async (req, res, next) => {
  const filteredBody = filterObj(req.body, 'title', 'description', 'director', 'genre', 'cast', 'releaseYear', 'duration', 'posterUrl')
  const newMovie = await Movie.create(filteredBody)

  res.status(201).json({
    status: 'success',
    data: {
      movie: newMovie
    }
  })
})

exports.updateMovie = catchAsync(async (req, res, next) => {
  const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })

  if (!movie) return next(new AppError('Movie not found', 404))

  res.status(200).json({
    status: 'success',
    data: {
      movie
    }
  })
})

exports.deleteMovie = catchAsync(async (req, res, next) => {
  const movie = await Movie.findByIdAndDelete(req.params.id)

  if (!movie) return next(new AppError('Movie not found', 404))
  res.status(204).json({
    status: 'success',
    data: null
  })
})
