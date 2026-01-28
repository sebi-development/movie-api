const mongoose = require('mongoose')
const dotenv = require('dotenv')

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...')
  console.error(err.name, err.message)
  process.exit(1)
})

// Load environment variables
dotenv.config({ path: './config.env' })

const app = require('./app')

// Database connection
const DB = process.env.DATABASE_URI

mongoose.connect(DB)
  .then(() => console.log('✅ DB connection successful!'))
  .catch((err) => console.log('❌ DB CONNECTION ERROR:', err));

// Start server
const port = process.env.PORT || 3000
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...')
  console.error(err.name, err.message)
  server.close(() => {
    process.exit(1)
  })
})
