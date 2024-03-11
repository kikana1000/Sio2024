var express = require('express');
var router = express.Router();

var indexController = require('../controllers/index.js');

router.get('/', indexController.index);

module.exports = router;
