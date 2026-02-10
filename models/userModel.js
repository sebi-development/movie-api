const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'User must have a name'],
    trim: true
  },

  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide valid email format']
  },

  password: {
    type: String,
    required: [true, 'Please provide your password'],
    minlength: 8,
    select: false
  },

  passwordConfirm: {
    type: String,
    required: [true, 'Please provide your password'],
    validate: {
      validator: function (el) {
        return el === this.password
      },
      message: 'Passwords are not the same!'
    },

  },
  passwordChangedAt: Date,
  photo: {
    type: String,
    default: 'default.jpg',

  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }
})

// INSTANCE METHODS

UserSchema.methods.correctPassword = async function (candidatePassword, hashedPassword) {
  return bcrypt.compare(candidatePassword, hashedPassword)
}

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10)
    return JWTTimestamp < changedTimestamp
  }
  return false
}

// MIDDLEWARE

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return

  this.password = await bcrypt.hash(this.password, 10)
  this.passwordConfirm = undefined
})

const User = mongoose.model('User', UserSchema)
module.exports = User