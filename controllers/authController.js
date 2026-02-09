const jwt = require('jsonwebtoken')
const catchAsync = require('../utils/catchAsync')
const { promisify } = require('util')

const User = require('../models/userModel')
const AppError = require('../utils/AppError')

// HELPERS
const signToken = id => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })
  return token
}

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id)

  user.password = undefined

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  })
}

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  })
  createSendToken(newUser, 201, res)
})

exports.login = catchAsync(async (req, res, next) => {
  const email = req.body.email
  const password = req.body.password

  // 1) Check if email and password exist
  if (!email || !password) return next(new AppError('Email or password not specified', 400))

  // 2) Find user by email 
  const user = await User.findOne({ email }).select('+password')

  // 3) Check if user exists AND password is correct
  if (!user || !(await user.correctPassword(password, user.password))) return next(new AppError('Incorrect password or email', 401))

  // 4) Send token
  createSendToken(user, 200, res)
})

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token and check if it exists
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access', 401))
  }
  // 2) Verify token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id)
  if (!currentUser) return next(new AppError('User deleted', 401))

  // 4) Check if user changed password after token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password. Please log in again', 401)
    )
  }

  // 5) Grant access to protected route
  req.user = currentUser

  next()
})