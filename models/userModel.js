const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')

const BCRYPT_COST = 12

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'User must have a name'],
    trim: true,
    maxlength: [50, 'Name must have at most 50 characters']
  },

  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [value => validator.isEmail(value), 'Please provide valid email format']
  },

  password: {
    type: String,
    required: [true, 'Please provide your password'],
    minlength: [8, 'Password must have at least 8 characters'],
    select: false
  },

  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // Only works on create() and save()
      validator: function (el) {
        return el === this.password
      },
      message: 'Passwords are not the same!'
    }
  },

  passwordChangedAt: {
    type: Date,
    select: false
  },

  photo: {
    type: String,
    default: 'default.jpg'
  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  watchlist: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Movie'
    }
  ],

  // Soft delete flag (DELETE /users/deleteMe)
  active: {
    type: Boolean,
    default: true,
    select: false
  }
}, {
  timestamps: true
})

// INSTANCE METHODS

UserSchema.methods.correctPassword = async function (candidatePassword, hashedPassword) {
  return bcrypt.compare(candidatePassword, hashedPassword)
}

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000)
    return JWTTimestamp < changedTimestamp
  }
  return false
}

// MIDDLEWARE

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return

  this.password = await bcrypt.hash(this.password, BCRYPT_COST)
  this.passwordConfirm = undefined

  // Subtract 1s so a token issued right after this save is still considered valid
  if (!this.isNew) this.passwordChangedAt = Date.now() - 1000
})

// Hide deactivated accounts from every find query
UserSchema.pre(/^find/, function () {
  this.where({ active: { $ne: false } })
})

// Never leak internal fields, even if a query explicitly selected them
UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password
    delete ret.passwordConfirm
    delete ret.passwordChangedAt
    delete ret.active
    delete ret.__v
    return ret
  }
})

const User = mongoose.model('User', UserSchema)
module.exports = User
