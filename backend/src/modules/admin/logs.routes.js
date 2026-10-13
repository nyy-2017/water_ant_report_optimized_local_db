const express = require('express');
const db = require('../../db');
const { auth, requirePerm } = require('../../middleware/auth');
const { writeLog } = require('../../services/log.service');

const router = express.Router();

/** 操作日志分页查询 */
router.get('/api/admin/logs', auth, requirePerm('log:list'), (q, s) => {
  const page = Math.max(1, +q.query.page || 1), size = Math.min(200, Math.max(1, +q.query.size || 20));
  const w = [], p = [];
  const kw = String(q.query.username || '').trim();
  if (kw) { w.push('(username like ? or user_name like ?)'); p.push('%' + kw + '%', '%' + kw + '%'); }
  const md = String(q.query.module || '').trim(); if (md) { w.push('module=?'); p.push(md); }
  const ac = String(q.query.action || '').trim(); if (ac) { w.push('action like ?'); p.push('%' + ac + '%'); }
  if (q.query.status === '0' || q.query.status === '1') { w.push('status=?'); p.push(+q.query.status); }
  const from = String(q.query.from || '').trim(), to = String(q.query.to || '').trim();
  if (from) { w.push('date(created_at)>=date(?)'); p.push(from); }
  if (to) { w.push('date(created_at)<=date(?)'); p.push(to); }
  const where = w.length ? ' where ' + w.join(' and ') : '';
  const total = db.prepare('select count(*) n from sys_logs' + where).get(...p).n;
  const items = db.prepare('select * from sys_logs' + where + ' order by id desc limit ? offset ?').all(...p, size, (page - 1) * size);
  s.json({ items, total, page, size });
});

/** 日志模块 / 动作枚举（用于筛选下拉） */
router.get('/api/admin/logs/modules', auth, requirePerm('log:list'), (q, s) => s.json({
  modules: db.prepare("select distinct module from sys_logs where module<>'' order by module").all().map(x => x.module),
  actions: db.prepare("select distinct action from sys_logs where action<>'' order by action").all().map(x => x.action)
}));

/** 清空 / 按日期清理日志 */
router.delete('/api/admin/logs', auth, requirePerm('log:clear'), (q, s) => {
  const before = String(q.query.before || '').trim();
  const x = before ? db.prepare('delete from sys_logs where date(created_at)<=date(?)').run(before) : db.prepare('delete from sys_logs').run();
  writeLog(q, q.user, { module: '系统管理', action: '清空日志', message: (before ? '清理 ' + before + ' 之前' : '清空全部') + '共 ' + x.changes + ' 条操作日志' });
  s.json({ ok: true, deleted: x.changes });
});

module.exports = router;
