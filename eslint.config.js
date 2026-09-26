const neostandard = require('neostandard')

module.exports = [
  ...neostandard({
    env: ['node', 'jest'],
    ignores: ['coverage/**', 'node_modules/**']
  })
]
