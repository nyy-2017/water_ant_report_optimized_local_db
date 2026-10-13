/**
 * 内置角色、菜单以及角色默认菜单授权的种子数据（仅在表为空时写入）
 *
 * 子系统划分（menus.sys）：
 *   ant    白蚁上报系统：数据看板、隐患工单
 *   device 设备监测系统：物联网设备监测
 *   system 系统管理：用户 / 角色 / 菜单 / 操作日志
 * 超级管理员（role=admin）默认拥有全部子系统，其他角色按「角色信息 - 分配菜单」授权，
 * 前端只展示该角色已被授权的子系统。
 *
 * 内置角色清单（不可删除，可在「角色信息」中调整其菜单授权）：
 * 新增内置角色时同步更新下方 BUILTIN_ROLE_GRANTS，老库由 migrateBuiltinRoles 自动补齐。
 */
const BUILTIN_ROLES = [
  ['admin', '系统管理员', '拥有系统全部权限', 1],
  ['dispatcher', '派单处置人员', '工单派单与处置结果录入', 2],
  ['reviewer', '审核人员', '隐患工单审核与驳回', 3],
  ['reporter', '巡查上报人员', '隐患上报及本人上报记录', 4],
  ['servers', '上门服务人员', '上门服务与现场处置结果录入', 5]
];

/** 内置角色默认授权的菜单路径 */
const BUILTIN_ROLE_GRANTS = {
  admin: ['/dashboard', '/reports', '/reports/list', '/reports/audit', '/devices', '/devices/list', '/system', '/system/users', '/system/roles', '/system/menus', '/logs', '/logs/list', '/logs/login'],
  dispatcher: ['/dashboard', '/reports', '/reports/list', '/system', '/system/users', '/logs', '/logs/list', '/logs/login'],
  reviewer: ['/dashboard', '/reports', '/reports/list', '/reports/audit'],
  reporter: ['/dashboard', '/reports', '/reports/list'],
  servers: ['/reports', '/reports/list']
};

function seed(db) {
  if (db.prepare('select count(*) n from roles').get().n === 0) db.transaction(() => {
    for (const [code, name, description, sort] of BUILTIN_ROLES)
      db.prepare('insert into roles(code,name,description,sort,builtin) values(?,?,?,?,1)').run(code, name, description, sort);
  })();

  /*
   * 菜单树：一级菜单「首页」直接跳转页面；「隐患工单」「设备监测系统」「系统管理」「操作日志」为目录，展开后是二级菜单。
   * 目录本身不注册路由（component 为空），点击只展开，二级菜单点击后进入对应页面。
   */
  if (db.prepare('select count(*) n from menus').get().n === 0) db.transaction(() => {
    const ins = db.prepare('insert into menus(parent_id,name,path,redirect,component,icon,type,permission,sort,visible,sys) values(?,?,?,?,?,?,?,?,?,?,?)');
    ins.run(0, '首页', '/dashboard', '', 'dashboard/index', 'DashboardOutlined', 'menu', 'dashboard:view', 1, 1, 'ant');

    ins.run(0, '隐患工单', '/reports', '/reports/list', '', 'AlertOutlined', 'dir', '', 2, 1, 'ant');
    const reports = db.prepare('select id from menus where path=?').get('/reports').id;
    ins.run(reports, '工单列表', '/reports/list', '', 'reports/index', 'ProfileOutlined', 'menu', 'report:list,report:review,report:assign,report:complete', 1, 1, 'ant');
    ins.run(reports, '待审核工单', '/reports/audit', '', 'reports/index', 'FileSearchOutlined', 'menu', 'report:list,report:review', 2, 1, 'ant');

    ins.run(0, '设备监测系统', '/devices', '/devices/list', '', 'DesktopOutlined', 'dir', '', 3, 1, 'device');
    const devices = db.prepare('select id from menus where path=?').get('/devices').id;
    ins.run(devices, '设备监测', '/devices/list', '', 'device/index', 'DashboardOutlined', 'menu', 'device:list', 1, 1, 'device');

    ins.run(0, '系统管理', '/system', '/system/users', '', 'SettingOutlined', 'dir', 'system:view', 4, 1, 'system');
    const sys = db.prepare('select id from menus where path=?').get('/system').id;
    ins.run(sys, '用户信息', '/system/users', '', 'system/users', 'UserOutlined', 'menu', 'user:list,user:create,user:update,user:delete,user:reset', 1, 1, 'system');
    ins.run(sys, '角色信息', '/system/roles', '', 'system/roles', 'SolutionOutlined', 'menu', 'role:list,role:create,role:update,role:delete,role:assign', 2, 1, 'system');
    ins.run(sys, '菜单信息', '/system/menus', '', 'system/menus', 'MenuOutlined', 'menu', 'menu:list,menu:create,menu:update,menu:delete', 3, 1, 'system');

    ins.run(0, '操作日志', '/logs', '/logs/list', '', 'FileTextOutlined', 'dir', '', 5, 1, 'system');
    const logs = db.prepare('select id from menus where path=?').get('/logs').id;
    ins.run(logs, '操作日志', '/logs/list', '', 'system/logs', 'FileTextOutlined', 'menu', 'log:list,log:clear', 1, 1, 'system');
    ins.run(logs, '登录日志', '/logs/login', '', 'system/logs', 'SafetyCertificateOutlined', 'menu', 'log:list', 2, 1, 'system');
  })();

  if (db.prepare('select count(*) n from role_menus').get().n === 0) db.transaction(() => {
    for (const [code, paths] of Object.entries(BUILTIN_ROLE_GRANTS)) grantMenus(db, code, paths);
  })();

  migrateMenuTree(db);
  migrateSystems(db);
  migrateBuiltinRoles(db);
}

/** 为角色授权菜单（按菜单 path） */
function grantMenus(db, code, paths) {
  const r = db.prepare('select id from roles where code=?').get(code);
  if (!r) return;
  for (const p of paths) {
    const m = db.prepare('select id from menus where path=?').get(p);
    if (m) db.prepare('insert or ignore into role_menus(role_id,menu_id) values(?,?)').run(r.id, m.id);
  }
}

/**
 * 旧库菜单结构升级（只执行一次）：
 * 「隐患工单」「操作日志」由一级菜单变成目录 + 二级菜单，首页保持一级菜单不需要展开。
 */
function migrateMenuTree(db) {
  if (db.prepare("select value from meta where key='menu_2level'").get()) return;

  const idOf = p => { const m = db.prepare('select id from menus where path=?').get(p); return m ? m.id : 0; };
  const ins = db.prepare('insert into menus(parent_id,name,path,redirect,component,icon,type,permission,sort,visible) values(?,?,?,?,?,?,?,?,?,?)');
  const grant = (code, paths) => {
    const r = db.prepare('select id from roles where code=?').get(code); if (!r) return;
    for (const p of paths) { const id = idOf(p); if (id) db.prepare('insert or ignore into role_menus(role_id,menu_id) values(?,?)').run(r.id, id); }
  };
  /** 已经能看到某个一级菜单的角色，自动获得它的二级菜单 */
  const grantChildren = (child, parent) => {
    const cid = idOf(child), pid = idOf(parent);
    if (cid && pid) db.prepare('insert or ignore into role_menus(role_id,menu_id) select role_id,? from role_menus where menu_id=?').run(cid, pid);
  };

  db.transaction(() => {
    // 隐患工单：一级菜单 -> 目录，并补上二级菜单
    let reports = idOf('/reports');
    if (reports) db.prepare("update menus set type='dir',component='',redirect='/reports/list' where id=?").run(reports);
    else reports = ins.run(0, '隐患工单', '/reports', '/reports/list', '', 'AlertOutlined', 'dir', '', 2, 1).lastInsertRowid;
    if (!idOf('/reports/list')) ins.run(reports, '工单列表', '/reports/list', '', 'reports/index', 'ProfileOutlined', 'menu', 'report:list,report:review,report:assign,report:complete', 1, 1);
    if (!idOf('/reports/audit')) ins.run(reports, '待审核工单', '/reports/audit', '', 'reports/index', 'FileSearchOutlined', 'menu', 'report:list,report:review', 2, 1);

    // 操作日志：一级菜单 -> 目录（路由由 /system/logs 调整为 /logs），并补上二级菜单
    let logs = idOf('/system/logs') || idOf('/logs');
    if (logs) db.prepare("update menus set path='/logs',type='dir',component='',redirect='/logs/list' where id=?").run(logs);
    else logs = ins.run(0, '操作日志', '/logs', '/logs/list', '', 'FileTextOutlined', 'dir', '', 4, 1).lastInsertRowid;
    if (!idOf('/logs/list')) ins.run(logs, '操作日志', '/logs/list', '', 'system/logs', 'FileTextOutlined', 'menu', 'log:list,log:clear', 1, 1);
    if (!idOf('/logs/login')) ins.run(logs, '登录日志', '/logs/login', '', 'system/logs', 'SafetyCertificateOutlined', 'menu', 'log:list', 2, 1);

    grantChildren('/reports/list', '/reports');
    grantChildren('/logs/list', '/logs');
    grantChildren('/logs/login', '/logs');
    // 待审核工单只开放给审核角色
    grant('reviewer', ['/reports/audit']);
    grant('admin', ['/reports/audit']);

    db.prepare("insert into meta(key,value) values('menu_2level','1')").run();
  })();
  console.log('菜单结构已升级：隐患工单 / 操作日志 拆分为二级菜单');
}

/**
 * 旧库子系统划分升级（只执行一次）：
 * 1. 按路由前缀补全 menus.sys（白蚁上报 / 设备监测 / 系统管理）；
 * 2. 补建「设备监测系统」目录与菜单，仅超级管理员默认可见；
 * 3. 已授权子系统的角色无需改动，其可见范围保持不变（新增设备监测需在角色信息中授权）。
 */
function migrateSystems(db) {
  if (db.prepare("select value from meta where key='sys_split'").get()) return;

  const idOf = p => { const m = db.prepare('select id from menus where path=?').get(p); return m ? m.id : 0; };

  db.transaction(() => {
    db.prepare("update menus set sys='ant' where path='/dashboard' or path='/reports' or path like '/reports/%'").run();
    db.prepare("update menus set sys='system' where path='/system' or path like '/system/%' or path='/logs' or path like '/logs/%'").run();

    let devices = idOf('/devices');
    if (devices) db.prepare("update menus set sys='device',type='dir',component='',redirect='/devices/list' where id=?").run(devices);
    else devices = db.prepare('insert into menus(parent_id,name,path,redirect,component,icon,type,permission,sort,visible,sys) values(?,?,?,?,?,?,?,?,?,?,?)')
      .run(0, '设备监测系统', '/devices', '/devices/list', '', 'DesktopOutlined', 'dir', '', 3, 1, 'device').lastInsertRowid;
    if (!idOf('/devices/list')) db.prepare('insert into menus(parent_id,name,path,redirect,component,icon,type,permission,sort,visible,sys) values(?,?,?,?,?,?,?,?,?,?,?)')
      .run(devices, '设备监测', '/devices/list', '', 'device/index', 'DashboardOutlined', 'menu', 'device:list', 1, 1, 'device');

    // 超级管理员默认拥有全部子系统（admin 本身不受菜单授权限制，这里保持数据一致）
    const admin = db.prepare('select id from roles where code=?').get('admin');
    if (admin) for (const p of ['/devices', '/devices/list']) {
      const id = idOf(p);
      if (id) db.prepare('insert or ignore into role_menus(role_id,menu_id) values(?,?)').run(admin.id, id);
    }

    db.prepare("insert into meta(key,value) values('sys_split','1')").run();
  })();
  console.log('子系统划分已升级：白蚁上报系统 / 设备监测系统 / 系统管理');
}

/**
 * 旧库补齐内置角色（只执行一次）：
 * 历史版本的种子只写了 4 个内置角色，缺少「上门服务人员（servers）」。
 * 这里把缺少的内置角色补出来并给予默认菜单授权；若该角色已存在（例如管理员手工创建过），
 * 只补内置标记，不覆盖其名称、描述与已授权菜单。
 */
function migrateBuiltinRoles(db) {
  if (db.prepare("select value from meta where key='builtin_roles_v2'").get()) return;

  db.transaction(() => {
    for (const [code, name, description, sort] of BUILTIN_ROLES) {
      const exist = db.prepare('select id,builtin from roles where code=?').get(code);
      if (exist) {
        if (!exist.builtin) db.prepare('update roles set builtin=1 where id=?').run(exist.id);
        continue;
      }
      const x = db.prepare('insert into roles(code,name,description,sort,builtin) values(?,?,?,?,1)').run(code, name, description, sort);
      grantMenus(db, code, BUILTIN_ROLE_GRANTS[code] || []);
      console.log('内置角色已补充：' + name + '（' + code + '）');
    }
    db.prepare("insert into meta(key,value) values('builtin_roles_v2','1')").run();
  })();
}

module.exports = { seed };
