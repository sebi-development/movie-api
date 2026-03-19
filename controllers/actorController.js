const Actor = require('../models/actorModel')
const Movie = require('../models/movieModel')
const catchAsync = require('../utils/catchAsync')
const AppError = require('../utils/AppError')
const APIFeatures = require('../utils/apiFeatures')

function actorNotFound(next) {
  return next(new AppError('No actor found with that ID', 404))
}

exports.getAllActors = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Actor.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate()

  const actors = await features.query

  res.status(200).json({
    status: 'success',
    results: actors.length,
    data: { actors }
  })
})

exports.getActor = catchAsync(async (req, res, next) => {
  const actor = await Actor.findById(req.params.id).populate('movies')

  if (!actor) {
    return actorNotFound(next)
  }

  res.status(200).json({
    status: 'success',
    data: { actor }
  })
})

exports.createActor = catchAsync(async (req, res, next) => {
  const newActor = await Actor.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    birthDate: req.body.birthDate,
    birthPlace: req.body.birthPlace,
    biography: req.body.biography,
    photo: req.body.photo,
    nationality: req.body.nationality
  })

  res.status(201).json({
    status: 'success',
    data: { actor: newActor }
  })
})

exports.updateActor = catchAsync(async (req, res, next) => {
  const actor = await Actor.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  )

  if (!actor) actorNotFound(next)

  res.status(200).json({
    status: 'success',
    data: { actor }
  })
})

exports.deleteActor = catchAsync(async (req, res, next) => {
  const actor = await Actor.findByIdAndDelete(req.params.id)

  if (!actor) return actorNotFound(next)

  // Remove actor from all movies
  await Movie.updateMany(
    { cast: actor._id },
    { $pull: { cast: actor._id } }
  )

  res.status(204).json({
    status: 'success',
    data: null
  })
})