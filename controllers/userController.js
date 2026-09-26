const User = require('../models/userModel')
const Movie = require('../models/movieModel')
const Review = require('../models/reviewModel')
const AppError = require('../utils/AppError')
const catchAsync = require('../utils/catchAsync')
const filterObj = require('../utils/filterObj')
const factory = require('./handlerFactory')

const WATCHLIST_FIELDS = 'title posterUrl releaseYear ratingsAverage duration genre'

const sendWatchlist = async (res, userId, message) => {
  const user = await User.findById(userId).populate({ path: 'watchlist', select: WATCHLIST_FIELDS })

  res.status(200).json({
    status: 'success',
    ...(message && { message }),
    results: user.watchlist.length,
    data: { watchlist: user.watchlist }
  })
}

// CURRENT USER

// Reuses getUser by pointing :id at the logged-in user
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id
  next()
}

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Password updates have a dedicated endpoint
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates. Please use /auth/updateMyPassword', 400))
  }

  // 2) Only allow safe profile fields (never role, active, watchlist...)
  const filteredBody = filterObj(req.body, 'name', 'email')

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    returnDocument: 'after',
    runValidators: true
  })

  res.status(200).json({
    status: 'success',
    data: { user: updatedUser }
  })
})

// Soft delete: the account is deactivated and hidden from all queries
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false })
  res.status(204).send()
})

// WATCHLIST

exports.getMyWatchlist = catchAsync(async (req, res, next) => {
  await sendWatchlist(res, req.user.id)
})

exports.addToWatchlist = catchAsync(async (req, res, next) => {
  const { movieId } = req.params

  if (!(await Movie.exists({ _id: movieId }))) {
    return next(new AppError('No movie found with that ID', 404))
  }

  // Atomic: only matches if the movie is not already in the list
  const updated = await User.findOneAndUpdate(
    { _id: req.user.id, watchlist: { $ne: movieId } },
    { $addToSet: { watchlist: movieId } }
  )
  if (!updated) return next(new AppError('Movie already in watchlist', 409))

  await sendWatchlist(res, req.user.id, 'Movie added to watchlist')
})

exports.removeFromWatchlist = catchAsync(async (req, res, next) => {
  const { movieId } = req.params

  const updated = await User.findOneAndUpdate(
    { _id: req.user.id, watchlist: movieId },
    { $pull: { watchlist: movieId } }
  )
  if (!updated) return next(new AppError('Movie not in watchlist', 404))

  await sendWatchlist(res, req.user.id, 'Movie removed from watchlist')
})

exports.clearWatchlist = catchAsync(async (req, res, next) => {
  await User.updateOne({ _id: req.user.id }, { $set: { watchlist: [] } })

  res.status(200).json({
    status: 'success',
    message: 'Watchlist cleared',
    results: 0,
    data: { watchlist: [] }
  })
})

// ADMIN

exports.getAllUsers = factory.getAll(User, { key: 'users' })

exports.getUser = factory.getOne(User, { key: 'user' })

// Admins can change profile data and role — passwords are only changed by their owner
exports.updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    filterObj(req.body, 'name', 'email', 'role', 'photo'),
    { returnDocument: 'after', runValidators: true }
  )

  if (!user) return next(new AppError('No user found with that ID', 404))

  res.status(200).json({
    status: 'success',
    data: { user }
  })
})

// Hard delete: removes the user's reviews and recalculates the affected movie ratings
exports.deleteUser = factory.deleteOne(User, {
  afterDelete: async user => {
    const movieIds = await Review.distinct('movie', { user: user._id })
    await Review.deleteMany({ user: user._id })
    await Promise.all(movieIds.map(movieId => Review.calcAverageRatings(movieId)))
  }
})
