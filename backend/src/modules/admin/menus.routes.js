const express = require('express');
const db = require('../../db');
const { auth, requirePerm } = require('../../middleware/auth');
const { writeLog } = require('../../services/log.service');
const { buildTree } = require('../../utils/tree');

const router = express.Router();
const MENU_FIELDS = 'id,parent_id,name,path,redirect,component,icon,type,permission,sort,visible,status,sys,created_at';

/** 允许归属的子系统编码：ant 白蚁上报 / device 设备监测 / system 系统管理，空串表示公共菜单（所有子系统都显示） */
const SYS_CODES = ['ant', 'device', 'system'];
const pickSys = v => (SYS_CODES.includes(String(v || '').trim()) ? String(v).trim() : '');

/** 上级菜单是否为其自身或下级（防止成环） */
const isSelfOrChild = (id, pid) => {
  let cur = pid;
  while (cur) {
    if (cur === id) return true;
    const r = db.prepare('select parent_id from menus where id=?').get(cur);
    cur = r ? r.parent_id : 0;
  }
  return false;
};

/** 菜单列表（树 + 扁平） */
router.get('/api/admin/menus', auth, requirePerm('menu:list'), (q, s) => {
  const rows = db.prepare('select ' + MENU_FIELDS + ' from menus order by sort,id').all();
  s.json({ items: buildTree(rows), rows });
});

/** 新增菜单 */
router.post('/api/admin/menus', auth, requirePerm('menu:create'), (q, s) => {
  const b = q.body || {}, name = String(b.name || '').trim(), type = ['dir', 'menu', 'action'].includes(b.type) ? b.type : 'menu', p = String(b.path || '').trim();
  if (!name) return s.status(400).json({ message: '菜单名称不能为空' });
  if (type !== 'action' && !p) return s.status(400).json({ message: '请填写路由地址' });
  const pid = +b.parent_id || 0;
  if (pid && !db.prepare('select id from menus where id=?').get(pid)) return s.status(400).json({ message: '上级菜单不存在' });
  if (p && db.prepare('select id from menus where path=?').get(p)) return s.status(409).json({ message: '路由地址已存在' });
  const x = db.prepare('insert into menus(parent_id,name,path,redirect,component,icon,type,permission,sort,visible,status,sys) values(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(pid, name.slice(0, 50), p.slice(0, 120), String(b.redirect || '').trim().slice(0, 120), String(b.component || '').trim().slice(0, 120), String(b.icon || '').trim().slice(0, 60), type, String(b.permission || '').trim().slice(0, 300), Math.max(0, +b.sort || 0), b.visible === false ? 0 : 1, b.status === false ? 0 : 1, pickSys(b.sys));
  writeLog(q, q.user, { module: '系统管理', action: '新增菜单', message: '新增菜单 ' + name });
  s.status(201).json({ id: x.lastInsertRowid });
});

/** 修改菜单 */
router.put('/api/admin/menus/:id', auth, requirePerm('menu:update'), (q, s) => {
  const id = +q.params.id;
  if (!db.prepare('select id from menus where id=?').get(id)) return s.status(404).json({ message: '菜单不存在' });
  const b = q.body || {}, name = String(b.name || '').trim(), type = ['dir', 'menu', 'action'].includes(b.type) ? b.type : 'menu', p = String(b.path || '').trim();
  if (!name) return s.status(400).json({ message: '菜单名称不能为空' });
  if (type !== 'action' && !p) return s.status(400).json({ message: '请填写路由地址' });
  const pid = +b.parent_id || 0;
  if (isSelfOrChild(id, pid)) return s.status(400).json({ message: '上级菜单不能是自身或其下级菜单' });
  if (p && db.prepare('select id from menus where path=? and id<>?').get(p, id)) return s.status(409).json({ message: '路由地址已存在' });
  db.prepare('update menus set parent_id=?,name=?,path=?,redirect=?,component=?,icon=?,type=?,permission=?,sort=?,visible=?,status=?,sys=? where id=?')
    .run(pid, name.slice(0, 50), p.slice(0, 120), String(b.redirect || '').trim().slice(0, 120), String(b.component || '').trim().slice(0, 120), String(b.icon || '').trim().slice(0, 60), type, String(b.permission || '').trim().slice(0, 300), Math.max(0, +b.sort || 0), b.visible === false ? 0 : 1, b.status === false ? 0 : 1, pickSys(b.sys), id);
  writeLog(q, q.user, { module: '系统管理', action: '修改菜单', message: '修改菜单 ' + name });
  s.json({ ok: true });
});

/** 删除菜单 */
router.delete('/api/admin/menus/:id', auth, requirePerm('menu:delete'), (q, s) => {
  const id = +q.params.id;
  const m = db.prepare('select id,name from menus where id=?').get(id);
  if (!m) return s.status(404).json({ message: '菜单不存在' });
  if (db.prepare('select count(*) n from menus where parent_id=?').get(id).n) return s.status(409).json({ message: '请先删除下级菜单' });
  db.prepare('delete from menus where id=?').run(id);
  writeLog(q, q.user, { module: '系统管理', action: '删除菜单', message: '删除菜单 ' + m.name });
  s.json({ ok: true });
});

module.exports = router;
