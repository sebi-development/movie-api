const mongoose = require('mongoose')
const slugify = require('slugify')
const validator = require('validator')

const ActorSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Actor must have a first name'],
    trim: true,
    maxlength: [50, 'First name must have at most 50 characters']
  },

  lastName: {
    type: String,
    required: [true, 'Actor must have a last name'],
    trim: true,
    maxlength: [50, 'Last name must have at most 50 characters']
  },

  slug: String,

  birthDate: {
    type: Date,
    validate: {
      validator: date => date <= Date.now(),
      message: 'Birth date cannot be in the future'
    }
  },

  birthPlace: {
    type: String,
    trim: true
  },

  biography: {
    type: String,
    trim: true,
    maxlength: [2000, 'Biography must have at most 2000 characters']
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
    validate: [value => validator.isURL(value), 'Please provide valid url format']
  }
}, {
  timestamps: true,
  id: false,
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true }
})

// INDEX
ActorSchema.index({ lastName: 1, firstName: 1 })

// VIRTUALS
ActorSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`
})

ActorSchema.virtual('age').get(function () {
  if (!this.birthDate) return undefined
  const ageDate = new Date(Date.now() - this.birthDate.getTime())
  return Math.abs(ageDate.getUTCFullYear() - 1970)
})

// Virtual populate: Get all movies this actor is in
ActorSchema.virtual('movies', {
  ref: 'Movie',
  foreignField: 'cast',
  localField: '_id'
})

// MIDDLEWARE
ActorSchema.pre('save', function () {
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.slug = slugify(`${this.firstName} ${this.lastName}`, { lower: true, strict: true })
  }
})

const Actor = mongoose.model('Actor', ActorSchema)

module.exports = Actor
