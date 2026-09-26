// In-memory MongoDB: every test file gets its own isolated database server
const os = require('os')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

let mongod

exports.connect = async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri(), {
    // The MongoDB driver loads `os` with a dynamic import(), which Jest's CommonJS
    // sandbox rejects — hand it the module directly instead.
    runtimeAdapters: { os }
  })
  // Build indexes up front so unique constraints and $text search work
  await Promise.all(Object.values(mongoose.models).map(model => model.init()))
}

exports.clear = async () => {
  const { collections } = mongoose.connection
  await Promise.all(Object.values(collections).map(collection => collection.deleteMany({})))
}

exports.close = async () => {
  await mongoose.disconnect()
  if (mongod) await mongod.stop()
}

// Registers the standard lifecycle hooks for a test file
exports.setupTestDB = () => {
  beforeAll(exports.connect)
  afterEach(exports.clear)
  afterAll(exports.close)
}
