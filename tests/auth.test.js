const request = require('supertest')
const jwt = require('jsonwebtoken')
const app = require('../app')
const User = require('../models/userModel')
const { setupTestDB } = require('./helpers/db')
const { PASSWORD, createUser, signToken, auth } = require('./helpers/factories')

setupTestDB()

const signupBody = (overrides = {}) => ({
  name: 'Jane Doe',
  email: 'jane@test.com',
  password: PASSWORD,
  passwordConfirm: PASSWORD,
  ...overrides
})

describe('POST /api/v1/auth/signup', () => {
  it('creates a user and returns a valid JWT', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send(signupBody())

    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.data.user).toMatchObject({ name: 'Jane Doe', email: 'jane@test.com', role: 'user' })

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET)
    expect(decoded.id).toBe(res.body.data.user._id)
  })

  it('never returns the password and stores it hashed', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send(signupBody())

    expect(res.body.data.user.password).toBeUndefined()
    expect(res.body.data.user.passwordConfirm).toBeUndefined()

    const user = await User.findOne({ email: 'jane@test.com' }).select('+password')
    expect(user.password).not.toBe(PASSWORD)
    expect(user.password).toMatch(/^\$2[aby]\$/)
  })

  it('ignores attempts to self-assign the admin role', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send(signupBody({ role: 'admin' }))

    expect(res.status).toBe(201)
    expect(res.body.data.user.role).toBe('user')
  })

  it('rejects a duplicate email with 409', async () => {
    await createUser({ email: 'jane@test.com' })

    const res = await request(app).post('/api/v1/auth/signup').send(signupBody())

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/duplicate value for email/i)
  })

  it('rejects mismatching passwords', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(signupBody({ passwordConfirm: 'different123' }))

    expect(res.status).toBe(400)
    expect(res.body.errors.passwordConfirm).toBe('Passwords are not the same!')
  })

  it('rejects an invalid email and a short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(signupBody({ email: 'not-an-email', password: 'short', passwordConfirm: 'short' }))

    expect(res.status).toBe(400)
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['email', 'password']))
  })
})

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => createUser({ email: 'login@test.com' }))

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@test.com', password: PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.data.user.password).toBeUndefined()
  })

  it('is case-insensitive on email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'LOGIN@test.com', password: PASSWORD })

    expect(res.status).toBe(200)
  })

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@test.com', password: 'wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Incorrect email or password')
  })

  it('uses the same error for unknown emails (no user enumeration)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: PASSWORD })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Incorrect email or password')
  })

  it('requires both email and password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'login@test.com' })

    expect(res.status).toBe(400)
  })
})

describe('protect middleware', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/users/me')

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/not logged in/i)
  })

  it('rejects a tampered token', async () => {
    const res = await request(app).get('/api/v1/users/me').set(auth('invalid.token.value'))

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid token. Please log in again')
  })

  it('rejects an expired token', async () => {
    const { user } = await createUser()
    const token = signToken(user._id, { jwt: { expiresIn: '-10s' } })

    const res = await request(app).get('/api/v1/users/me').set(auth(token))

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Your token has expired. Please log in again')
  })

  it('rejects a token whose user no longer exists', async () => {
    const { user, token } = await createUser()
    await User.findByIdAndDelete(user._id)

    const res = await request(app).get('/api/v1/users/me').set(auth(token))

    expect(res.status).toBe(401)
  })

  it('grants access with a valid token', async () => {
    const { token } = await createUser()

    const res = await request(app).get('/api/v1/users/me').set(auth(token))

    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/v1/auth/updateMyPassword', () => {
  const NEW_PASSWORD = 'new-password456'

  it('changes the password and returns a fresh token', async () => {
    const { user, token } = await createUser()

    const res = await request(app)
      .patch('/api/v1/auth/updateMyPassword')
      .set(auth(token))
      .send({ passwordCurrent: PASSWORD, password: NEW_PASSWORD, passwordConfirm: NEW_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: NEW_PASSWORD })
    expect(login.status).toBe(200)
  })

  it('rejects a wrong current password', async () => {
    const { token } = await createUser()

    const res = await request(app)
      .patch('/api/v1/auth/updateMyPassword')
      .set(auth(token))
      .send({ passwordCurrent: 'wrong-password', password: NEW_PASSWORD, passwordConfirm: NEW_PASSWORD })

    expect(res.status).toBe(401)
  })

  it('invalidates tokens issued before the password change', async () => {
    const { user, token } = await createUser()
    const oldToken = signToken(user._id, { payload: { iat: Math.floor(Date.now() / 1000) - 60 } })

    await request(app)
      .patch('/api/v1/auth/updateMyPassword')
      .set(auth(token))
      .send({ passwordCurrent: PASSWORD, password: NEW_PASSWORD, passwordConfirm: NEW_PASSWORD })
      .expect(200)

    const res = await request(app).get('/api/v1/users/me').set(auth(oldToken))

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/recently changed password/i)
  })

  it('requires all three password fields', async () => {
    const { token } = await createUser()

    const res = await request(app)
      .patch('/api/v1/auth/updateMyPassword')
      .set(auth(token))
      .send({ password: NEW_PASSWORD })

    expect(res.status).toBe(400)
  })
})
