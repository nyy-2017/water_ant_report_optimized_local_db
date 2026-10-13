const crypto = require('crypto'), path = require('path'), multer = require('multer');
const { uploadDir } = require('../config');

const storage = multer.diskStorage({
  destination: (a, b, cb) => cb(null, uploadDir),
  filename: (a, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase())
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (a, f, cb) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype) ? cb(null, true) : cb(new Error('仅支持 JPG/PNG/WEBP 图片'))
});

module.exports = { upload };
