const Actor = require('../models/actorModel')
const Movie = require('../models/movieModel')
const factory = require('./handlerFactory')

const ALLOWED_FIELDS = [
  'firstName', 'lastName', 'birthDate', 'birthPlace',
  'biography', 'photo', 'nationality', 'url'
]

exports.getAllActors = factory.getAll(Actor, { key: 'actors' })

exports.getActor = factory.getOne(Actor, {
  key: 'actor',
  populate: { path: 'movies', select: 'title releaseYear posterUrl ratingsAverage' }
})

exports.createActor = factory.createOne(Actor, { key: 'actor', allowedFields: ALLOWED_FIELDS })

exports.updateActor = factory.updateOne(Actor, { key: 'actor', allowedFields: ALLOWED_FIELDS })

// Remove the deleted actor from the cast of every movie
exports.deleteActor = factory.deleteOne(Actor, {
  afterDelete: actor => Movie.updateMany({ cast: actor._id }, { $pull: { cast: actor._id } })
})
