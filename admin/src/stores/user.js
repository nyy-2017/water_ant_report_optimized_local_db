import { defineStore } from 'pinia'
import { authApi, roleApi } from '@/api'
import { getToken, setToken, getLocalUser, setLocalUser, clearAuth } from '@/utils/auth'
import { decorateMenus, accessibleSystems } from '@/utils/systems'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    info: getLocalUser() || null,
    menus: [],
    permissions: [],
    roles: [],
    loaded: false
  }),
  getters: {
    logged: (s) => !!s.token,
    isAdmin: (s) => s.info?.role === 'admin',
    /** 角色名称：优先取角色列表（管理员），其次登录接口返回的 role_name，最后回退角色标识 */
    roleName: (s) => {
      const hit = s.roles.find((r) => r.code === s.info?.role)
      return (hit && hit.name) || s.info?.role_name || s.info?.role || ''
    },
    hasPerm: (s) => (code) => !!s.info && (s.info.role === 'admin' || s.permissions.includes(code)),
    /** 菜单树补全子系统归属，供侧边栏与系统入口页使用 */
    sysMenus: (s) => decorateMenus(s.menus),
    /** 当前账号有权进入的子系统（超级管理员默认拥有全部子系统） */
    systems() {
      return accessibleSystems(this.sysMenus)
    }
  },
  actions: {
    async login(payload) {
      const res = await authApi.login(payload)
      this.token = res.token
      setToken(res.token)
      this.info = res.user
      setLocalUser(res.user)
      return res.user
    },
    /** 登录成功后拉取个人信息、可见菜单与权限点 */
    async loadProfile() {
      try {
        const me = await authApi.me()
        this.info = { ...this.info, ...me.user }
        setLocalUser(this.info)
      } catch {
        /* 忽略：仍以登录时返回的信息为准 */
      }
      const { items, permissions } = await authApi.menus()
      this.menus = items
      this.permissions = permissions || []
      if (this.info?.role === 'admin') {
        try {
          this.roles = (await roleApi.list()).items
        } catch {
          this.roles = []
        }
      }
      this.loaded = true
    },
    async refreshRoles() {
      if (this.isAdmin) this.roles = (await roleApi.list()).items
    },
    async logout(silent = false) {
      if (!silent && this.token) {
        try {
          await authApi.logout()
        } catch {
          /* 忽略退出接口异常 */
        }
      }
      this.resetAll()
    },
    resetAll() {
      this.token = ''
      this.info = null
      this.menus = []
      this.permissions = []
      this.roles = []
      this.loaded = false
      clearAuth()
    }
  }
})
