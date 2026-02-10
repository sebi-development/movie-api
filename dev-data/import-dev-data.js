const fs = require('fs')
const mongoose = require('mongoose')
const dotenv = require('dotenv')

// Load model
const Movie = require('../models/movieModel')

// Load config
dotenv.config({ path: './config/config.env' })

const DB = process.env.DATABASE_URI

mongoose.connect(DB)
  .then(() => console.log('DB connection successful!'))
  .catch(err => console.log('DB connection error:', err))

// READ JSON FILE
const movies = JSON.parse(
  fs.readFileSync(`${__dirname}/movies.json`, 'utf-8')
)

// IMPORT DATA
const importData = async () => {
  try {
    await Movie.create(movies, { validateBeforeSave: true })
    console.log('✅ Data successfully loaded!')
  } catch (err) {
    console.log('❌ Error importing data:')
    console.log(err)
  }
  process.exit()
}

// DELETE DATA
const deleteData = async () => {
  try {
    await Movie.deleteMany()
    console.log('🗑️ Data successfully deleted!')
  } catch (err) {
    console.log('❌ Error deleting data:')
    console.log(err)
  }
  process.exit()
}

if (process.argv[2] === '--import') {
  importData()
} else if (process.argv[2] === '--delete') {
  deleteData()
} else {
  console.log('Please specify --import or --delete')
  process.exit()
}