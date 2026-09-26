// Test data builders
const jwt = require('jsonwebtoken')
const User = require('../../models/userModel')
const Movie = require('../../models/movieModel')
const Actor = require('../../models/actorModel')
const Review = require('../../models/reviewModel')

const PASSWORD = 'password123'
let counter = 0
const unique = () => ++counter

const signToken = (id, options = {}) =>
  jwt.sign({ id, ...options.payload }, process.env.JWT_SECRET, { expiresIn: '1h', ...options.jwt })

const createUser = async (overrides = {}) => {
  const n = unique()
  const user = await User.create({
    name: `Test User ${n}`,
    email: `user${n}@test.com`,
    password: PASSWORD,
    passwordConfirm: PASSWORD,
    ...overrides
  })
  return { user, token: signToken(user._id) }
}

const createAdmin = (overrides = {}) => createUser({ role: 'admin', ...overrides })

const movieData = (overrides = {}) => ({
  title: `Test Movie ${unique()}`,
  description: 'A thrilling test movie about writing integration tests.',
  genre: ['Drama'],
  releaseYear: 2020,
  duration: 120,
  rating: 7.5,
  director: 'Test Director',
  ...overrides
})

const createMovie = (overrides = {}) => Movie.create(movieData(overrides))

const createActor = (overrides = {}) => Actor.create({
  firstName: 'Test',
  lastName: `Actor${unique()}`,
  birthDate: '1980-01-01',
  ...overrides
})

const createReview = (overrides = {}) => Review.create({
  review: 'A perfectly reasonable review text.',
  rating: 8,
  ...overrides
})

const auth = token => ({ Authorization: `Bearer ${token}` })

module.exports = {
  PASSWORD,
  signToken,
  createUser,
  createAdmin,
  movieData,
  createMovie,
  createActor,
  createReview,
  auth
}
