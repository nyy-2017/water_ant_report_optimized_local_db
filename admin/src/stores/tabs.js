import { defineStore } from 'pinia'

/**
 * 标签栏（tabview）页签状态。
 *
 * 之所以放在 store 而不是布局组件内部：
 * 「所有系统 /portal」是独立于后台布局的整页，返回它时 BasicLayout 已被卸载，
 * 组件内的局部状态无法再被清理，必须由全局（路由守卫）统一清空，
 * 否则再次进入子系统时会残留上一个系统的页签。
 */
export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabs: []
  }),
  getters: {
    has: (s) => (path) => s.tabs.some((t) => t.path === path),
    indexOf: (s) => (path) => s.tabs.findIndex((t) => t.path === path)
  },
  actions: {
    /** 追加页签，已存在则忽略 */
    push(tab) {
      if (tab && !this.has(tab.path)) this.tabs.push(tab)
    },
    /** 移除页签，返回其原来的下标 */
    remove(path) {
      const idx = this.indexOf(path)
      if (idx >= 0) this.tabs.splice(idx, 1)
      return idx
    },
    /** 只保留符合条件的页签 */
    keepWhere(fn) {
      this.tabs = this.tabs.filter(fn)
    },
    /** 清空全部页签 */
    reset() {
      this.tabs = []
    }
  }
})
