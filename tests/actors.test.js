const request = require('supertest')
const app = require('../app')
const Actor = require('../models/actorModel')
const Movie = require('../models/movieModel')
const { setupTestDB } = require('./helpers/db')
const { createUser, createAdmin, createActor, createMovie, auth } = require('./helpers/factories')

setupTestDB()

const actorBody = {
  firstName: 'Morgan',
  lastName: 'Freeman',
  birthDate: '1937-06-01',
  birthPlace: 'Memphis, Tennessee, USA',
  biography: 'Actor and narrator with an unmistakable voice.',
  nationality: 'American'
}

describe('Actors API', () => {
  it('lists actors publicly', async () => {
    await createActor()
    await createActor()

    const res = await request(app).get('/api/v1/actors')

    expect(res.status).toBe(200)
    expect(res.body.results).toBe(2)
  })

  it('returns an actor with virtuals and filmography', async () => {
    const actor = await createActor({ firstName: 'Tom', lastName: 'Hanks', birthDate: '1956-07-09' })
    await createMovie({ title: 'Toy Story', cast: [actor._id] })

    const res = await request(app).get(`/api/v1/actors/${actor._id}`)

    expect(res.status).toBe(200)
    expect(res.body.data.actor.fullName).toBe('Tom Hanks')
    expect(res.body.data.actor.age).toBeGreaterThan(60)
    expect(res.body.data.actor.movies.map(m => m.title)).toEqual(['Toy Story'])
  })

  it('persists biography and birthPlace on create', async () => {
    const { token } = await createAdmin()

    const res = await request(app).post('/api/v1/actors').set(auth(token)).send(actorBody)

    expect(res.status).toBe(201)
    expect(res.body.data.actor).toMatchObject({
      biography: actorBody.biography,
      birthPlace: actorBody.birthPlace,
      slug: 'morgan-freeman'
    })
  })

  it('restricts create to admins', async () => {
    const { token } = await createUser()

    const res = await request(app).post('/api/v1/actors').set(auth(token)).send(actorBody)

    expect(res.status).toBe(403)
  })

  it('updates an actor', async () => {
    const { token } = await createAdmin()
    const actor = await createActor()

    const res = await request(app)
      .patch(`/api/v1/actors/${actor._id}`)
      .set(auth(token))
      .send({ nationality: 'Canadian' })

    expect(res.status).toBe(200)
    expect(res.body.data.actor.nationality).toBe('Canadian')
  })

  it('returns a single 404 response when updating a missing actor', async () => {
    const { token } = await createAdmin()

    const res = await request(app)
      .patch('/api/v1/actors/64a000000000000000000fff')
      .set(auth(token))
      .send({ nationality: 'Canadian' })

    expect(res.status).toBe(404)
    expect(res.body.message).toBe('No actor found with that ID')
  })

  it('removes a deleted actor from every movie cast', async () => {
    const { token } = await createAdmin()
    const actor = await createActor()
    const movie = await createMovie({ cast: [actor._id] })

    const res = await request(app).delete(`/api/v1/actors/${actor._id}`).set(auth(token))

    expect(res.status).toBe(204)
    expect(await Actor.findById(actor._id)).toBeNull()
    const updated = await Movie.findById(movie._id)
    expect(updated.cast).toHaveLength(0)
  })
})
