const express = require('express');
const db = require('../../db');
const { auth, requirePerm } = require('../../middleware/auth');
const { writeLog } = require('../../services/log.service');

const router = express.Router();

/** 角色列表（含用户数与已分配菜单） */
router.get('/api/admin/roles', auth, requirePerm('role:list'), (q, s) => {
  const rows = db.prepare('select r.id,r.code,r.name,r.description,r.sort,r.status,r.builtin,r.created_at,(select count(*) from users u where u.role=r.code) user_count from roles r order by r.sort,r.id').all();
  s.json({
    items: rows.map(r => ({ ...r, menuIds: db.prepare('select menu_id from role_menus where role_id=?').all(r.id).map(x => x.menu_id) }))
  });
});

/** 新增角色 */
router.post('/api/admin/roles', auth, requirePerm('role:create'), (q, s) => {
  const b = q.body || {}, code = String(b.code || '').trim(), name = String(b.name || '').trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,30}$/.test(code)) return s.status(400).json({ message: '角色标识需字母开头，2-31 位字母/数字/_/-' });
  if (!name) return s.status(400).json({ message: '角色名称不能为空' });
  try {
    const x = db.prepare('insert into roles(code,name,description,sort,status) values(?,?,?,?,?)')
      .run(code, name.slice(0, 50), String(b.description || '').trim().slice(0, 200), Math.max(0, +b.sort || 0), b.status === false ? 0 : 1);
    writeLog(q, q.user, { module: '系统管理', action: '新增角色', message: '新增角色 ' + name + '(' + code + ')' });
    s.status(201).json({ id: x.lastInsertRowid });
  } catch (e) { s.status(409).json({ message: '角色标识已存在' }); }
});

/** 修改角色 */
router.put('/api/admin/roles/:id', auth, requirePerm('role:update'), (q, s) => {
  const id = +q.params.id;
  const r = db.prepare('select id,name from roles where id=?').get(id);
  if (!r) return s.status(404).json({ message: '角色不存在' });
  const b = q.body || {}, name = String(b.name || '').trim();
  if (!name) return s.status(400).json({ message: '角色名称不能为空' });
  const nextStatus = b.status === false ? 0 : 1;
  if (!nextStatus && db.prepare('select count(*) n from users where role=?').get(r.code).n) return s.status(409).json({ message: '该角色下仍有账号，无法停用' });
  db.prepare('update roles set name=?,description=?,sort=?,status=? where id=?')
    .run(name.slice(0, 50), String(b.description || '').trim().slice(0, 200), Math.max(0, +b.sort || 0), nextStatus, id);
  writeLog(q, q.user, { module: '系统管理', action: '修改角色', message: '修改角色 ' + r.name });
  s.json({ ok: true });
});

/** 删除角色 */
router.delete('/api/admin/roles/:id', auth, requirePerm('role:delete'), (q, s) => {
  const id = +q.params.id;
  const r = db.prepare('select id,name,code,builtin from roles where id=?').get(id);
  if (!r) return s.status(404).json({ message: '角色不存在' });
  if (r.builtin) return s.status(409).json({ message: '内置角色不可删除' });
  if (db.prepare('select count(*) n from users where role=?').get(r.code).n) return s.status(409).json({ message: '该角色下仍有账号，请先调整这些账号的角色' });
  db.prepare('delete from roles where id=?').run(id);
  writeLog(q, q.user, { module: '系统管理', action: '删除角色', message: '删除角色 ' + r.name });
  s.json({ ok: true });
});

/** 为角色分配菜单 */
router.put('/api/admin/roles/:id/menus', auth, requirePerm('role:assign'), (q, s) => {
  const id = +q.params.id;
  const r = db.prepare('select id,name from roles where id=?').get(id);
  if (!r) return s.status(404).json({ message: '角色不存在' });
  const ids = Array.isArray(q.body.menuIds) ? q.body.menuIds.map(Number).filter(Boolean) : [];
  db.transaction(() => {
    db.prepare('delete from role_menus where role_id=?').run(id);
    for (const mid of ids) if (db.prepare('select id from menus where id=?').get(mid)) db.prepare('insert or ignore into role_menus(role_id,menu_id) values(?,?)').run(id, mid);
  })();
  writeLog(q, q.user, { module: '系统管理', action: '分配菜单', message: '为角色 ' + r.name + ' 分配 ' + ids.length + ' 个菜单' });
  s.json({ ok: true });
});

module.exports = router;
