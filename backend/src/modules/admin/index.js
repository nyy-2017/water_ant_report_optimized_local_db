const express = require('express');
const users = require('./users.routes');
const roles = require('./roles.routes');
const menus = require('./menus.routes');
const logs = require('./logs.routes');
const reports = require('./reports.routes');
const dashboard = require('./dashboard.routes');

const router = express.Router();
router.use(users, roles, menus, logs, reports, dashboard);

module.exports = router;
