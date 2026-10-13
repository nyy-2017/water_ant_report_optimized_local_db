/**
 * 子系统（业务域）登记表。
 *
 * 平台拆分为三个子系统，后台菜单表 menus.sys 存的就是这里的 code：
 *   ant    白蚁上报系统
 *   device 设备监测系统
 *   system 系统管理
 * 菜单未标记子系统（sys 为空）时按路由前缀兜底推断；仍无法判断的菜单视为公共菜单，
 * 在所有子系统下都会显示。
 *
 * 成员可见的子系统由超级管理员在「系统管理 - 角色信息 - 分配菜单」中授权决定，
 * 前端只渲染被授权的菜单，因此也就只显示对应的子系统入口。
 */

/** 统一平台名称（登录页 / 侧栏 / 顶部标题共用） */
export const PLATFORM_NAME = '小蚁水利统一平台'

/** 「所有系统」入口（系统选择台）路由 */
export const PORTAL_PATH = '/portal'

export const SYSTEMS = [
  {
    code: 'ant',
    name: '白蚁上报系统',
    desc: '语音 / 治理 / 巡检业务上报',
    detail: '白蚁隐患上报、审核、派单处置与结果留档',
    icon: 'BugOutlined',
    color: '#20c7a5'
  },
  {
    code: 'device',
    name: '设备监测系统',
    desc: '物联网设备实时监测与告警',
    detail: '监测设备在线状态、采集数据与异常告警',
    icon: 'DesktopOutlined',
    color: '#3b9dff'
  },
  {
    code: 'system',
    name: '系统管理',
    desc: '用户 / 角色 / 菜单 / 日志',
    detail: '账号权限、菜单配置与操作审计',
    icon: 'SettingOutlined',
    color: '#faad14'
  }
]

export const SYSTEM_MAP = SYSTEMS.reduce((m, s) => ({ ...m, [s.code]: s }), {})

/** 路由前缀 → 子系统：菜单未配置 sys 时的兜底推断 */
const PATH_RULES = [
  ['/devices', 'device'],
  ['/dashboard', 'ant'],
  ['/reports', 'ant'],
  ['/system', 'system'],
  ['/logs', 'system']
]

export function sysOfPath(path = '') {
  const p = String(path || '')
  const hit = PATH_RULES.find(([prefix]) => p === prefix || p.startsWith(prefix + '/'))
  return hit ? hit[1] : ''
}

/** 取子系统登记信息，未知编码时回退为通用描述 */
export function systemMeta(code) {
  return SYSTEM_MAP[code] || { code, name: code || '未分类', desc: '', detail: '', icon: 'AppstoreOutlined', color: '#8c9ab2' }
}

/** 为菜单树补全 sys 字段（子菜单继承父菜单的子系统） */
export function decorateMenus(menus = [], inherited = '') {
  return menus.map((m) => {
    const sys = m.sys || sysOfPath(m.path) || inherited
    return { ...m, sys, children: m.children && m.children.length ? decorateMenus(m.children, sys) : m.children }
  })
}

/** 子系统内第一个可访问的页面，用于「进入」按钮的落地页 */
export function firstPathOfMenus(menus = []) {
  for (const m of menus) {
    if (m.children && m.children.length) {
      const p = firstPathOfMenus(m.children)
      if (p) return p
    }
    if (m.component && m.path) return m.path
  }
  return ''
}

/** 当前账号可进入的子系统列表（按登记表顺序，携带落地页） */
export function accessibleSystems(menus = []) {
  return SYSTEMS.filter((s) => menus.some((m) => m.sys === s.code)).map((s) => ({
    ...s,
    home: firstPathOfMenus(menus.filter((m) => m.sys === s.code))
  }))
}

/** 侧边栏：当前子系统下可见的顶级菜单（未归属子系统的菜单视为公共菜单，始终显示） */
export function menusOfSystem(menus = [], code = '') {
  if (!code) return menus
  return menus.filter((m) => !m.sys || m.sys === code)
}
