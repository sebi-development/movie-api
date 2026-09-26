const request = require('supertest')
const app = require('../app')
const Movie = require('../models/movieModel')
const Review = require('../models/reviewModel')
const { setupTestDB } = require('./helpers/db')
const { createUser, createAdmin, createMovie, createReview, auth } = require('./helpers/factories')

setupTestDB()

const reviewBody = (rating = 8) => ({ review: 'Great pacing and a memorable soundtrack.', rating })

const getMovieRatings = async movieId => {
  const movie = await Movie.findById(movieId)
  return { average: movie.ratingsAverage, quantity: movie.ratingsQuantity }
}

describe('Reading reviews (public)', () => {
  it('lists all reviews without authentication', async () => {
    const movie = await createMovie()
    const { user } = await createUser()
    await createReview({ movie: movie._id, user: user._id })

    const res = await request(app).get('/api/v1/reviews')

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(1)
  })

  it('lists only the reviews of a movie via the nested route', async () => {
    const [movieA, movieB] = await Promise.all([createMovie(), createMovie()])
    const { user } = await createUser()
    await createReview({ movie: movieA._id, user: user._id })
    await createReview({ movie: movieB._id, user: user._id })

    const res = await request(app).get(`/api/v1/movies/${movieA._id}/reviews`)

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(1)
    expect(res.body.data.reviews[0].movie).toBe(String(movieA._id))
  })

  it('populates the author name', async () => {
    const movie = await createMovie()
    const { user } = await createUser({ name: 'Critic' })
    const review = await createReview({ movie: movie._id, user: user._id })

    const res = await request(app).get(`/api/v1/reviews/${review._id}`)

    expect(res.body.data.review.user.name).toBe('Critic')
  })
})

describe('POST /api/v1/movies/:movieId/reviews', () => {
  it('creates a review and updates the movie rating', async () => {
    const movie = await createMovie()
    const { token } = await createUser()

    const res = await request(app)
      .post(`/api/v1/movies/${movie._id}/reviews`)
      .set(auth(token))
      .send(reviewBody(8))

    expect(res.status).toBe(201)
    expect(await getMovieRatings(movie._id)).toEqual({ average: 8, quantity: 1 })
  })

  it('averages multiple reviews rounded to one decimal', async () => {
    const movie = await createMovie()
    const users = await Promise.all([createUser(), createUser(), createUser()])

    for (const [i, { token }] of users.entries()) {
      await request(app)
        .post(`/api/v1/movies/${movie._id}/reviews`)
        .set(auth(token))
        .send(reviewBody([10, 8, 7][i]))
        .expect(201)
    }

    expect(await getMovieRatings(movie._id)).toEqual({ average: 8.3, quantity: 3 })
  })

  it('also works through POST /reviews with a movie in the body', async () => {
    const movie = await createMovie()
    const { token } = await createUser()

    const res = await request(app)
      .post('/api/v1/reviews')
      .set(auth(token))
      .send({ ...reviewBody(), movie: movie._id })

    expect(res.status).toBe(201)
  })

  it('always uses the logged-in user as author', async () => {
    const movie = await createMovie()
    const { user, token } = await createUser()
    const { user: victim } = await createUser()

    const res = await request(app)
      .post(`/api/v1/movies/${movie._id}/reviews`)
      .set(auth(token))
      .send({ ...reviewBody(), user: victim._id })

    expect(res.status).toBe(201)
    expect(res.body.data.review.user).toBe(String(user._id))
  })

  it('prevents reviewing the same movie twice (409)', async () => {
    const movie = await createMovie()
    const { token } = await createUser()
    const url = `/api/v1/movies/${movie._id}/reviews`

    await request(app).post(url).set(auth(token)).send(reviewBody()).expect(201)
    const res = await request(app).post(url).set(auth(token)).send(reviewBody())

    expect(res.status).toBe(409)
  })

  it('returns 404 when the movie does not exist', async () => {
    const { token } = await createUser()

    const res = await request(app)
      .post('/api/v1/movies/64b000000000000000000fff/reviews')
      .set(auth(token))
      .send(reviewBody())

    expect(res.status).toBe(404)
  })

  it('validates rating range and review length', async () => {
    const movie = await createMovie()
    const { token } = await createUser()

    const res = await request(app)
      .post(`/api/v1/movies/${movie._id}/reviews`)
      .set(auth(token))
      .send({ review: 'short', rating: 11 })

    expect(res.status).toBe(400)
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['review', 'rating']))
  })

  it('requires authentication', async () => {
    const movie = await createMovie()

    const res = await request(app).post(`/api/v1/movies/${movie._id}/reviews`).send(reviewBody())

    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/v1/reviews/:id', () => {
  it('lets the author edit and recalculates the rating', async () => {
    const movie = await createMovie()
    const { user, token } = await createUser()
    const review = await createReview({ movie: movie._id, user: user._id, rating: 4 })

    const res = await request(app)
      .patch(`/api/v1/reviews/${review._id}`)
      .set(auth(token))
      .send({ rating: 10 })

    expect(res.status).toBe(200)
    expect(res.body.data.review.rating).toBe(10)
    expect(await getMovieRatings(movie._id)).toEqual({ average: 10, quantity: 1 })
  })

  it("forbids editing someone else's review (403)", async () => {
    const movie = await createMovie()
    const { user: author } = await createUser()
    const { token: otherToken } = await createUser()
    const review = await createReview({ movie: movie._id, user: author._id })

    const res = await request(app)
      .patch(`/api/v1/reviews/${review._id}`)
      .set(auth(otherToken))
      .send({ rating: 1 })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/v1/reviews/:id', () => {
  it('recalculates the movie rating after deletion', async () => {
    const movie = await createMovie()
    const { user: userA, token: tokenA } = await createUser()
    const { user: userB } = await createUser()
    const reviewA = await createReview({ movie: movie._id, user: userA._id, rating: 2 })
    await createReview({ movie: movie._id, user: userB._id, rating: 8 })

    expect(await getMovieRatings(movie._id)).toEqual({ average: 5, quantity: 2 })

    const res = await request(app).delete(`/api/v1/reviews/${reviewA._id}`).set(auth(tokenA))

    expect(res.status).toBe(204)
    expect(await getMovieRatings(movie._id)).toEqual({ average: 8, quantity: 1 })
  })

  it('resets the rating when the last review is deleted', async () => {
    const movie = await createMovie()
    const { user, token } = await createUser()
    const review = await createReview({ movie: movie._id, user: user._id, rating: 9 })

    await request(app).delete(`/api/v1/reviews/${review._id}`).set(auth(token)).expect(204)

    expect(await getMovieRatings(movie._id)).toEqual({ average: 0, quantity: 0 })
  })

  it('lets an admin moderate any review', async () => {
    const movie = await createMovie()
    const { user } = await createUser()
    const { token: adminToken } = await createAdmin()
    const review = await createReview({ movie: movie._id, user: user._id })

    const res = await request(app).delete(`/api/v1/reviews/${review._id}`).set(auth(adminToken))

    expect(res.status).toBe(204)
    expect(await Review.findById(review._id)).toBeNull()
  })

  it("forbids deleting someone else's review", async () => {
    const movie = await createMovie()
    const { user } = await createUser()
    const { token: otherToken } = await createUser()
    const review = await createReview({ movie: movie._id, user: user._id })

    const res = await request(app).delete(`/api/v1/reviews/${review._id}`).set(auth(otherToken))

    expect(res.status).toBe(403)
  })

  it('returns 404 for a missing review', async () => {
    const { token } = await createUser()

    const res = await request(app).delete('/api/v1/reviews/64d000000000000000000fff').set(auth(token))

    expect(res.status).toBe(404)
  })
})
