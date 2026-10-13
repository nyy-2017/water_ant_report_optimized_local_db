const express = require('express'), helmet = require('helmet'), cors = require('cors'), rateLimit = require('express-rate-limit');
const config = require('./config');
const routes = require('./routes');
const { errorHandler } = require('./middleware/error');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(config.uploadDir, { index: false }));
app.use('/api', rateLimit({ windowMs: 900000, limit: 300 }));

app.use(routes);

app.use(errorHandler);

module.exports = { app, config };
