var express = require('express');
var router = express.Router();

var customerController = require('../controllers/customer');

router.get('/', customerController.listCustomers);

module.exports = router;