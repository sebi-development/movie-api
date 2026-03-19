const Review = require('../models/reviewModel')
const AppError = require('../utils/AppError')
const APIFeatures = require('../utils/apiFeatures')
const catchAsync = require('../utils/catchAsync')

// HELPERS
const findReviewAndValidate = async function (reviewId, req, next) {
  const review = await Review.findById(reviewId)

  if (!review) {
    return next(new AppError('No review found with that ID', 404))
  }

  if (review.user.id !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You can only edit your own reviews', 403))
  }

  return review
}

exports.getAllReviews = catchAsync(async (req, res, next) => {
  let filter = {}

  // Only show reviews for that specific movie
  if (req.params.movieId) filter = { movie: req.params.movieId }

  // BUILD QUERY
  const features = new APIFeatures(Review.find(filter), req.query).filter().sort().limitFields().paginate()
  // EXECUTE QUERY
  const reviews = await features.query

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      data: reviews
    }
  })
})

exports.getReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id)

  if (!review) {
    return next(new AppError('Review not found', 404))
  }

  res.status(200).json({
    status: 'success',
    data: {
      review
    }
  })
})

exports.createReview = catchAsync(async (req, res, next) => {
  if (!req.body.movie) req.body.movie = req.params.movieId
  if (!req.body.user) req.body.user = req.user.id // from protect middleware

  const newReview = await Review.create({
    review: req.body.review,
    rating: req.body.rating,
    movie: req.body.movie,
    user: req.body.user
  })

  res.status(201).json({
    status: 'success',
    data: {
      review: newReview
    }
  })
})

exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await findReviewAndValidate(req.params.id, req, next)

  if (!review) return

  // Updating allowed fields
  review.review = req.body.review ?? review.review
  review.rating = req.body.rating ?? review.rating

  await review.save()

  res.status(200).json({
    status: 'success',
    data: review
  })
})

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await findReviewAndValidate(req.params.id, req, next)
  if (!review) return

  await review.deleteOne()

  res.status(204).json({
    status: 'success',
    data: null
  })
})