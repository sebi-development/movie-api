const express = require('express')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean')
const hpp = require('hpp')

const authRoutes = require('./routes/authRoutes')
const globalErrorHandler = require('./middleware/errorMiddleware')

const app = express()

// GLOBAL MIDDLEWARE

// Security HTTP headers
app.use(helmet())

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

// Rate limiting
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour'
})
app.use('/api', limiter)

// Body parser (reading data from body into req.body)
app.use(express.json({ limit: '10kb' }))

// Data sanitization against NoSQL query injection
// app.use(mongoSanitize())

// Data sanitization against XSS
// app.use(xss())

// Prevent parameter pollution
app.use(hpp({
  whitelist: ['genre', 'year', 'rating', 'duration']
}))

// Serving static files
app.use(express.static('public'))

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString()
  next()
})

// ROUTES
app.use('/api/v1/auth', authRoutes)

// Handle undefined routes
app.all(/(.*)/, (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server`);
  err.status = 'fail';
  err.statusCode = 404;
  next(err)
})

app.use(globalErrorHandler)

module.exports = app