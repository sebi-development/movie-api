const path = require('path')
const express = require('express')
const mongoose = require('mongoose')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const cors = require('cors')
const mongoSanitize = require('express-mongo-sanitize')
const hpp = require('hpp')
const swaggerUi = require('swagger-ui-express')
const YAML = require('yaml')
const fs = require('fs')

const authRouter = require('./routes/authRoutes')
const movieRouter = require('./routes/movieRoutes')
const reviewRouter = require('./routes/reviewRoutes')
const userRouter = require('./routes/userRoutes')
const actorRouter = require('./routes/actorRoutes')

const AppError = require('./utils/AppError')
const globalErrorHandler = require('./middleware/errorMiddleware')

const { version } = require('./package.json')

const isTest = process.env.NODE_ENV === 'test'

const app = express()

// Behind a reverse proxy (Render, Railway, Heroku...) trust the first hop so
// rate limiting sees the real client IP
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// GLOBAL MIDDLEWARE

// Security HTTP headers
app.use(helmet())

// CORS — comma-separated allow-list, or every origin when CORS_ORIGIN is unset
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : '*'
}))

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'))
}

// Rate limiting (disabled under test)
const rateLimitResponse = message => ({ status: 'fail', message })

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitResponse('Too many requests from this IP, please try again in an hour'),
  skip: () => isTest
})
app.use('/api', limiter)

// Stricter limit on credential endpoints to slow down brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitResponse('Too many login attempts, please try again in 15 minutes'),
  skip: () => isTest
})
app.use(['/api/v1/auth/login', '/api/v1/auth/signup'], authLimiter)

// Body parser (reading data from body into req.body)
app.use(express.json({ limit: '10kb' }))

// Data sanitization against NoSQL query injection
app.use(mongoSanitize())

// Prevent parameter pollution (these fields may repeat, e.g. ?genre=Drama&genre=Crime)
app.use(hpp({
  whitelist: ['genre', 'releaseYear', 'duration', 'rating', 'ratingsAverage', 'ratingsQuantity', 'director']
}))

// API DOCUMENTATION
const swaggerDocument = YAML.parse(fs.readFileSync(path.join(__dirname, 'docs', 'swagger.yaml'), 'utf8'))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'Movie API Docs'
}))

// ROUTES
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to the Movie API',
    version,
    docs: '/api-docs'
  })
})

app.get('/api/v1/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1

  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'success' : 'error',
    uptime: Math.round(process.uptime()),
    database: dbConnected ? 'connected' : 'disconnected'
  })
})

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/movies', movieRouter)
app.use('/api/v1/reviews', reviewRouter)
app.use('/api/v1/users', userRouter)
app.use('/api/v1/actors', actorRouter)

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.method} ${req.originalUrl} on this server`, 404))
})

app.use(globalErrorHandler)

module.exports = app
