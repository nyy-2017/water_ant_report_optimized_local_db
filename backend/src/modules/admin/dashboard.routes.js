const express = require('express');
const db = require('../../db');
const { auth, requirePerm } = require('../../middleware/auth');
const { hasAnyPerm } = require('../../utils/perm');

const router = express.Router();

/** 首页数据看板 */
router.get('/api/admin/dashboard', auth, requirePerm('dashboard:view'), (q, s) => {
  // 未获得日志查看权限的角色不下发操作日志明细
  const canSeeLogs = hasAnyPerm(q.user.role, ['log:list']);
  const cnt = (sql, ...a) => db.prepare(sql).get(...a).n || 0;
  const dateAt = i => db.prepare("select date('now','localtime','-" + i + " days') d").get().d;
  const statusList = ['待审核', '待派单', '已派单', '处理中', '已完成', '已驳回', '已取消'];
  const statusMap = Object.fromEntries(statusList.map(x => [x, 0]));
  db.prepare('select status,count(*) n from reports group by status').all().forEach(r => { statusMap[r.status] = r.n; });
  const doneMap = Object.fromEntries(db.prepare("select date(completed_at) d,count(*) n from reports where completed_at is not null and completed_at<>'' group by date(completed_at)").all().map(r => [r.d, r.n]));
  const newMap = Object.fromEntries(db.prepare('select date(created_at) d,count(*) n from reports group by date(created_at)').all().map(r => [r.d, r.n]));
  const trend = [];
  for (let i = 13; i >= 0; i--) { const d = dateAt(i); trend.push({ date: String(d).slice(5), created: newMap[d] || 0, completed: doneMap[d] || 0 }); }
  const avg = db.prepare("select avg((julianday(completed_at)-julianday(created_at))*24) h from reports where completed_at is not null and completed_at<>''").get().h;
  const total = cnt('select count(*) n from reports');
  s.json({
    updatedAt: db.prepare("select datetime('now','localtime') t").get().t,
    total,
    today: cnt("select count(*) n from reports where date(created_at)=date('now','localtime')"),
    week: cnt("select count(*) n from reports where date(created_at)>=date('now','localtime','-6 days')"),
    month: cnt("select count(*) n from reports where date(created_at)>=date('now','localtime','-29 days')"),
    pending: statusMap['待审核'] + statusMap['待派单'],
    processing: statusMap['已派单'] + statusMap['处理中'],
    finished: statusMap['已完成'],
    rejected: statusMap['已驳回'],
    cancelled: statusMap['已取消'],
    completionRate: total ? +((statusMap['已完成'] / total) * 100).toFixed(1) : 0,
    avgHours: avg ? +avg.toFixed(1) : 0,
    statusList: statusList.map(name => ({ name, value: statusMap[name] })),
    trend,
    types: db.prepare('select type name,count(*) value from reports group by type order by value desc limit 8').all(),
    locations: db.prepare('select location name,count(*) value from reports group by location order by value desc limit 8').all(),
    userRoles: db.prepare('select coalesce(r.name,u.role) name,u.role code,count(*) value from users u left join roles r on r.code=u.role group by u.role order by value desc').all(),
    userTotal: cnt('select count(*) n from users'),
    userActive: cnt('select count(*) n from users where active=1'),
    reports: db.prepare('select r.id,r.code,r.location,r.status,r.created_at,u.name submitter from reports r join users u on u.id=r.user_id order by r.id desc limit 8').all(),
    logs: canSeeLogs ? db.prepare('select id,username,user_name,action,module,ip,browser,os,status,created_at from sys_logs order by id desc limit 8').all() : [],
    logTotal: canSeeLogs ? cnt('select count(*) n from sys_logs') : 0,
    logToday: canSeeLogs ? cnt("select count(*) n from sys_logs where date(created_at)=date('now','localtime')") : 0,
    logFail: canSeeLogs ? cnt('select count(*) n from sys_logs where status=0') : 0
  });
});

module.exports = router;
