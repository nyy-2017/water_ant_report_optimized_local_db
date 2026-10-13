# 小蚁水利统一平台（本地数据库优化版）

## 功能
- 微信小程序：白蚁隐患上报、现场照片上传（最多6张）、地图选点、本人上报记录和详情。
- 管理后台（Vue3 + Ant Design Vue + Vite）：平台按业务域拆分为三个子系统，登录成功后先进入「所有系统」入口页，再选择系统进入对应工作台。
  - 白蚁上报系统：首页数据大屏（核心指标卡片 + 工单趋势 / 状态分布 / 类型分布 / 高发位置 / 人员角色等图表模块，每 60 秒自动刷新）、隐患工单审核 / 驳回、派单、处理结果录入与流转记录。
  - 设备监测系统：物联网监测设备实时状态与告警（当前为预留模块，等待接入数据源）。
  - 系统管理：用户信息增删改查与启停、重置密码；角色信息增删改与菜单（子系统）授权；菜单信息的创建 / 修改 / 删除（含目录、菜单、按钮权限点与所属系统）；操作日志（记录登录、系统配置与工单处置等关键操作，含账号、时间、来源 IP、浏览器与操作系统，支持筛选、导出与清理）。
- Node.js API：SQLite 本地持久化、JWT 登录、密码 bcrypt 哈希、角色与菜单权限校验、请求限流、Helmet 安全头、操作日志采集。

## 子系统与权限
- 平台分三个子系统（菜单表 `menus.sys` 字段）：`ant` 白蚁上报系统、`device` 设备监测系统、`system` 系统管理；`sys` 为空的菜单属于公共菜单，所有子系统下都会显示。
- `admin`（系统管理员）默认拥有全部子系统；其他账号只能看到所属角色被授权的菜单，因此前端只渲染已授权子系统对应的系统入口与左侧菜单。
- 授权入口：系统管理 - 角色信息 - 「分配菜单」，抽屉内按子系统分组，可「全选本系统」整组开通；授权变更后成员重新登录即生效。
- 后端接口使用同一套权限点鉴权（`requirePerm`，与前端 `hasPerm` 同源，来源是角色已授权菜单的 `permission` 字段），因此自定义角色（如 `workers`）被授权后即可正常调用对应接口；只有个别必须绑定内置角色的场景才使用 `requireRole`。
- 权限粒度可通过「菜单信息」调整：把菜单的 `permission` 拆成多个按钮型（type=action）子菜单，就能只授予「查看」而不授予「审核 / 派单 / 处置」。
- 顶部导航的「所有系统」按钮随时返回系统入口页（`/portal`）。该页与登录页同级，是独立整页（自带顶栏、当前账号与退出登录），不进入后台布局，因此没有侧栏与页签。

## 本地数据库说明
- 数据库文件默认在 `backend/data/water-ant.sqlite`，项目已附带一个初始化的空 SQLite 数据库。
- 首次启动会自动检查/创建表和索引；数据表包括 `users`（账号）、`roles`（角色）、`menus`（菜单，含 `sys` 子系统归属）、`role_menus`（角色菜单授权）、`reports`（工单）、`events`（工单流转）、`sys_logs`（操作日志）、`meta`（系统标记）。
- 首次启动会写入 4 个内置角色（`admin` / `dispatcher` / `reviewer` / `reporter`）、默认菜单树与角色菜单授权，可在「系统管理」中继续维护。
- 若数据库来自旧版本，启动时会自动补充 `menus.sys` 列并补建「设备监测系统」菜单（子系统划分只执行一次）；`users` 表的 `role` 字段也会从固定枚举升级为外键引用 `roles.code`，升级前会把数据库复制为 `water-ant.sqlite.bak-<时间戳>` 备份在同目录。
- 上传照片保存在 `backend/uploads/`，数据库保存照片 URL；数据库备份时也要备份该目录。
- 可用 `DB_PATH` 改变数据库路径（相对路径以 `backend/` 为基准）。
- 备份时建议先停止服务，再复制 `backend/data/water-ant.sqlite` 和 `backend/uploads/`。

## 启动步骤（Windows）
1. 安装 Node.js 20+。
2. 打开终端，进入 `backend` 目录。
3. 安装依赖：`npm install`。
4. 复制 `.env.example` 为 `.env`，修改 `JWT_SECRET` 和 `ADMIN_PASSWORD`。管理员密码至少6位（后台新建账号的初始密码同样至少6位），务必不要使用示例密码。
5. 启动：`npm start`。首次启动时，若数据库中还没有用户且配置了 `ADMIN_USERNAME`、`ADMIN_PASSWORD`，会创建管理员账号。
6. 启动管理后台：进入 `admin` 目录，依次执行 `npm install`、`npm run dev`，浏览器访问 `http://localhost:8080`，使用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。
   - 开发端口为 8080，`vite.config.js` 已配置 `/api` 与 `/uploads` 反向代理到 `http://localhost:3030`（可用环境变量 `VITE_BACKEND` 覆盖），因此开发期无需额外配置 CORS。
   - 生产构建：`npm run build`，产物在 `admin/dist`，交由 Nginx 等静态服务器托管；若与 API 不同源，需把静态站点域名加入后端 `CORS_ORIGIN`，或用环境变量 `VITE_API_BASE` 指定完整的 API 地址后重新构建。
7. 微信开发者工具导入 `miniprogram/`，把 `miniprogram/app.js` 的 `apiBase` 改为本机/服务器 API 地址。真机测试需配置 HTTPS 合法域名。

## 管理后台目录结构
```
admin/
├─ index.html          入口 HTML
├─ vite.config.js      Vite 配置（别名、代理、分包）
├─ src/
│  ├─ main.js          应用入口
│  ├─ App.vue          暗色主题与中文语言包
│  ├─ api/             接口封装（request.js 统一鉴权与错误提示）
│  ├─ stores/user.js   登录态、菜单、权限点、可进入的子系统
│  ├─ router/          静态路由 + 由后端菜单动态注册路由（meta.sys 标记所属子系统）
│  ├─ layouts/         后台整体布局（侧栏按子系统过滤、「所有系统」入口）
│  ├─ components/      通用组件（EChart）
│  ├─ utils/           子系统登记表（systems.js）、图标注册、鉴权、工单状态、ECharts 主题
│  └─ views/           login / portal(系统入口) / dashboard / reports / device / system(users|roles|menus|logs) / profile
└─ legacy/             旧版原生静态后台（已归档，可删除）
```

## 角色
- `reporter`：提交隐患、查看本人记录。
- `reviewer`：审核、驳回上报。
- `dispatcher`：派单、填写处理结果、查看工单和用户列表。
- `servers`：上门服务人员，查看工单列表并录入现场处置结果（可由派单环节指派）。
- `admin`：系统管理（用户 / 角色 / 菜单 / 日志）与全部工单。
- 以上 5 个为内置角色（不可删除），定义在 `backend/src/db/seed.js` 的 `BUILTIN_ROLES` 中；老库启动时由 `migrateBuiltinRoles` 自动补齐缺失的内置角色。
- 可在「系统管理 - 角色信息」中新增自定义角色并分配菜单，从而控制成员可见的菜单、可进入的子系统与可执行的操作。
- 子系统可见范围 = 该角色已授权菜单所属子系统；`admin` 不受菜单授权限制，始终可见全部子系统。

## 重要说明
本项目是可运行的开发示例，不是已部署的生产系统。小程序真机需部署 HTTPS 服务；生产环境还应完善图片鉴权/私有存储、工单指派范围限制、统一身份认证、备份恢复、审计和安全测试。SQLite 适合本地和小规模使用，若多人高并发正式使用，建议迁移到受管数据库。
