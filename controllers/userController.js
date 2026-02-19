const User = require('../models/userModel')
const Movie = require('../models/movieModel')
const AppError = require('../utils/AppError')
const catchAsync = require('../utils/catchAsync')

exports.getMyWatchlist = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate({
    path: 'watchlist',
    select: 'title posterUrl releaseYear ratingsAverage duration genre'
  })

  res.status(200).json({
    status: 'success',
    results: user.watchlist.length,
    data: {
      watchlist: user.watchlist
    }
  })
})

exports.addToWatchList = catchAsync(async (req, res, next) => {
  const movieId = req.params.movieId
  if (!movieId) return next(new AppError('Movie ID is required', 400))

  const user = await User.findById(req.user.id)
  if (user.watchlist.some(id => id.toString() === movieId)) return next(new AppError('Movie already in watchlist', 400))

  user.watchlist.push(movieId)
  await user.save({ validateBeforeSave: false })

  res.status(200).json({
    status: 'success',
    message: 'Movie added to watchlist',
    data: {
      watchlist: user.watchlist
    }
  })
})

exports.removeFromWatchlist = catchAsync(async (req, res, next) => {
  const movieId = req.params.movieId

  const user = await User.findById(req.user.id)

  if (!user.watchlist.some(id => id.toString() === movieId)) return next(new AppError('Movie not in watchlist', 400))

  user.watchlist = user.watchlist.filter(id => id.toString() !== movieId)

  await user.save({ validateBeforeSave: false })

  res.status(200).json({
    status: 'success',
    message: 'Movie removed succesfully from the watchlist',
    data: {
      watchlist: user.watchlist
    }
  })
})

exports.clearWatchList = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { watchlist: [] })

  res.status(200).json({
    status: 'success',
    message: 'Watchlist cleared'
  })
})
