const request = require('supertest')
const app = require('../app')
const User = require('../models/userModel')
const Review = require('../models/reviewModel')
const Movie = require('../models/movieModel')
const { setupTestDB } = require('./helpers/db')
const { PASSWORD, createUser, createAdmin, createMovie, createReview, auth } = require('./helpers/factories')

setupTestDB()

describe('Current user (/users/me)', () => {
  it('GET /me returns the profile without sensitive fields', async () => {
    const { user, token } = await createUser({ name: 'Me Myself' })

    const res = await request(app).get('/api/v1/users/me').set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ _id: String(user._id), name: 'Me Myself', role: 'user' })
    expect(res.body.data.user.password).toBeUndefined()
    expect(res.body.data.user.active).toBeUndefined()
  })

  it('PATCH /updateMe updates name and email only', async () => {
    const { user, token } = await createUser()

    const res = await request(app)
      .patch('/api/v1/users/updateMe')
      .set(auth(token))
      .send({ name: 'New Name', email: 'NEW@test.com', role: 'admin' })

    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ name: 'New Name', email: 'new@test.com', role: 'user' })
    expect((await User.findById(user._id)).role).toBe('user')
  })

  it('PATCH /updateMe rejects password changes', async () => {
    const { token } = await createUser()

    const res = await request(app)
      .patch('/api/v1/users/updateMe')
      .set(auth(token))
      .send({ password: 'hacked123', passwordConfirm: 'hacked123' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/updateMyPassword/)
  })

  it('PATCH /updateMe validates the email', async () => {
    const { token } = await createUser()

    const res = await request(app)
      .patch('/api/v1/users/updateMe')
      .set(auth(token))
      .send({ email: 'nope' })

    expect(res.status).toBe(400)
  })

  it('DELETE /deleteMe deactivates the account', async () => {
    const { user, token } = await createUser()

    const res = await request(app).delete('/api/v1/users/deleteMe').set(auth(token))
    expect(res.status).toBe(204)

    // Still in the database, but hidden and unable to log in or use old tokens
    const raw = await User.collection.findOne({ _id: user._id })
    expect(raw.active).toBe(false)

    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD })
    expect(login.status).toBe(401)

    const me = await request(app).get('/api/v1/users/me').set(auth(token))
    expect(me.status).toBe(401)
  })
})

describe('Admin user management', () => {
  it('lets admins list users', async () => {
    const { token } = await createAdmin()
    await createUser()

    const res = await request(app).get('/api/v1/users').set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(2)
    res.body.data.users.forEach(u => expect(u.password).toBeUndefined())
  })

  it('forbids regular users from listing users', async () => {
    const { token } = await createUser()

    const res = await request(app).get('/api/v1/users').set(auth(token))

    expect(res.status).toBe(403)
  })

  it('lets admins get a user by id', async () => {
    const { token } = await createAdmin()
    const { user } = await createUser({ name: 'Target' })

    const res = await request(app).get(`/api/v1/users/${user._id}`).set(auth(token))

    expect(res.status).toBe(200)
    expect(res.body.data.user.name).toBe('Target')
  })

  it('lets admins change a role but not a password', async () => {
    const { token } = await createAdmin()
    const { user } = await createUser()

    const res = await request(app)
      .patch(`/api/v1/users/${user._id}`)
      .set(auth(token))
      .send({ role: 'admin', password: 'changed123' })

    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('admin')

    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD })
    expect(login.status).toBe(200)
  })

  it('deletes a user together with their reviews and fixes movie ratings', async () => {
    const { token } = await createAdmin()
    const movie = await createMovie()
    const { user: spammer } = await createUser()
    const { user: regular } = await createUser()
    await createReview({ movie: movie._id, user: spammer._id, rating: 1 })
    await createReview({ movie: movie._id, user: regular._id, rating: 9 })

    const res = await request(app).delete(`/api/v1/users/${spammer._id}`).set(auth(token))

    expect(res.status).toBe(204)
    expect(await User.findById(spammer._id)).toBeNull()
    expect(await Review.countDocuments({ user: spammer._id })).toBe(0)
    const updated = await Movie.findById(movie._id)
    expect(updated.ratingsAverage).toBe(9)
    expect(updated.ratingsQuantity).toBe(1)
  })

  it('returns 404 for a missing user', async () => {
    const { token } = await createAdmin()

    const res = await request(app).get('/api/v1/users/64c000000000000000000fff').set(auth(token))

    expect(res.status).toBe(404)
  })
})
