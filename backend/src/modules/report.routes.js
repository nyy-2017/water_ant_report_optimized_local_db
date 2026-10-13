const express = require('express'), crypto = require('crypto');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { shape, addEvent, listEvents } = require('../services/report.service');
const { canViewAllReports } = require('../utils/perm');

const router = express.Router();

/** 提交隐患上报 */
router.post('/api/reports', auth, (q, s) => {
  const b = q.body || {};
  if (!b.location || !b.address || !b.date || !b.type || !b.description || !Number.isFinite(+b.latitude) || !Number.isFinite(+b.longitude) || +b.latitude < -90 || +b.latitude > 90 || +b.longitude < -180 || +b.longitude > 180)
    return s.status(400).json({ message: '必填信息不完整' });
  if (!Array.isArray(b.photos) || b.photos.length > 6 || b.photos.some(p => typeof p !== 'string' || p.length > 2048))
    return s.status(400).json({ message: '照片信息无效，最多上传6张' });
  const code = 'BT' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
  const x = db.prepare('insert into reports(code,user_id,location,address,latitude,longitude,date,type,description,reporter,phone,photos) values(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(code, q.user.id, String(b.location).slice(0, 200), String(b.address).slice(0, 300), +b.latitude, +b.longitude, String(b.date), String(b.type).slice(0, 100), String(b.description).slice(0, 2000), String(b.reporter || q.user.name).slice(0, 100), String(b.phone || '').slice(0, 30), JSON.stringify(b.photos));
  addEvent(x.lastInsertRowid, q.user.id, '提交上报');
  s.status(201).json({ id: x.lastInsertRowid, code, status: '待审核' });
});

/** 本人上报记录 */
router.get('/api/reports/mine', auth, (q, s) => s.json({
  items: db.prepare('select * from reports where user_id=? order by id desc limit 200').all(q.user.id).map(shape)
}));

/** 工单详情 */
router.get('/api/reports/:id', auth, (q, s) => {
  const r = db.prepare('select * from reports where id=? or code=?').get(q.params.id, q.params.id);
  if (!r) return s.status(404).json({ message: '记录不存在' });
  if (!canViewAllReports(q.user) && r.user_id !== q.user.id) return s.status(403).json({ message: '无权查看' });
  r.events = listEvents(r.id);
  s.json({ item: shape(r) });
});

/** 取消工单 */
router.patch('/api/reports/:id/cancel', auth, (q, s) => {
  const r = db.prepare('select id,user_id,status from reports where id=? or code=?').get(q.params.id, q.params.id);
  if (!r) return s.status(404).json({ message: '记录不存在' });
  if (!canViewAllReports(q.user) && r.user_id !== q.user.id) return s.status(403).json({ message: '无权操作' });
  if (!['待审核', '待派单'].includes(r.status)) return s.status(409).json({ message: '当前状态不能取消订单' });
  db.prepare("update reports set status='已取消' where id=?").run(r.id);
  addEvent(r.id, q.user.id, '取消订单', String((q.body || {}).note || '').slice(0, 1000));
  s.json({ ok: true, status: '已取消' });
});

module.exports = router;
