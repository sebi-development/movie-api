const request = require('supertest')
const app = require('../app')
const { setupTestDB } = require('./helpers/db')
const { createUser } = require('./helpers/factories')

setupTestDB()

describe('App', () => {
  it('GET / returns API info', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'success', docs: '/api-docs' })
  })

  it('GET /api/v1/health reports the database as connected', async () => {
    const res = await request(app).get('/api/v1/health')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'success', database: 'connected' })
  })

  it('serves Swagger UI at /api-docs', async () => {
    const res = await request(app).get('/api-docs/')

    expect(res.status).toBe(200)
    expect(res.text).toContain('swagger-ui')
  })

  it('returns a 404 JSON error (not 500) for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      status: 'fail',
      message: "Can't find GET /api/v1/does-not-exist on this server"
    })
  })

  it('returns 400 for malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid JSON in request body')
  })

  it('does not leak stack traces outside development', async () => {
    const res = await request(app).get('/api/v1/movies/not-an-id')

    expect(res.status).toBe(400)
    expect(res.body.stack).toBeUndefined()
  })

  it('sets security headers', async () => {
    const res = await request(app).get('/')

    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('blocks NoSQL injection in the login body', async () => {
    await createUser()

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } })

    expect(res.status).toBe(401)
    expect(res.body.token).toBeUndefined()
  })
})
