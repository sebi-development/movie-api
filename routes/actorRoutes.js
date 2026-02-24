const express = require('express')
const actorController = require('../controllers/actorController')
const authController = require('../controllers/authController')

const router = express.Router()

// PUBLIC

router.get('/', actorController.getAllActors)
router.get('/:id', actorController.getActor)

// PROTECTED

router.use(authController.protect)
router.use(authController.restrictTo('admin'))

router.post('/', actorController.createActor)
router.patch('/:id', actorController.updateActor)
router.delete('/:id', actorController.deleteActor)

module.exports = router