const express = require('express')
const reviewController = require('../controllers/reviewController')
const authController = require('../controllers/authController')

// mergeParams gives access to :movieId from /movies/:movieId/reviews
const router = express.Router({ mergeParams: true })

// Reading reviews is public; writing requires a logged-in user
router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(authController.protect, authController.restrictTo('user'), reviewController.createReview)

router
  .route('/:id')
  .get(reviewController.getReview)
  .patch(authController.protect, reviewController.updateReview) // author or admin
  .delete(authController.protect, reviewController.deleteReview) // author or admin

module.exports = router
