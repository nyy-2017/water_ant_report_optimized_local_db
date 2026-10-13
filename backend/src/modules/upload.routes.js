const express = require('express');
const { auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

/** 上传单张隐患照片 */
router.post('/api/uploads', auth, upload.single('file'), (q, s) => {
  if (!q.file) return s.status(400).json({ message: '仅支持 JPG/PNG/WEBP 图片' });
  const base = (process.env.PUBLIC_BASE_URL || `${q.protocol}://${q.get('host')}`).replace(/\/$/, '');
  s.status(201).json({ id: q.file.filename, url: base + '/uploads/' + q.file.filename });
});

module.exports = router;
