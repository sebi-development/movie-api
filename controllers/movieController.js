const Movie = require('../models/movieModel')
const AppError = require('../utils/AppError')

const catchAsync = require('../utils/catchAsync')

exports.getAllMovies = catchAsync(async (req, res, next) => {
  const movies = await Movie.find()

  res.status(200).json({
    status: 'success',
    results: movies.length,
    data: {
      movies
    }
  })
})

exports.getMovie = catchAsync(async (req, res, next) => {

  const movie = await Movie.findById(req.params.id)

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
  const newMovie = await Movie.create({
    title: req.body.title,
    description: req.body.description,
    director: req.body.director,
    genre: req.body.genre,
    cast: req.body.cast,
    releaseYear: req.body.releaseYear,
    duration: req.body.duration,
    posterUrl: req.body.posterUrl
  })

  res.status(201).json({
    status: 'success',
    data: {
      movie: newMovie
    }
  })
})

exports.updateMovie = catchAsync(async (req, res, next) => {
  const movie = await Movie.findOneAndUpdate(req.params.id, req.body, {
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
