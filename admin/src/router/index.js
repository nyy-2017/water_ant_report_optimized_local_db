import { createRouter, createWebHashHistory } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'
import { useUserStore } from '@/stores/user'
import { useTabsStore } from '@/stores/tabs'
import { PORTAL_PATH, sysOfPath } from '@/utils/systems'

/**
 * 后端 menus 表的 component 字段与这里一一对应。
 * 在「菜单信息」里新增菜单时，component 必须填写下方已有的键，否则该菜单不会被注册成路由。
 */
export const viewMap = {
  'dashboard/index': () => import('@/views/dashboard/index.vue'),
  'reports/index': () => import('@/views/reports/index.vue'),
  'device/index': () => import('@/views/device/index.vue'),
  'system/users': () => import('@/views/system/users.vue'),
  'system/roles': () => import('@/views/system/roles.vue'),
  'system/menus': () => import('@/views/system/menus.vue'),
  'system/logs': () => import('@/views/system/logs.vue')
}

/**
 * 二级菜单的页面预设条件：key 为菜单 path，会挂到路由 meta.preset 上，
 * 页面（工单列表 / 日志列表）据此初始化筛选条件与标题。
 */
const MENU_PRESETS = {
  '/reports/audit': { status: '待审核' },
  '/logs/login': { module: '登录认证' }
}

const constantRoutes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录' }
  },
  // 登录成功后的落地页：展示当前账号可进入的子系统入口。
  // 与登录页同级，是独立整页（自带顶栏与退出登录），不进入后台布局。
  {
    path: PORTAL_PATH,
    name: 'portal',
    component: () => import('@/views/portal/index.vue'),
    meta: { title: '所有系统' }
  },
  {
    path: '/',
    name: 'Layout',
    component: BasicLayout,
    redirect: PORTAL_PATH,
    children: [
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人中心', hidden: true }
      },
      {
        path: '403',
        name: '403',
        component: () => import('@/views/exception/403.vue'),
        meta: { title: '无访问权限', hidden: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/exception/404.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes,
  scrollBehavior: () => ({ top: 0 })
})

/** 取出菜单树中所有叶子节点，并记录父级名称用于面包屑 */
function collectLeaf(menus, parents = []) {
  const out = []
  for (const m of menus) {
    const chain = [...parents, m.name]
    if (m.children && m.children.length) out.push(...collectLeaf(m.children, chain))
    else out.push({ menu: m, parents: chain })
  }
  return out
}

/** 第一个可访问的路由，用于登录后落地页 */
export function firstPath(menus) {
  for (const m of menus) {
    if (m.children && m.children.length) {
      const p = firstPath(m.children)
      if (p) return p
    }
    if (viewMap[m.component]) return m.path
  }
  return ''
}

/** 依据后端返回的菜单树动态注册路由，实现「菜单信息」改动即刻生效 */
export function buildDynamicRoutes(menus) {
  const target = firstPath(menus)
  collectLeaf(menus).forEach(({ menu, parents }) => {
    const component = viewMap[menu.component]
    if (!component) return
    const name = menu.path
    if (router.hasRoute(name)) return
    router.addRoute('Layout', {
      path: menu.path.replace(/^\//, ''),
      name,
      component,
      meta: {
        title: menu.name,
        icon: menu.icon,
        parents,
        permission: menu.permission,
        // 菜单未标注子系统时按路由前缀兜底，供侧边栏按子系统过滤
        sys: menu.sys || sysOfPath(menu.path),
        preset: MENU_PRESETS[menu.path]
      }
    })
  })
  return target
}

const WHITE_LIST = ['/login']

router.beforeEach(async (to) => {
  const user = useUserStore()

  if (!user.token) {
    return WHITE_LIST.includes(to.path) ? true : { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  // 已登录时访问登录页，直接回到系统入口
  if (to.path === '/login') return { path: PORTAL_PATH }

  if (!user.loaded) {
    try {
      await user.loadProfile()
    } catch (e) {
      user.resetAll()
      return { path: '/login' }
    }
    buildDynamicRoutes(user.menus)
    // 登录成功后的落地页：所有系统（系统入口）
    if (to.path === '/') return { path: PORTAL_PATH, replace: true }
    return { path: to.fullPath, replace: true }
  }

  if (to.name === 'not-found') return true

  // 路由级权限校验：菜单未授权时拒绝进入
  const required = to.meta?.permission
  if (required && user.info?.role !== 'admin') {
    const codes = String(required).split(',').map((c) => c.trim()).filter(Boolean)
    if (codes.length && !codes.some((c) => user.permissions.includes(c))) return { path: '/403', replace: true }
  }
  return true
})

/**
 * 离开后台布局时清空标签栏全部页签，包含固定的「首页」：
 *  - 回到「所有系统」入口（切换系统模块）：避免上一个子系统的页签残留到下一个子系统；
 *  - 进入登录页（退出登录 / 登录态失效）：避免换账号后仍看到上一个账号的页签。
 */
router.afterEach((to) => {
  if (to.path === PORTAL_PATH || to.path === '/login') useTabsStore().reset()
})

export default router
