var express = require('express');
var router = express.Router();

var supplierController = require('../controllers/supplier');

router.get('/', supplierController.listSuppliers);

module.exports = router;