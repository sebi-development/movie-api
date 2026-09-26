const request = require('supertest')
const app = require('../app')
const Movie = require('../models/movieModel')
const Review = require('../models/reviewModel')
const User = require('../models/userModel')
const { setupTestDB } = require('./helpers/db')
const {
  createUser, createAdmin, createMovie, createActor, createReview, movieData, auth
} = require('./helpers/factories')

setupTestDB()

describe('GET /api/v1/movies', () => {
  beforeEach(async () => {
    await Movie.create([
      movieData({ title: 'Alpha', genre: ['Drama'], duration: 90, releaseYear: 1999, ratingsAverage: 6 }),
      movieData({ title: 'Bravo', genre: ['Action', 'Sci-Fi'], duration: 150, releaseYear: 2010, ratingsAverage: 9 }),
      movieData({ title: 'Charlie', genre: ['Comedy'], duration: 110, releaseYear: 2015, ratingsAverage: 7 }),
      movieData({ title: 'Delta', genre: ['Sci-Fi'], duration: 170, releaseYear: 2020, ratingsAverage: 8 }),
      movieData({ title: 'Echo', genre: ['Horror'], duration: 95, releaseYear: 2021, ratingsAverage: 5, description: 'A haunted spaceship drifts through the void.' })
    ])
  })

  it('lists movies with pagination metadata', async () => {
    const res = await request(app).get('/api/v1/movies')

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(5)
    expect(res.body.pagination).toEqual({ total: 5, page: 1, limit: 10, pages: 1 })
    expect(res.body.data.movies).toHaveLength(5)
  })

  it('paginates with page and limit', async () => {
    const res = await request(app).get('/api/v1/movies?sort=title&page=2&limit=2')

    expect(res.body.data.movies.map(m => m.title)).toEqual(['Charlie', 'Delta'])
    expect(res.body.pagination).toEqual({ total: 5, page: 2, limit: 2, pages: 3 })
  })

  it('caps the page size at 100', async () => {
    const res = await request(app).get('/api/v1/movies?limit=5000')

    expect(res.body.pagination.limit).toBe(100)
  })

  it('filters by exact value', async () => {
    const res = await request(app).get('/api/v1/movies?genre=Sci-Fi&sort=title')

    expect(res.body.data.movies.map(m => m.title)).toEqual(['Bravo', 'Delta'])
  })

  it('filters by multiple values of the same field ($in)', async () => {
    const res = await request(app).get('/api/v1/movies?genre=Drama&genre=Horror&sort=title')

    expect(res.body.data.movies.map(m => m.title)).toEqual(['Alpha', 'Echo'])
  })

  it('supports comparison operators', async () => {
    const res = await request(app).get('/api/v1/movies?duration[gte]=110&duration[lt]=170&sort=title')

    expect(res.body.data.movies.map(m => m.title)).toEqual(['Bravo', 'Charlie'])
    expect(res.body.pagination.total).toBe(2)
  })

  it('sorts by multiple fields', async () => {
    const res = await request(app).get('/api/v1/movies?sort=-ratingsAverage')

    expect(res.body.data.movies.map(m => m.title)).toEqual(['Bravo', 'Delta', 'Charlie', 'Alpha', 'Echo'])
  })

  it('limits returned fields', async () => {
    const res = await request(app).get('/api/v1/movies?fields=title,releaseYear')
    const movie = res.body.data.movies[0]

    expect(movie.title).toBeDefined()
    expect(movie.releaseYear).toBeDefined()
    expect(movie.description).toBeUndefined()
  })

  it('performs full-text search on title and description', async () => {
    const res = await request(app).get('/api/v1/movies?search=spaceship')

    expect(res.body.data.movies.map(m => m.title)).toEqual(['Echo'])
  })
})

describe('GET /api/v1/movies/:id', () => {
  it('returns the movie with populated cast and reviews', async () => {
    const actor = await createActor({ firstName: 'Keanu', lastName: 'Reeves' })
    const movie = await createMovie({ cast: [actor._id] })
    const { user } = await createUser({ name: 'Reviewer' })
    await createReview({ movie: movie._id, user: user._id, rating: 9 })

    const res = await request(app).get(`/api/v1/movies/${movie._id}`)

    expect(res.status).toBe(200)
    expect(res.body.data.movie.cast[0]).toMatchObject({ firstName: 'Keanu', lastName: 'Reeves' })
    expect(res.body.data.movie.reviews).toHaveLength(1)
    expect(res.body.data.movie.reviews[0].user.name).toBe('Reviewer')
    expect(res.body.data.movie.slug).toBe(movie.slug)
  })

  it('returns 404 for a non-existent movie', async () => {
    const res = await request(app).get('/api/v1/movies/64b000000000000000000fff')

    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/v1/movies/not-an-id')

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid _id/i)
  })
})

describe('POST /api/v1/movies', () => {
  it('lets an admin create a movie', async () => {
    const { token } = await createAdmin()
    const actor = await createActor()

    const res = await request(app)
      .post('/api/v1/movies')
      .set(auth(token))
      .send(movieData({ title: 'The New Film', cast: [actor._id] }))

    expect(res.status).toBe(201)
    expect(res.body.data.movie).toMatchObject({ title: 'The New Film', slug: 'the-new-film', ratingsAverage: 0 })
  })

  it('ignores server-managed fields such as ratingsAverage', async () => {
    const { token } = await createAdmin()

    const res = await request(app)
      .post('/api/v1/movies')
      .set(auth(token))
      .send(movieData({ ratingsAverage: 10, ratingsQuantity: 999 }))

    expect(res.body.data.movie.ratingsAverage).toBe(0)
    expect(res.body.data.movie.ratingsQuantity).toBe(0)
  })

  it('forbids regular users (403)', async () => {
    const { token } = await createUser()

    const res = await request(app).post('/api/v1/movies').set(auth(token)).send(movieData())

    expect(res.status).toBe(403)
  })

  it('requires authentication (401)', async () => {
    const res = await request(app).post('/api/v1/movies').send(movieData())

    expect(res.status).toBe(401)
  })

  it('validates the payload', async () => {
    const { token } = await createAdmin()

    const res = await request(app)
      .post('/api/v1/movies')
      .set(auth(token))
      .send({ title: 'Incomplete', genre: ['Not-A-Genre'], releaseYear: 1700 })

    expect(res.status).toBe(400)
    expect(Object.keys(res.body.errors)).toEqual(
      expect.arrayContaining(['description', 'director', 'duration', 'releaseYear', 'genre.0'])
    )
  })

  it('rejects a cast containing unknown actors', async () => {
    const { token } = await createAdmin()

    const res = await request(app)
      .post('/api/v1/movies')
      .set(auth(token))
      .send(movieData({ cast: ['64a000000000000000000fff'] }))

    expect(res.status).toBe(400)
    expect(res.body.errors.cast).toMatch(/does not exist/)
  })
})

describe('PATCH /api/v1/movies/:id', () => {
  it('updates allowed fields and regenerates the slug', async () => {
    const { token } = await createAdmin()
    const movie = await createMovie()

    const res = await request(app)
      .patch(`/api/v1/movies/${movie._id}`)
      .set(auth(token))
      .send({ title: 'Renamed Movie', duration: 99 })

    expect(res.status).toBe(200)
    expect(res.body.data.movie).toMatchObject({ title: 'Renamed Movie', slug: 'renamed-movie', duration: 99 })
  })

  it('does not allow overwriting calculated ratings', async () => {
    const { token } = await createAdmin()
    const movie = await createMovie()

    const res = await request(app)
      .patch(`/api/v1/movies/${movie._id}`)
      .set(auth(token))
      .send({ ratingsAverage: 10, ratingsQuantity: 500 })

    expect(res.status).toBe(200)
    expect(res.body.data.movie.ratingsAverage).toBe(0)
    expect(res.body.data.movie.ratingsQuantity).toBe(0)
  })

  it('runs validators on update', async () => {
    const { token } = await createAdmin()
    const movie = await createMovie()

    const res = await request(app)
      .patch(`/api/v1/movies/${movie._id}`)
      .set(auth(token))
      .send({ duration: -5 })

    expect(res.status).toBe(400)
  })

  it('returns 404 for a missing movie', async () => {
    const { token } = await createAdmin()

    const res = await request(app)
      .patch('/api/v1/movies/64b000000000000000000fff')
      .set(auth(token))
      .send({ title: 'Ghost' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/v1/movies/:id', () => {
  it('deletes the movie, its reviews and watchlist entries', async () => {
    const { token } = await createAdmin()
    const movie = await createMovie()
    const { user } = await createUser({ watchlist: [] })
    await createReview({ movie: movie._id, user: user._id })
    await User.updateOne({ _id: user._id }, { $push: { watchlist: movie._id } })

    const res = await request(app).delete(`/api/v1/movies/${movie._id}`).set(auth(token))

    expect(res.status).toBe(204)
    expect(await Movie.findById(movie._id)).toBeNull()
    expect(await Review.countDocuments({ movie: movie._id })).toBe(0)
    expect((await User.findById(user._id)).watchlist).toHaveLength(0)
  })

  it('forbids regular users', async () => {
    const { token } = await createUser()
    const movie = await createMovie()

    const res = await request(app).delete(`/api/v1/movies/${movie._id}`).set(auth(token))

    expect(res.status).toBe(403)
    expect(await Movie.findById(movie._id)).not.toBeNull()
  })
})

describe('Aggregation endpoints', () => {
  beforeEach(async () => {
    await Movie.create([
      movieData({ title: 'A', genre: ['Drama'], duration: 100, ratingsAverage: 9 }),
      movieData({ title: 'B', genre: ['Drama', 'Comedy'], duration: 140, ratingsAverage: 7 }),
      movieData({ title: 'C', genre: ['Comedy'], duration: 80, ratingsAverage: 8 }),
      movieData({ title: 'D', genre: ['Horror'], duration: 90, ratingsAverage: 4 }),
      movieData({ title: 'E', genre: ['Action'], duration: 120, ratingsAverage: 6 }),
      movieData({ title: 'F', genre: ['Action'], duration: 125, ratingsAverage: 10 })
    ])
  })

  it('GET /movies/top-5-movies returns the 5 best rated movies', async () => {
    const res = await request(app).get('/api/v1/movies/top-5-movies')

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(5)
    expect(res.body.data.movies.map(m => m.title)).toEqual(['F', 'A', 'C', 'B', 'E'])
  })

  it('GET /movies/movie-stats groups statistics by genre', async () => {
    const res = await request(app).get('/api/v1/movies/movie-stats')

    expect(res.status).toBe(200)
    const drama = res.body.data.stats.find(s => s.genre === 'Drama')
    expect(drama).toMatchObject({
      numMovies: 2,
      avgUserRating: 8,
      minDuration: 100,
      maxDuration: 140,
      avgDuration: 120
    })
    expect(res.body.data.stats.map(s => s.genre)).toEqual(
      expect.arrayContaining(['Drama', 'Comedy', 'Horror', 'Action'])
    )
  })
})
