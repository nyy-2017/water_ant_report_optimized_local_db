/** 统一错误处理（必须注册在所有路由之后） */
function errorHandler(e, q, s, n) {
  if (e && e.code === 'LIMIT_FILE_SIZE') return s.status(413).json({ message: '单张照片不能超过8MB' });
  if (e && e.message === '仅支持 JPG/PNG/WEBP 图片') return s.status(400).json({ message: e.message });
  console.error(e);
  s.status(500).json({ message: '服务器内部错误' });
}

module.exports = { errorHandler };
