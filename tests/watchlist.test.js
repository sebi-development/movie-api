const request = require('supertest')
const app = require('../app')
const User = require('../models/userModel')
const { setupTestDB } = require('./helpers/db')
const { createUser, createMovie, auth } = require('./helpers/factories')

setupTestDB()

const WATCHLIST = '/api/v1/users/me/watchlist'

describe('Watchlist', () => {
  let user, token, movie

  beforeEach(async () => {
    ({ user, token } = await createUser())
    movie = await createMovie({ title: 'Watch Me' })
  })

  it('starts empty', async () => {
    const res = await request(app).get(WATCHLIST).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(0)
  })

  it('adds a movie and returns the populated list', async () => {
    const res = await request(app).post(`${WATCHLIST}/${movie._id}`).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(1)
    expect(res.body.data.watchlist[0]).toMatchObject({ _id: String(movie._id), title: 'Watch Me' })
  })

  it('prevents duplicates (409)', async () => {
    await request(app).post(`${WATCHLIST}/${movie._id}`).set(auth(token)).expect(200)

    const res = await request(app).post(`${WATCHLIST}/${movie._id}`).set(auth(token))

    expect(res.status).toBe(409)
    expect((await User.findById(user._id)).watchlist).toHaveLength(1)
  })

  it('stays consistent under concurrent adds', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post(`${WATCHLIST}/${movie._id}`).set(auth(token)))
    )

    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect((await User.findById(user._id)).watchlist).toHaveLength(1)
  })

  it('returns 404 for a movie that does not exist', async () => {
    const res = await request(app).post(`${WATCHLIST}/64b000000000000000000fff`).set(auth(token))

    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed movie id', async () => {
    const res = await request(app).post(`${WATCHLIST}/not-an-id`).set(auth(token))

    expect(res.status).toBe(400)
  })

  it('removes a movie', async () => {
    await request(app).post(`${WATCHLIST}/${movie._id}`).set(auth(token)).expect(200)

    const res = await request(app).delete(`${WATCHLIST}/${movie._id}`).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(0)
  })

  it('returns 404 when removing a movie that is not in the list', async () => {
    const res = await request(app).delete(`${WATCHLIST}/${movie._id}`).set(auth(token))

    expect(res.status).toBe(404)
  })

  it('clears the whole list', async () => {
    const other = await createMovie()
    await request(app).post(`${WATCHLIST}/${movie._id}`).set(auth(token)).expect(200)
    await request(app).post(`${WATCHLIST}/${other._id}`).set(auth(token)).expect(200)

    const res = await request(app).delete(WATCHLIST).set(auth(token))

    expect(res.status).toBe(200)
    expect((await User.findById(user._id)).watchlist).toHaveLength(0)
  })

  it('requires authentication', async () => {
    const res = await request(app).get(WATCHLIST)

    expect(res.status).toBe(401)
  })
})
