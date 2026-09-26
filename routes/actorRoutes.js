const express = require('express')
const actorController = require('../controllers/actorController')
const authController = require('../controllers/authController')

const router = express.Router()

router
  .route('/')
  .get(actorController.getAllActors)
  .post(authController.protect, authController.restrictTo('admin'), actorController.createActor)

router
  .route('/:id')
  .get(actorController.getActor)
  .patch(authController.protect, authController.restrictTo('admin'), actorController.updateActor)
  .delete(authController.protect, authController.restrictTo('admin'), actorController.deleteActor)

module.exports = router
