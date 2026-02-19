const express = require('express')
const userController = require('../controllers/userController')
const authController = require('../controllers/authController')

const router = express.Router()

router.use(authController.protect)

router.get('/me/watchlist', userController.getMyWatchlist)
router.post('/me/watchlist/:movieId', userController.addToWatchList)
router.delete('/me/watchlist/:movieId', userController.removeFromWatchlist)
router.delete('/me/watchlist', userController.clearWatchList)

module.exports = router