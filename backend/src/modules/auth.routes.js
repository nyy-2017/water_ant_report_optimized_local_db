const express = require('express'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const db = require('../db');
const { secret } = require('../config');
const { auth } = require('../middleware/auth');
const { writeLog } = require('../services/log.service');
const { buildTree, permList } = require('../utils/tree');

const router = express.Router();

/** 角色标识 → 角色名称（内置角色与自定义角色统一取数据库，不在代码里写死） */
const roleNameOf = code => {
  const r = db.prepare('select name from roles where code=?').get(code || '');
  return r ? r.name : (code || '');
};

/** 健康检查 */
router.get('/api/health', (q, s) => s.json({ ok: true }));

/** 登录 */
router.post('/api/auth/login', (q, s) => {
  const { username, password } = q.body || {};
  const u = db.prepare('select * from users where username=?').get(username || '');
  if (!u || !u.active || !bcrypt.compareSync(password || '', u.password_hash)) {
    writeLog(q, null, { username, module: '登录认证', action: '登录失败', status: 0, message: !u ? '账号不存在' : (!u.active ? '账号已停用' : '密码错误') });
    return s.status(401).json({ message: '账号或密码错误' });
  }
  writeLog(q, u, { module: '登录认证', action: '登录成功', message: '账号 ' + u.username + ' 登录成功' });
  s.json({
    token: jwt.sign({ id: u.id }, secret, { expiresIn: '8h' }),
    user: { id: u.id, username: u.username, name: u.name, role: u.role, role_name: roleNameOf(u.role), phone: u.phone || '', gender: u.gender || '未知', avatar: u.avatar || '' }
  });
});

/** 当前登录用户 */
router.get('/api/auth/me', auth, (q, s) => s.json({
  user: { ...q.user, role_name: roleNameOf(q.user.role), phone: q.user.phone || '', gender: q.user.gender || '未知', avatar: q.user.avatar || '' }
}));

/** 修改个人资料 */
router.patch('/api/auth/profile', auth, (q, s) => {
  const b = q.body || {};
  if (!String(b.name || '').trim()) return s.status(400).json({ message: '姓名不能为空' });
  if (b.phone && !/^[\d\-+ ]{5,30}$/.test(String(b.phone))) return s.status(400).json({ message: '手机号格式不正确' });
  if (!['男', '女', '未知'].includes(b.gender)) b.gender = '未知';
  if (b.avatar && (typeof b.avatar !== 'string' || b.avatar.length > 2048)) return s.status(400).json({ message: '头像信息无效' });
  db.prepare('update users set name=?,phone=?,gender=?,avatar=? where id=?')
    .run(String(b.name).trim().slice(0, 100), String(b.phone || '').slice(0, 30), b.gender, b.avatar || '', q.user.id);
  s.json({
    user: { ...q.user, role_name: roleNameOf(q.user.role), name: String(b.name).trim().slice(0, 100), phone: String(b.phone || '').slice(0, 30), gender: b.gender, avatar: b.avatar || '' }
  });
});

/** 退出登录 */
router.post('/api/auth/logout', auth, (q, s) => {
  writeLog(q, q.user, { module: '登录认证', action: '退出登录', message: '账号 ' + q.user.username + ' 退出登录' });
  s.json({ ok: true });
});

/** 当前登录用户可见的菜单树 + 权限点 */
router.get('/api/auth/menus', auth, (q, s) => {
  const rows = db.prepare('select id,parent_id,name,path,redirect,component,icon,type,permission,sort,visible,sys from menus where status=1 and visible=1 order by sort,id').all();
  const mine = q.user.role === 'admin' ? rows : rows.filter(m => db.prepare('select 1 from role_menus rm join roles r on r.id=rm.role_id where rm.menu_id=? and r.code=?').get(m.id, q.user.role));
  s.json({ items: buildTree(mine), permissions: [...new Set(permList(mine))] });
});

module.exports = router;
