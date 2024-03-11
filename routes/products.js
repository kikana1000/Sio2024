const express = require("express");
var router = express.Router();

var dashController = require('../controllers/dash.js');
const productsController = require("../controllers/products");

router.get("/", dashController.controlFiscalYearAfter, productsController.listProducts);

module.exports = router;
