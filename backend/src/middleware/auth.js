const jwt = require('jsonwebtoken');
const db = require('../db');
const { secret } = require('../config');
const { hasAnyPerm } = require('../utils/perm');

/** 校验 JWT 并挂载 req.user */
function auth(req, res, next) {
  try {
    const t = (req.headers.authorization || '').replace(/^Bearer /, '');
    const p = jwt.verify(t, secret);
    const u = db.prepare('select id,username,name,role,active,phone,gender,avatar from users where id=?').get(p.id);
    if (!u || !u.active) throw 0;
    req.user = u;
    next();
  } catch (e) { return res.status(401).json({ message: '请先登录' }); }
}

/**
 * 内置角色拦截（仅用于必须绑定内置角色的场景）。
 * 常规接口请优先使用 requirePerm，否则自定义角色会被误拒。
 */
function requireRole(...rs) {
  return (req, res, next) => rs.includes(req.user.role) ? next() : res.status(403).json({ message: '权限不足' });
}

/**
 * 权限点拦截：与前端 hasPerm 同源（角色已授权菜单的 permission）。
 * 超级管理员放行；多个权限点之间为「或」关系。
 */
function requirePerm(...codes) {
  return (req, res, next) => hasAnyPerm(req.user.role, codes) ? next() : res.status(403).json({ message: '权限不足' });
}

module.exports = { auth, requireRole, requirePerm };
