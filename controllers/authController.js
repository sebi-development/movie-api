const jwt = require('jsonwebtoken')
const { promisify } = require('util')

const User = require('../models/userModel')
const AppError = require('../utils/AppError')
const catchAsync = require('../utils/catchAsync')

// HELPERS
const signToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id)

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user } // sensitive fields are stripped by the model's toJSON transform
  })
}

// HANDLERS

exports.signup = catchAsync(async (req, res, next) => {
  // Explicit fields only: a client can never sign up as admin
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  })

  createSendToken(newUser, 201, res)
})

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body

  // 1) Check if email and password exist
  if (!email || !password) return next(new AppError('Please provide email and password', 400))

  // 2) Find user by email (String() guards against object payloads)
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password')

  // 3) Check if user exists AND password is correct — same message for both to avoid user enumeration
  if (!user || !(await user.correctPassword(String(password), user.password))) {
    return next(new AppError('Incorrect email or password', 401))
  }

  // 4) Send token
  createSendToken(user, 200, res)
})

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token and check if it exists
  let token
  const { authorization } = req.headers
  if (authorization && authorization.startsWith('Bearer ')) {
    token = authorization.split(' ')[1]
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access', 401))
  }

  // 2) Verify token (JsonWebTokenError / TokenExpiredError handled globally)
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)

  // 3) Check if user still exists (deactivated users are filtered out by the model)
  const currentUser = await User.findById(decoded.id).select('+passwordChangedAt')
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists', 401))
  }

  // 4) Check if user changed password after token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('User recently changed password. Please log in again', 401))
  }

  // 5) Grant access to protected route
  req.user = currentUser
  next()
})

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403))
    }
    next()
  }
}

// PATCH /auth/updateMyPassword — requires the current password, returns a fresh token
exports.updateMyPassword = catchAsync(async (req, res, next) => {
  const { passwordCurrent, password, passwordConfirm } = req.body

  if (!passwordCurrent || !password || !passwordConfirm) {
    return next(new AppError('Please provide passwordCurrent, password and passwordConfirm', 400))
  }

  // 1) Get user from collection
  const user = await User.findById(req.user._id).select('+password')

  // 2) Check if the current password is correct
  if (!(await user.correctPassword(String(passwordCurrent), user.password))) {
    return next(new AppError('Your current password is wrong', 401))
  }

  // 3) Update password — save() runs the validators and hashing middleware
  user.password = password
  user.passwordConfirm = passwordConfirm
  await user.save()

  // 4) Log user in with a new token (old tokens are now invalid)
  createSendToken(user, 200, res)
})
