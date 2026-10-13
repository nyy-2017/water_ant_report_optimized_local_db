const db = require('../db');

/**
 * 权限点工具：后端鉴权与前端 hasPerm 同源。
 *
 * 权限来源 = 角色被授权的菜单（role_menus）上配置的 permission 字段，
 * 与 /api/auth/menus 返回的 permissions 完全一致；超级管理员不受菜单授权限制。
 * 这样自定义角色（由超级管理员在「角色信息 - 分配菜单」中授权）也能正常访问对应接口。
 */

/** 角色已授权菜单携带的权限点集合 */
function rolePerms(roleCode) {
  const set = new Set();
  if (!roleCode) return set;
  const rows = db.prepare('select m.permission p from menus m join role_menus rm on rm.menu_id=m.id join roles r on r.id=rm.role_id where r.code=? and m.status=1').all(roleCode);
  for (const row of rows) for (const code of String(row.p || '').split(',')) { const v = code.trim(); if (v) set.add(v); }
  return set;
}

/** 是否拥有其中一个权限点（超级管理员恒为 true） */
function hasAnyPerm(roleCode, codes = []) {
  if (roleCode === 'admin') return true;
  if (!codes.length) return false;
  const owned = rolePerms(roleCode);
  return codes.some(c => owned.has(c));
}

/** 工单后台相关权限点 */
const REPORT_PERMS = ['report:list', 'report:review', 'report:assign', 'report:complete'];

/**
 * 是否能查看 / 操作全部工单：
 * 内置上报人 reporter 只允许查看本人记录，其余角色按被授权的权限点判断。
 */
function canViewAllReports(user) {
  if (!user) return false;
  if (user.role === 'reporter') return false;
  return hasAnyPerm(user.role, REPORT_PERMS);
}

/** 可作为工单处理人的启用账号：内置上报人，或角色拥有「填写处理结果」权限点的成员 */
function assigneeCandidates() {
  return db.prepare("select id,username,name,role from users where active=1 and role<>'admin' order by id").all()
    .filter(u => u.role === 'reporter' || hasAnyPerm(u.role, ['report:complete']));
}

/** 校验某个账号是否可作为处理人 */
function isAssignableUser(id) {
  const u = db.prepare('select id,role,active from users where id=?').get(+id || 0);
  return !!u && !!u.active && u.role !== 'admin' && (u.role === 'reporter' || hasAnyPerm(u.role, ['report:complete']));
}

module.exports = { rolePerms, hasAnyPerm, REPORT_PERMS, canViewAllReports, assigneeCandidates, isAssignableUser };
