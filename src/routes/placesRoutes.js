const express = require('express');
const placesController = require('../controllers/placesController');

const router = express.Router();

router.get('/photo', (req, res) => placesController.getPhoto(req, res));
router.get('/meta', (req, res) => placesController.getMeta(req, res));

module.exports = router;
