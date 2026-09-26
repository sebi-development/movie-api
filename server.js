const mongoose = require('mongoose')

// Handle uncaught exceptions (registered first so it catches everything below)
process.on('uncaughtException', err => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...')
  console.error(err)
  process.exit(1)
})

const { validateEnv } = require('./config/env')
validateEnv()

const app = require('./app')

const port = process.env.PORT || 3000
let server

const start = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URI)
    console.log('✅ DB connection successful!')
  } catch (err) {
    console.error('❌ DB CONNECTION ERROR:', err.message)
    process.exit(1)
  }

  server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port} (${process.env.NODE_ENV})`)
    console.log(`📚 API docs available at http://localhost:${port}/api-docs`)
  })
}

// Close the HTTP server and DB connection before exiting
const shutdown = (signal, exitCode = 0) => {
  console.log(`${signal} received. Shutting down gracefully...`)

  const closeDb = () => mongoose.connection.close().finally(() => process.exit(exitCode))

  if (server) server.close(closeDb)
  else closeDb()

  // Force exit if connections don't close in time
  setTimeout(() => process.exit(exitCode || 1), 10000).unref()
}

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...')
  console.error(err)
  shutdown('unhandledRejection', 1)
})

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

start()
