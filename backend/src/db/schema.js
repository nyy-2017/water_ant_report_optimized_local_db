const fs = require('fs'), bcrypt = require('bcryptjs');

/** 核心业务表：users / reports / events，以及存量数据的列与 timezone 迁移 */
function initCoreSchema(db) {
  // users.role 存角色标识（roles.code）：初始建表不加固定枚举约束，避免内置/自定义角色被写死，
  // 稍后由 initSystemSchema 升级为外键引用 roles.code（含 users_v2 迁移）。
  db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,user_id INTEGER NOT NULL REFERENCES users(id),location TEXT NOT NULL,address TEXT NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,date TEXT NOT NULL,type TEXT NOT NULL,description TEXT NOT NULL,reporter TEXT,phone TEXT,photos TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT '待审核',assignee_id INTEGER REFERENCES users(id),result TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT (datetime('now','localtime')),completed_at TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,report_id INTEGER NOT NULL REFERENCES reports(id),actor_id INTEGER NOT NULL REFERENCES users(id),action TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id,id DESC);CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status,id DESC);CREATE INDEX IF NOT EXISTS idx_reports_assignee ON reports(assignee_id);CREATE INDEX IF NOT EXISTS idx_events_report ON events(report_id,id DESC);`);

  for (const col of ['phone TEXT', 'gender TEXT', 'avatar TEXT']) { try { db.exec('ALTER TABLE users ADD COLUMN ' + col); } catch (e) { /* 列已存在 */ } }

  db.exec('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT)');

  if (!db.prepare("select value from meta where key='tz_fixed_8h'").get()) {
    db.exec("update reports set created_at=datetime(created_at,'+8 hours'),completed_at=datetime(completed_at,'+8 hours');update events set created_at=datetime(created_at,'+8 hours');update users set created_at=datetime(created_at,'+8 hours');");
    db.prepare("insert into meta(key,value) values('tz_fixed_8h','1')").run();
    console.log('时区修正：存量 UTC 时间已 +8 小时');
  }

  if (!db.prepare('select count(*) n from users').get().n && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD)
    db.prepare('insert into users(username,password_hash,name,role) values(?,?,?,?)')
      .run(process.env.ADMIN_USERNAME, bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12), '系统管理员', 'admin');
}

/** 系统管理扩展表：roles / menus / role_menus / sys_logs，并把 users 升级为外键引用 roles.code */
function initSystemSchema(db, dbFile) {
  db.exec(`CREATE TABLE IF NOT EXISTS roles(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',sort INTEGER NOT NULL DEFAULT 0,status INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0,1)),builtin INTEGER NOT NULL DEFAULT 0 CHECK(builtin IN (0,1)),created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS menus(id INTEGER PRIMARY KEY AUTOINCREMENT,parent_id INTEGER NOT NULL DEFAULT 0,name TEXT NOT NULL,path TEXT NOT NULL DEFAULT '',redirect TEXT NOT NULL DEFAULT '',component TEXT NOT NULL DEFAULT '',icon TEXT NOT NULL DEFAULT '',type TEXT NOT NULL DEFAULT 'menu' CHECK(type IN ('dir','menu','action')),permission TEXT NOT NULL DEFAULT '',sort INTEGER NOT NULL DEFAULT 0,visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),status INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0,1)),sys TEXT NOT NULL DEFAULT '',created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS role_menus(role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,PRIMARY KEY(role_id,menu_id));
CREATE TABLE IF NOT EXISTS sys_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,username TEXT NOT NULL DEFAULT '',user_name TEXT NOT NULL DEFAULT '',module TEXT NOT NULL DEFAULT '',action TEXT NOT NULL DEFAULT '',method TEXT NOT NULL DEFAULT '',url TEXT NOT NULL DEFAULT '',ip TEXT NOT NULL DEFAULT '',browser TEXT NOT NULL DEFAULT '',os TEXT NOT NULL DEFAULT '',status INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0,1)),message TEXT NOT NULL DEFAULT '',duration INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS idx_sys_logs_id ON sys_logs(id DESC);CREATE INDEX IF NOT EXISTS idx_role_menus_menu ON role_menus(menu_id);`);

  // 菜单归属子系统（白蚁上报 ant / 设备监测 device / 系统管理 system），旧库补充该列
  try { db.exec("ALTER TABLE menus ADD COLUMN sys TEXT NOT NULL DEFAULT ''"); } catch (e) { /* 列已存在 */ }

  if (!db.prepare("select value from meta where key='users_v2'").get()) {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) { /* 忽略 */ }
    const backup = dbFile + '.bak-' + Date.now();
    try { fs.copyFileSync(dbFile, backup); console.log('users 表升级前已备份数据库到：', backup); } catch (e) { console.warn('数据库备份失败，跳过：', e.message); }
    db.pragma('foreign_keys = OFF');
    try {
      db.exec('DROP TABLE IF EXISTS users_v2');
      db.exec(`CREATE TABLE users_v2(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL REFERENCES roles(code),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at TEXT DEFAULT (datetime('now','localtime')),phone TEXT,gender TEXT,avatar TEXT);`);
      const cols = db.pragma('table_info(users)').map(c => c.name).filter(c => ['id', 'username', 'password_hash', 'name', 'role', 'active', 'created_at', 'phone', 'gender', 'avatar'].includes(c));
      db.exec('INSERT INTO users_v2(' + cols.join(',') + ') SELECT ' + cols.join(',') + ' FROM users');
      const n = db.prepare('select count(*) n from users_v2').get().n;
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_v2 RENAME TO users');
      db.exec('CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id,id DESC)');
      db.prepare("insert into meta(key,value) values('users_v2',?)").run(String(n));
      console.log('users 表已升级（保留 ' + n + ' 个账号），自定义角色现已可用');
    } catch (e) { console.error('users 表升级失败，已保留原有结构：', e.message); }
    db.pragma('foreign_keys = ON');
  }
}

module.exports = { initCoreSchema, initSystemSchema };
