const express = require('express')
const movieController = require('../controllers/movieController')
const authController = require('../controllers/authController')
const reviewRouter = require('./reviewRoutes')

const router = express.Router()

// Nested route: Redirect to review router
router.use('/:movieId/reviews', reviewRouter)

// Public router
router.route('/').get(movieController.getAllMovies)
router.route('/:id').get(movieController.getMovie)

// Protect routes
router.use(authController.protect)
router.use(authController.restrictTo('admin'))

router.post('/', movieController.createMovie)
router.patch('/:id', movieController.updateMovie)
router.delete('/:id', movieController.deleteMovie)

module.exports = router