// Seed the database with sample data.
//   npm run data:import   -> insert actors, movies, users and reviews
//   npm run data:delete   -> remove all of them
//   npm run data:reset    -> delete, then import
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const { validateEnv } = require('../config/env')
const Actor = require('../models/actorModel')
const Movie = require('../models/movieModel')
const User = require('../models/userModel')
const Review = require('../models/reviewModel')

const readJSON = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf-8'))

const importData = async () => {
  const actors = readJSON('actors.json')
  const movies = readJSON('movies.json')
  const users = readJSON('users.json')
  const reviews = readJSON('reviews.json')

  await Actor.create(actors)
  await Movie.create(movies)
  // create() runs the save middleware, so passwords are hashed
  await User.create(users.map(user => ({ ...user, passwordConfirm: user.password })))
  // insertMany skips per-document hooks; ratings are recalculated once per movie below
  await Review.insertMany(reviews)

  const movieIds = [...new Set(reviews.map(review => review.movie))]
  await Promise.all(movieIds.map(movieId => Review.calcAverageRatings(movieId)))

  console.log(`✅ Imported ${actors.length} actors, ${movies.length} movies, ${users.length} users, ${reviews.length} reviews`)
}

const deleteData = async () => {
  await Promise.all([
    Review.deleteMany(),
    Movie.deleteMany(),
    Actor.deleteMany(),
    User.deleteMany()
  ])
  console.log('🗑️  All actors, movies, users and reviews deleted')
}

const run = async () => {
  const action = process.argv[2]
  const actions = {
    '--import': [importData],
    '--delete': [deleteData],
    '--reset': [deleteData, importData]
  }

  if (!actions[action]) {
    console.log('Usage: node dev-data/import-dev-data.js --import | --delete | --reset')
    process.exit(1)
  }

  validateEnv()
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to seed a database while NODE_ENV=production')
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.DATABASE_URI)
    await Promise.all([Actor.init(), Movie.init(), User.init(), Review.init()])
    for (const step of actions[action]) await step()
  } catch (err) {
    console.error('❌ Seeding failed:', err.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

run()
