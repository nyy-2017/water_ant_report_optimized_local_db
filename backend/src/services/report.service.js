const db = require('../db');

/** 工单 photos 字符串转数组 */
function shape(x) { return x && ({ ...x, photos: JSON.parse(x.photos || '[]') }); }

/** 记录工单流转事件 */
function addEvent(id, u, a, n = '') {
  db.prepare("insert into events(report_id,actor_id,action,note,created_at) values(?,?,?,?,datetime('now','localtime'))").run(id, u, a, n);
}

/** 工单流转事件列表（含操作人姓名） */
function listEvents(reportId) {
  return db.prepare('select e.action,e.note,e.created_at,u.name actor from events e join users u on e.actor_id=u.id where report_id=? order by e.id desc').all(reportId);
}

module.exports = { shape, addEvent, listEvents };
