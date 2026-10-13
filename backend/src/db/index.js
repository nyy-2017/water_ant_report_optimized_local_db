const fs = require('fs'), path = require('path'), DB = require('better-sqlite3');
const config = require('../config');
const { initCoreSchema, initSystemSchema } = require('./schema');
const { seed } = require('./seed');

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

const db = new DB(config.dbFile);
db.pragma('journal_mode=WAL');
db.pragma('foreign_keys=ON');
db.pragma('busy_timeout=5000');

initCoreSchema(db);
initSystemSchema(db, config.dbFile);
seed(db);

console.log('SQLite database:', config.dbFile);

module.exports = db;
