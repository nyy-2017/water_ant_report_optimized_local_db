const fs = require('fs'), path = require('path');

/** 后端根目录（server.js 所在目录） */
const rootDir = path.resolve(__dirname, '..');

/** 相对路径按后端根目录解析，绝对路径直接使用 */
const resolveLocal = (value, fallback) =>
  path.isAbsolute(value || '') ? (value || fallback) : path.resolve(rootDir, value || fallback);

const port = +(process.env.PORT || 3030);
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) { console.error('JWT_SECRET must be at least 32 chars'); process.exit(1); }

const uploadDir = resolveLocal(process.env.UPLOAD_DIR, './uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const dbFile = resolveLocal(process.env.DB_PATH, './data/water-ant.sqlite');

const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);

module.exports = { rootDir, port, secret, uploadDir, dbFile, corsOrigins };
