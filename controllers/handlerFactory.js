// Generic CRUD handlers shared by the resource controllers.
// Each factory returns an Express handler wrapped in catchAsync.

const AppError = require('../utils/AppError')
const APIFeatures = require('../utils/apiFeatures')
const catchAsync = require('../utils/catchAsync')
const filterObj = require('../utils/filterObj')

const notFound = (Model) => new AppError(`No ${Model.modelName.toLowerCase()} found with that ID`, 404)

// GET /resource — filtering, search, sorting, field limiting, pagination
exports.getAll = (Model, { key, searchable = false, baseFilter } = {}) =>
  catchAsync(async (req, res, next) => {
    const filter = baseFilter ? baseFilter(req) : {}

    const features = new APIFeatures(Model.find(filter), req.query)
    if (searchable) features.search()
    features.filter().sort().limitFields().paginate()

    const [docs, total] = await Promise.all([features.query, features.count()])

    res.status(200).json({
      status: 'success',
      results: docs.length,
      pagination: {
        total,
        page: features.page,
        limit: features.limit,
        pages: Math.ceil(total / features.limit)
      },
      data: { [key]: docs }
    })
  })

// GET /resource/:id
exports.getOne = (Model, { key, populate } = {}) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id).select('-__v')
    if (populate) query = query.populate(populate)

    const doc = await query
    if (!doc) return next(notFound(Model))

    res.status(200).json({
      status: 'success',
      data: { [key]: doc }
    })
  })

// POST /resource — only whitelisted fields are persisted
exports.createOne = (Model, { key, allowedFields }) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(filterObj(req.body, ...allowedFields))

    res.status(201).json({
      status: 'success',
      data: { [key]: doc }
    })
  })

// PATCH /resource/:id — uses save() so document middleware and validators run
exports.updateOne = (Model, { key, allowedFields }) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findById(req.params.id)
    if (!doc) return next(notFound(Model))

    doc.set(filterObj(req.body, ...allowedFields))
    await doc.save()

    res.status(200).json({
      status: 'success',
      data: { [key]: doc }
    })
  })

// DELETE /resource/:id — optional afterDelete hook for cascading clean-up
exports.deleteOne = (Model, { afterDelete } = {}) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id)
    if (!doc) return next(notFound(Model))

    if (afterDelete) await afterDelete(doc)

    res.status(204).send()
  })
