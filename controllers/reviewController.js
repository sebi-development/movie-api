const Review = require('../models/reviewModel')
const Movie = require('../models/movieModel')
const AppError = require('../utils/AppError')
const catchAsync = require('../utils/catchAsync')
const factory = require('./handlerFactory')

// HELPERS

// Works whether review.user is populated, null (deactivated author) or a raw ObjectId
const isAuthor = (review, user) => {
  const authorId = review.user?._id ?? review.user
  return authorId != null && String(authorId) === String(user._id)
}

const findOwnReview = async (req, next) => {
  const review = await Review.findById(req.params.id)

  if (!review) {
    next(new AppError('No review found with that ID', 404))
    return null
  }

  if (!isAuthor(review, req.user) && req.user.role !== 'admin') {
    next(new AppError('You can only modify your own reviews', 403))
    return null
  }

  return review
}

// HANDLERS

// Supports both /reviews and the nested /movies/:movieId/reviews
exports.getAllReviews = factory.getAll(Review, {
  key: 'reviews',
  baseFilter: req => (req.params.movieId ? { movie: req.params.movieId } : {})
})

exports.getReview = factory.getOne(Review, { key: 'review' })

exports.createReview = catchAsync(async (req, res, next) => {
  const movieId = req.params.movieId || req.body.movie
  if (!movieId) return next(new AppError('Please specify the movie you are reviewing', 400))

  if (!(await Movie.exists({ _id: movieId }))) {
    return next(new AppError('No movie found with that ID', 404))
  }

  if (await Review.exists({ movie: movieId, user: req.user._id })) {
    return next(new AppError('You have already reviewed this movie', 409))
  }

  // The author is always the logged-in user — never taken from the request body
  const newReview = await Review.create({
    review: req.body.review,
    rating: req.body.rating,
    movie: movieId,
    user: req.user._id
  })

  res.status(201).json({
    status: 'success',
    data: { review: newReview }
  })
})

exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await findOwnReview(req, next)
  if (!review) return

  // Only the text and rating can change
  if (req.body.review !== undefined) review.review = req.body.review
  if (req.body.rating !== undefined) review.rating = req.body.rating

  await review.save() // triggers rating recalculation

  res.status(200).json({
    status: 'success',
    data: { review }
  })
})

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await findOwnReview(req, next)
  if (!review) return

  await review.deleteOne() // triggers rating recalculation

  res.status(204).send()
})
