const express = require('express')
const authController = require('../controllers/authController')

const router = express.Router()

router.post('/signup', authController.signup)
router.post('/login', authController.login)
router.get(
  '/test-protected',
  authController.protect,
  (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'You are authenticated!',
      user: req.user
    })
  }
)
module.exports = router

