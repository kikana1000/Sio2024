var express = require('express');
var router = express.Router();

var dashController = require('../controllers/dash.js');

router.get('/:year', dashController.controlFiscalYear, dashController.index);

module.exports = router;