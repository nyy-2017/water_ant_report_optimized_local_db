const db = require('../db');
const { parseUA } = require('../utils/ua');

/** 写入操作日志（失败不影响业务） */
function writeLog(q, user, opt = {}) {
  try {
    const c = parseUA(q), cut = (v, n) => String(v == null ? '' : v).slice(0, n);
    db.prepare("insert into sys_logs(user_id,username,user_name,module,action,method,url,ip,browser,os,status,message,duration,created_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))")
      .run(opt.userId != null ? opt.userId : (user ? user.id : null), cut(opt.username || (user && user.username), 60), cut(opt.name || (user && user.name), 60),
        cut(opt.module, 60), cut(opt.action, 120), cut(opt.method || q.method, 10), cut(opt.url || q.originalUrl, 300),
        cut(opt.ip || c.ip, 60), cut(opt.browser || c.browser, 60), cut(opt.os || c.os, 60), opt.status === 0 ? 0 : 1, cut(opt.message, 500), Math.max(0, +opt.duration || 0));
  } catch (e) { /* 日志写入失败不影响业务 */ }
}

module.exports = { writeLog };
