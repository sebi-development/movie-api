const express = require('express')
const movieController = require('../controllers/movieController')
const authController = require('../controllers/authController')
const reviewRouter = require('./reviewRoutes')

const router = express.Router()

// Nested route: /movies/:movieId/reviews is handled by the review router
router.use('/:movieId/reviews', reviewRouter)

// PUBLIC (static paths must come before /:id)
router.get('/top-5-movies', movieController.aliasTopMovies, movieController.getAllMovies)
router.get('/movie-stats', movieController.getMovieStats)

router
  .route('/')
  .get(movieController.getAllMovies)
  .post(authController.protect, authController.restrictTo('admin'), movieController.createMovie)

router
  .route('/:id')
  .get(movieController.getMovie)
  .patch(authController.protect, authController.restrictTo('admin'), movieController.updateMovie)
  .delete(authController.protect, authController.restrictTo('admin'), movieController.deleteMovie)

module.exports = router
