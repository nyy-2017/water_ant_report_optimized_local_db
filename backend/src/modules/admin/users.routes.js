const express = require('express'), bcrypt = require('bcryptjs');
const db = require('../../db');
const { auth, requirePerm } = require('../../middleware/auth');
const { writeLog } = require('../../services/log.service');

const router = express.Router();
const USER_COLS = 'select id,username,name,role,active,phone,gender,created_at from users';

/** 用户列表 */
router.get('/api/admin/users', auth, requirePerm('user:list'), (q, s) => s.json({
  items: db.prepare(USER_COLS + ' order by id').all()
}));

/** 新增用户 */
router.post('/api/admin/users', auth, requirePerm('user:create'), (q, s) => {
  const { username, password, name, phone, gender, role: r } = q.body || {};
  if (!username || !name || !password || String(password).length < 6 || !db.prepare('select code from roles where code=?').get(r))
    return s.status(400).json({ message: '请填写完整的账号信息，密码至少 6 位且角色有效' });
  try {
    const x = db.prepare('insert into users(username,password_hash,name,role,phone,gender) values(?,?,?,?,?,?)')
      .run(String(username).trim(), bcrypt.hashSync(String(password), 12), String(name).trim(), r, String(phone || '').slice(0, 30), ['男', '女'].includes(gender) ? gender : '未知');
    writeLog(q, q.user, { module: '系统管理', action: '新增用户', message: '新增账号 ' + username + '（' + name + '）' });
    s.status(201).json({ id: x.lastInsertRowid });
  } catch (e) { s.status(409).json({ message: '用户名已存在' }); }
});

/** 启用 / 停用用户 */
router.patch('/api/admin/users/:id/active', auth, requirePerm('user:update'), (q, s) => {
  if (+q.params.id === q.user.id && !q.body.active) return s.status(400).json({ message: '不能停用当前账号' });
  const u = db.prepare('select username,name from users where id=?').get(q.params.id);
  const x = db.prepare('update users set active=? where id=?').run(q.body.active ? 1 : 0, q.params.id);
  if (u) writeLog(q, q.user, { module: '系统管理', action: q.body.active ? '启用用户' : '停用用户', message: (q.body.active ? '启用' : '停用') + '账号 ' + u.username });
  s.json({ ok: !!x.changes });
});

/** 修改用户 */
router.put('/api/admin/users/:id', auth, requirePerm('user:update'), (q, s) => {
  const b = q.body || {}, id = +q.params.id;
  const u = db.prepare('select id,username,name,active from users where id=?').get(id);
  if (!u) return s.status(404).json({ message: '用户不存在' });
  if (!String(b.name || '').trim()) return s.status(400).json({ message: '姓名不能为空' });
  if (b.role && !db.prepare('select code from roles where code=?').get(b.role)) return s.status(400).json({ message: '角色无效' });
  if (b.phone && !/^[\d\-+ ]{5,30}$/.test(String(b.phone))) return s.status(400).json({ message: '手机号格式不正确' });
  if (id === q.user.id && !b.active) return s.status(400).json({ message: '不能停用当前账号' });
  db.prepare('update users set name=?,phone=?,gender=?,role=coalesce(?,role),active=? where id=?')
    .run(String(b.name).trim().slice(0, 100), String(b.phone || '').slice(0, 30), ['男', '女'].includes(b.gender) ? b.gender : '未知', b.role || null, b.active === false ? 0 : 1, id);
  writeLog(q, q.user, { module: '系统管理', action: '修改用户', message: '修改账号 ' + u.username + ' 的资料' });
  s.json({ ok: true });
});

/** 删除用户 */
router.delete('/api/admin/users/:id', auth, requirePerm('user:delete'), (q, s) => {
  const id = +q.params.id;
  const u = db.prepare('select username,name from users where id=?').get(id);
  if (!u) return s.status(404).json({ message: '用户不存在' });
  if (id === q.user.id) return s.status(400).json({ message: '不能删除当前登录账号' });
  if (db.prepare('select count(*) n from reports where user_id=? or assignee_id=?').get(id, id).n) return s.status(409).json({ message: '该账号已关联工单数据，建议改用「停用」' });
  db.prepare('delete from users where id=?').run(id);
  writeLog(q, q.user, { module: '系统管理', action: '删除用户', message: '删除账号 ' + u.username });
  s.json({ ok: true });
});

/** 重置密码 */
router.post('/api/admin/users/:id/reset-password', auth, requirePerm('user:reset'), (q, s) => {
  const p = String((q.body || {}).password || ''), id = +q.params.id;
  const u = db.prepare('select username from users where id=?').get(id);
  if (!u) return s.status(404).json({ message: '用户不存在' });
  if (p.length < 6) return s.status(400).json({ message: '新密码至少 6 位' });
  db.prepare('update users set password_hash=? where id=?').run(bcrypt.hashSync(p, 12), id);
  writeLog(q, q.user, { module: '系统管理', action: '重置密码', message: '重置账号 ' + u.username + ' 的密码' });
  s.json({ ok: true });
});

module.exports = router;
