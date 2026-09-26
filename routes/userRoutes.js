const express = require('express')
const userController = require('../controllers/userController')
const authController = require('../controllers/authController')

const router = express.Router()

// Every user route requires authentication
router.use(authController.protect)

// CURRENT USER
router.get('/me', userController.getMe, userController.getUser)
router.patch('/updateMe', userController.updateMe)
router.delete('/deleteMe', userController.deleteMe)

// WATCHLIST
router
  .route('/me/watchlist')
  .get(userController.getMyWatchlist)
  .delete(userController.clearWatchlist)

router
  .route('/me/watchlist/:movieId')
  .post(userController.addToWatchlist)
  .delete(userController.removeFromWatchlist)

// ADMIN
router.use(authController.restrictTo('admin'))

router.get('/', userController.getAllUsers)

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser)

module.exports = router
