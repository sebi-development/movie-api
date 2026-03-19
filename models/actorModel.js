const mongoose = require('mongoose')
const slugify = require('slugify')
const validator = require('validator')

const ActorSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Actor must have a name'],
    trim: true
  },

  lastName: {
    type: String,
    required: [true, 'Actor must have a last name'],
    trim: true
  },

  slug: String,

  birthDate: {
    type: Date,
  },

  photo: {
    type: String,
    default: 'default-actor.jpg'
  },

  nationality: {
    type: String,
    trim: true
  },

  url: {
    type: String,
    validate: [validator.isURL, 'Please provide valid url format']
  }

}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// INDEX
ActorSchema.index({ firstName: 1, lastName: 1 })

// MIDDLEWARE
ActorSchema.virtual('fullName').get(function (next) {
  return `${this.firstName} ${this.lastName}`
})

ActorSchema.virtual('age').get(function (next) {
  if (!this.birthDate) return null
  const ageDiff = Date.now() - this.birthDate.getTime()
  const ageDate = new Date(ageDiff)
  return Math.abs(ageDate.getUTCFullYear() - 1970)

})

// Virtual populate: Get all movies this actor is in
ActorSchema.virtual('movies', {
  ref: 'Movie',
  foreignField: 'cast',
  localField: '_id'
})

ActorSchema.pre('save', function (next) {
  this.slug = slugify(`${this.firstName} ${this.lastName}`, { lower: true })
  next()
})

const Actor = mongoose.model('Actor', ActorSchema)

module.exports = Actor