var express = require('express');
var router = express.Router();

var saftController = require('../controllers/saft.js');

router.get('/', saftController.formUpload);
router.post('/', saftController.upload);

module.exports = router;