const path = require('path')
const dotenv = require('dotenv')

// Load variables from the project-root .env file (real env vars take precedence)
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true })

const REQUIRED = ['DATABASE_URI', 'JWT_SECRET']

const validateEnv = () => {
  const missing = REQUIRED.filter(key => !process.env[key])

  if (missing.length) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`)
    console.error('   Copy .env.example to .env and fill in the values.')
    process.exit(1)
  }

  if (!process.env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = '7d'
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'
}

module.exports = { validateEnv }
