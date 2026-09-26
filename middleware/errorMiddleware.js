const AppError = require('../utils/AppError')

// Translate known library errors into operational AppErrors

const handleCastErrorDB = err => new AppError(`Invalid ${err.path}: ${JSON.stringify(err.value)}`, 400)

const handleDuplicateFieldsDB = err => {
  const [field, value] = Object.entries(err.keyValue || {})[0] || ['field', 'value']
  return new AppError(`Duplicate value for ${field}: ${JSON.stringify(value)}. Please use another value`, 409)
}

const handleValidationErrorDB = err => {
  const errors = Object.fromEntries(
    Object.entries(err.errors).map(([field, el]) => [field, el.message])
  )
  const appError = new AppError(`Invalid input data. ${Object.values(errors).join('. ')}`, 400)
  appError.errors = errors
  return appError
}

const handleJWTError = () => new AppError('Invalid token. Please log in again', 401)

const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again', 401)

const normalizeError = err => {
  if (err instanceof AppError) return err
  if (err.name === 'CastError') return handleCastErrorDB(err)
  if (err.code === 11000) return handleDuplicateFieldsDB(err)
  if (err.name === 'ValidationError') return handleValidationErrorDB(err)
  if (err.name === 'JsonWebTokenError') return handleJWTError()
  if (err.name === 'TokenExpiredError') return handleJWTExpiredError()
  // body-parser errors
  if (err.type === 'entity.parse.failed') return new AppError('Invalid JSON in request body', 400)
  if (err.type === 'entity.too.large') return new AppError('Request body is too large', 413)
  return err
}

module.exports = (err, req, res, next) => {
  const error = normalizeError(err)
  const isOperational = error.isOperational === true
  const statusCode = isOperational ? error.statusCode : 500

  if (!isOperational) console.error('💥 ERROR:', err)

  const body = {
    status: isOperational ? error.status : 'error',
    // Programming or unknown errors: don't leak details outside development
    message: isOperational || process.env.NODE_ENV === 'development'
      ? error.message
      : 'Something went wrong'
  }

  if (error.errors && isOperational) body.errors = error.errors
  if (process.env.NODE_ENV === 'development') body.stack = err.stack

  res.status(statusCode).json(body)
}
