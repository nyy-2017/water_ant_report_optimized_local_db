const express = require('express');
const auth = require('./modules/auth.routes');
const upload = require('./modules/upload.routes');
const reports = require('./modules/report.routes');
const admin = require('./modules/admin');

const router = express.Router();
router.use(auth, upload, reports, admin);

module.exports = router;
