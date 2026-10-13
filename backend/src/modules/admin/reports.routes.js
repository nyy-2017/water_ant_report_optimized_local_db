const express = require('express');
const db = require('../../db');
const { auth, requirePerm } = require('../../middleware/auth');
const { writeLog } = require('../../services/log.service');
const { shape, addEvent } = require('../../services/report.service');
const { assigneeCandidates, isAssignableUser } = require('../../utils/perm');

const router = express.Router();

/** 工单管理列表（状态 / 关键字筛选） */
router.get('/api/admin/reports', auth, requirePerm('report:list'), (q, s) => {
  const status = ['待审核', '待派单', '已派单', '处理中', '已完成', '已驳回', '已取消'].includes(q.query.status) ? q.query.status : '';
  const term = '%' + String(q.query.q || '').slice(0, 100) + '%';
  const rows = db.prepare(`select r.*,u.name submitter_name,a.name assignee_name from reports r join users u on u.id=r.user_id left join users a on a.id=r.assignee_id where (?='' or r.status=?) and (?='%%' or r.code like ? or r.location like ? or r.address like ?) order by r.id desc limit 500`)
    .all(status, status, term, term, term, term);
  s.json({ items: rows.map(shape) });
});

/** 派单可选处理人（拥有处置权限的启用账号，供派单弹窗使用，避免暴露用户管理接口） */
router.get('/api/admin/reports/assignees', auth, requirePerm('report:assign'), (q, s) => s.json({ items: assigneeCandidates() }));

/** 工单审核（通过 / 驳回） */
router.patch('/api/admin/reports/:id/review', auth, requirePerm('report:review'), (q, s) => {
  const r = db.prepare('select * from reports where id=?').get(q.params.id);
  if (!r) return s.status(404).json({ message: '记录不存在' });
  if (r.status !== '待审核') return s.status(409).json({ message: '当前状态不能审核' });
  const ok = !!q.body.approved, st = ok ? '待派单' : '已驳回';
  db.prepare('update reports set status=? where id=?').run(st, r.id);
  addEvent(r.id, q.user.id, ok ? '审核通过' : '审核驳回', String(q.body.note || '').slice(0, 1000));
  writeLog(q, q.user, { module: '隐患工单', action: ok ? '审核通过' : '审核驳回', message: '工单 ' + r.code + (ok ? ' 审核通过' : ' 已驳回') });
  s.json({ ok: true, status: st });
});

/** 工单派单 */
router.patch('/api/admin/reports/:id/assign', auth, requirePerm('report:assign'), (q, s) => {
  const r = db.prepare('select * from reports where id=?').get(q.params.id);
  const assigneeId = +(q.body.assigneeId || 0);
  if (!r || r.status !== '待派单' || !isAssignableUser(assigneeId)) return s.status(400).json({ message: '工单状态或处理人员无效' });
  db.prepare("update reports set status='已派单',assignee_id=? where id=?").run(assigneeId, r.id);
  addEvent(r.id, q.user.id, '派单', String(q.body.note || ''));
  writeLog(q, q.user, { module: '隐患工单', action: '派单', message: '工单 ' + r.code + ' 已派给 ' + assigneeId + ' 号人员' });
  s.json({ ok: true, status: '已派单' });
});

/** 填写处理结果 */
router.patch('/api/admin/reports/:id/complete', auth, requirePerm('report:complete'), (q, s) => {
  const result = String(q.body.result || '').trim();
  if (!result) return s.status(400).json({ message: '请填写处理结果' });
  const r = db.prepare('select id,status,assignee_id from reports where id=?').get(q.params.id);
  if (!r) return s.status(404).json({ message: '记录不存在' });
  if (!['已派单', '处理中'].includes(r.status)) return s.status(409).json({ message: '当前工单状态不能填写处理结果' });
  db.prepare("update reports set status='已完成',result=?,completed_at=datetime('now','localtime') where id=?").run(result.slice(0, 3030), r.id);
  addEvent(r.id, q.user.id, '处理完成', result.slice(0, 1000));
  writeLog(q, q.user, { module: '隐患工单', action: '填写处理结果', message: '工单 ' + r.id + ' 处置完成' });
  s.json({ ok: true, status: '已完成' });
});

module.exports = router;
