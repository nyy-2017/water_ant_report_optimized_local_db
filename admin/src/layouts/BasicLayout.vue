<template>
  <a-layout class="wa-layout">
    <a-layout-sider
      v-model:collapsed="collapsed"
      :width="222"
      :trigger="null"
      collapsible
      theme="dark"
      class="wa-sider"
    >
      <div class="wa-brand">
        <div class="wa-logo"><ClusterOutlined /></div>
        <div v-show="!collapsed" class="wa-brand-text">
          <strong>{{ brandTitle }}</strong>
          <small>{{ brandSub }}</small>
        </div>
      </div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        v-model:openKeys="openKeys"
        theme="dark"
        mode="inline"
        :items="menuItems"
        @click="onSelect"
      />
    </a-layout-sider>

    <a-layout class="wa-body">
      <a-layout-header class="wa-header">
        <component
          :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined"
          class="wa-trigger"
          @click="collapsed = !collapsed"
        />
        <a-breadcrumb class="wa-crumb" :items="crumbs" />
        <div class="wa-flex" />
        <a-tooltip title="返回系统入口，可切换其他系统">
          <div class="wa-sys-switch" @click="goPortal">
            <AppstoreOutlined />
            <span>所有系统</span>
          </div>
        </a-tooltip>
        <a-tooltip title="刷新当前页">
          <ReloadOutlined class="wa-icon-btn" @click="refresh" />
        </a-tooltip>
        <a-tooltip v-if="hasDashboard" :title="realtime ? '已开启自动刷新（60 秒）' : '未开启自动刷新'">
          <SyncOutlined class="wa-icon-btn" :class="{ 'wa-spin': ticking }" />
        </a-tooltip>
        <a-dropdown placement="bottomRight">
          <div class="wa-user">
            <a-avatar :size="30" :style="{ background: '#20c7a5', color: '#06231d' }">
              {{ user.info?.name?.slice(0, 1) || 'U' }}
            </a-avatar>
            <span class="wa-user-name">{{ user.info?.name }}</span>
            <a-tag color="cyan" bordered> {{ user.roleName }} </a-tag>
          </div>
          <template #overlay>
            <a-menu @click="onUserMenu">
              <a-menu-item key="profile"><UserOutlined /> 个人中心</a-menu-item>
              <a-menu-item key="password"><KeyOutlined /> 修改密码</a-menu-item>
              <a-menu-divider />
              <a-menu-item key="logout"><LogoutOutlined /> 退出登录</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-layout-header>

      <!-- 已访问页面标签栏：左侧菜单打开过的页面（含当前选中菜单），最后一个标签不可关闭 -->
      <div class="wa-tabs">
        <div ref="tabScrollRef" class="wa-tabs-scroll" @contextmenu.prevent>
          <div
            v-for="tab in tabs"
            :key="tab.path"
            class="wa-tab"
            :class="{ 'wa-tab-active': tab.path === route.path }"
            :title="tab.title"
            @click="switchTab(tab)"
            @contextmenu.prevent="openTabMenu($event, tab)"
          >
            <component :is="resolveIcon(tab.icon)" v-if="tab.icon" class="wa-tab-icon" />
            <span class="wa-tab-text">{{ tab.title }}</span>
            <CloseOutlined v-if="canClose(tab)" class="wa-tab-close" @click.stop="closeTab(tab)" />
          </div>
        </div>
      </div>

      <!-- 右键菜单：挂到 body，避免被布局的 overflow 裁剪；mousedown 阻止冒泡，防止菜单项被提前卸载 -->
      <Teleport to="body">
        <div
          v-if="ctxTab"
          class="wa-tab-menu"
          :style="ctxStyle"
          @mousedown.stop
          @click.stop
          @contextmenu.prevent
        >
          <div class="wa-tab-menu-item" @click="onTabMenu('refresh')">刷新当前页签</div>
          <div
            class="wa-tab-menu-item"
            :class="{ 'wa-tab-menu-disabled': !canClose(ctxTab) }"
            @click="onTabMenu('close')"
          >
            关闭当前页签
          </div>
          <div class="wa-tab-menu-item" @click="onTabMenu('closeOthers')">关闭其他页签</div>
        </div>
      </Teleport>

      <a-layout-content class="wa-content">
        <router-view v-slot="{ Component, route }">
          <component :is="Component" :key="String(route.name) + '-' + viewKey" />
        </router-view>
      </a-layout-content>
    </a-layout>

    <a-modal v-model:open="pwdOpen" title="修改登录密码" :confirm-loading="pwdLoading" ok-text="确认修改" @ok="submitPassword">
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="当前密码" v-bind="pwdErrors.password">
          <a-input-password v-model:value="pwdForm.password" placeholder="请输入当前密码" />
        </a-form-item>
        <a-form-item label="新密码" v-bind="pwdErrors.newPassword">
          <a-input-password v-model:value="pwdForm.newPassword" placeholder="至少 6 位" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-layout>
</template>

<script setup>
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  CloseOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  ReloadOutlined,
  SyncOutlined,
  UserOutlined,
  KeyOutlined,
  LogoutOutlined,
  ClusterOutlined,
  AppstoreOutlined
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { useTabsStore } from '@/stores/tabs'
import { userApi } from '@/api'
import { getIcon } from '@/utils/icons'
import { PLATFORM_NAME, PORTAL_PATH, menusOfSystem, systemMeta } from '@/utils/systems'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const collapsed = ref(false)
const viewKey = ref(0)
const realtime = ref(true)
const ticking = ref(false)

/** 是否拥有首页（/dashboard）菜单权限且路由已注册：无权限时隐藏顶栏的自动刷新指示 */
const hasDashboard = computed(() => {
  const hasLeaf = (list) =>
    (list || []).some((m) => (m.children && m.children.length ? hasLeaf(m.children) : m.path === '/dashboard'))
  return hasLeaf(user.sysMenus) && router.hasRoute('/dashboard')
})

/** 最近一次进入的子系统，用于个人中心等非菜单页面延续侧栏上下文 */
const lastSys = ref('')

/** 当前所在子系统：取菜单树顶层节点的 sys，非菜单页面沿用上次进入的子系统 */
const activeSys = computed(() => {
  const chain = findChain(user.sysMenus, route.path)
  const sys = chain && chain.length ? chain[0].sys || '' : ''
  return sys || lastSys.value
})

watch(activeSys, (v) => {
  if (v && v !== lastSys.value) lastSys.value = v
})

const activeSystem = computed(() => (activeSys.value ? systemMeta(activeSys.value) : null))

/** 侧栏品牌：进入子系统后显示子系统名 + 平台名 */
const brandTitle = computed(() => activeSystem.value?.name || PLATFORM_NAME)
const brandSub = computed(() => (activeSystem.value ? PLATFORM_NAME : '管理后台'))

/** 只渲染当前子系统（含公共菜单）的菜单，从而按授权范围限制可见模块 */
const visibleMenus = computed(() => menusOfSystem(user.sysMenus, activeSys.value))

const toMenuItem = (m) => {
  const item = {
    key: m.path,
    label: m.name,
    icon: m.icon ? () => h(resolveIcon(m.icon)) : undefined
  }
  const children = (m.children || []).map((c) => ({
    key: c.path,
    label: c.name,
    icon: c.icon ? () => h(resolveIcon(c.icon)) : undefined
  }))
  if (children.length) item.children = children
  return item
}

/**
 * 侧边栏菜单项：只渲染当前所属子系统的菜单，目录（有二级菜单）带 children，
 * 叶子菜单不写 children，否则 ant-design-vue 会把它渲染成「空的二级菜单」，点击没有反应。
 */
const menuItems = computed(() => visibleMenus.value.map(toMenuItem))

const selectedKeys = ref([route.path])
const openKeys = ref([])

function findChain(list, path, chain = []) {
  for (const m of list) {
    const next = [...chain, m]
    if (m.path === path) return next
    if (m.children && m.children.length) {
      const hit = findChain(m.children, path, next)
      if (hit) return hit
    }
  }
  return null
}

const crumbs = computed(() => {
  const chain = findChain(user.sysMenus, route.path)
  const titles = chain ? chain.map((c) => c.name) : []
  if (!titles.length && route.meta?.title) titles.push(route.meta.title)
  // 面包屑首项补上子系统名称，明确当前所在系统
  if (activeSystem.value && !titles.includes(activeSystem.value.name)) titles.unshift(activeSystem.value.name)
  return titles.map((title) => ({ title }))
})

watch(
  () => route.path,
  (path) => {
    selectedKeys.value = [path]
    const chain = findChain(user.sysMenus, path) || []
    const parent = chain.length > 1 ? chain[0].path : ''
    if (parent && !openKeys.value.includes(parent)) openKeys.value = [...openKeys.value, parent]
  },
  { immediate: true }
)

/** 返回系统入口（登录成功后的页面） */
function goPortal() {
  router.push(PORTAL_PATH)
}

/** 菜单图标：按后端存储的图标名从登记表中取组件 */
function resolveIcon(name) {
  return getIcon(name)
}

function onSelect({ key }) {
  // 只有已注册成路由的菜单（二级菜单/首页等叶子）才能跳转，目录不会误跳
  if (key !== route.path && router.hasRoute(key)) router.push(key)
}

function refresh() {
  viewKey.value += 1
}

/* ---------- 标签路由（tabview）---------- */
/**
 * 页签 = 左侧菜单里打开过的页面（含当前选中菜单），不做任何「固定标签」特判。
 * 唯一限制：最后一个页签不允许关闭，保证标签栏始终至少有一个入口。
 */
const tabScrollRef = ref(null)
/** 页签存于全局 store：返回系统入口时由路由守卫统一清空 */
const tabsStore = useTabsStore()
const tabs = computed(() => tabsStore.tabs)

/** 依据路由 meta 生成标签，未注册（含未授权）的路由不生成 */
function makeTab(path) {
  const resolved = router.resolve(path)
  const meta = resolved.meta || {}
  if (!meta.title || resolved.name === 'not-found') return null
  return {
    path,
    title: meta.title,
    icon: meta.icon || '',
    closable: true
  }
}

/** 最后一个页签不允许关闭 */
function canClose(tab) {
  return tab.closable && tabsStore.tabs.length > 1
}

function scrollToActive() {
  nextTick(() => {
    tabScrollRef.value?.querySelector('.wa-tab-active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

watch(
  () => route.path,
  (path) => {
    // 登录页、404、隐藏页（个人中心 / 403）不进标签栏
    if (path === '/login' || route.name === 'not-found' || route.meta?.hidden) return
    // 当前选中的菜单（左侧菜单页面）进入标签栏
    tabsStore.push(makeTab(path))
    scrollToActive()
  },
  { immediate: true }
)

function switchTab(tab) {
  if (tab.path !== route.path) router.push(tab.path)
}

function closeTab(tab) {
  // 最后一个页签不允许关闭
  if (!canClose(tab)) return
  const idx = tabsStore.remove(tab.path)
  if (idx < 0) return
  // 关闭的是当前页时跳到相邻标签
  if (route.path === tab.path) {
    const next = tabs.value[idx] || tabs.value[idx - 1]
    if (next) router.push(next.path)
  }
}

function resetTabs() {
  tabsStore.reset()
}

/* ---------- 标签右键菜单 ---------- */
const MENU_WIDTH = 148
const MENU_HEIGHT = 116

/** 当前被右键的标签，为空表示菜单未显示 */
const ctxTab = ref(null)
const ctxPos = ref({ x: 0, y: 0 })

const ctxStyle = computed(() => ({ left: `${ctxPos.value.x}px`, top: `${ctxPos.value.y}px` }))

function openTabMenu(e, tab) {
  // 贴边时向左/向上收拢，避免菜单溢出视口
  ctxPos.value = {
    x: Math.max(4, Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8)),
    y: Math.max(4, Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8))
  }
  ctxTab.value = tab
}

function closeTabMenu() {
  ctxTab.value = null
}

function onTabMenu(key) {
  const tab = ctxTab.value
  closeTabMenu()
  if (!tab) return
  if (key === 'refresh') {
    if (route.path !== tab.path) router.push(tab.path)
    refresh()
  } else if (key === 'close') {
    closeTab(tab)
  } else {
    // 只保留当前右键的标签，其余关闭（关闭其他不受「最后一个」限制，因为至少留一个）
    tabsStore.keepWhere((t) => t.path === tab.path)
    if (!tabsStore.has(route.path)) router.push(tab.path)
  }
}

function onDocPointerDown() {
  if (ctxTab.value) closeTabMenu()
}
function onKeydown(e) {
  if (e.key === 'Escape') closeTabMenu()
}

/* ---------- 退出 / 个人中心 / 改密 ---------- */
const pwdOpen = ref(false)
const pwdLoading = ref(false)
const pwdForm = ref({ password: '', newPassword: '' })
const pwdErrors = ref({ password: {}, newPassword: {} })

function onUserMenu({ key }) {
  if (key === 'logout') {
    Modal.confirm({
      title: '确认退出登录？',
      content: '退出后需要重新输入账号密码。',
      okText: '退出',
      cancelText: '取消',
      onOk: async () => {
        await user.logout()
        resetTabs()
        router.replace('/login')
      }
    })
  } else if (key === 'profile') {
    router.push('/profile')
  } else {
    pwdForm.value = { password: '', newPassword: '' }
    pwdErrors.value = { password: {}, newPassword: {} }
    pwdOpen.value = true
  }
}

async function submitPassword() {
  pwdErrors.value = { password: {}, newPassword: {} }
  if (!pwdForm.value.password) {
    pwdErrors.value.password = { validateStatus: 'error', help: '请输入当前密码' }
    return
  }
  if ((pwdForm.value.newPassword || '').length < 6) {
    pwdErrors.value.newPassword = { validateStatus: 'error', help: '新密码至少 6 位' }
    return
  }
  const id = user.info?.id
  if (!id) return
  pwdLoading.value = true
  try {
    await userApi.resetPassword(id, pwdForm.value.newPassword)
    message.success('密码已修改，请牢记新密码')
    pwdOpen.value = false
  } catch (e) {
    message.error(e.message)
  } finally {
    pwdLoading.value = false
  }
}

/* ---------- 自动刷新 & 自适应 ---------- */
let timer = null
function startTimer() {
  stopTimer()
  if (!realtime.value) return
  timer = setInterval(() => {
    ticking.value = true
    window.dispatchEvent(new CustomEvent('wa-realtime-tick'))
    setTimeout(() => (ticking.value = false), 900)
  }, 60000)
}
function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function onResize() {
  collapsed.value = window.innerWidth < 1000
}

onMounted(() => {
  onResize()
  window.addEventListener('resize', onResize)
  window.addEventListener('mousedown', onDocPointerDown)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onDocPointerDown, true)
  startTimer()
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousedown', onDocPointerDown)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onDocPointerDown, true)
  stopTimer()
})
</script>

<style scoped>
.wa-layout {
  height: 100vh;
  overflow: hidden;
  background: var(--wa-bg);
}

/* 右侧主体：纵向排列（顶栏固定 + 内容区滚动） */
.wa-body {
  height: 100vh;
  min-width: 0;
}

.wa-sider {
  height: 100vh;
  background: var(--wa-sider);
  border-right: 1px solid var(--wa-border);
}

/* 侧栏内部：品牌区固定，菜单区独立滚动 */
.wa-sider :deep(.ant-layout-sider-children) {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.wa-sider :deep(.ant-menu) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.wa-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid var(--wa-border);
  overflow: hidden;
  white-space: nowrap;
}

.wa-logo {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #20c7a5, #178cba);
  color: #06231d;
  font-size: 17px;
  flex-shrink: 0;
}

.wa-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.wa-brand-text strong {
  color: var(--wa-text);
  font-size: 15px;
}

.wa-brand-text small {
  color: var(--wa-muted);
  font-size: 11px;
}

.wa-header {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 0 0 56px;
  height: 56px;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--wa-sider) !important;
  border-bottom: 1px solid var(--wa-border);
}

.wa-flex {
  flex: 1;
}

.wa-trigger,
.wa-icon-btn {
  font-size: 16px;
  color: var(--wa-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
}

.wa-trigger:hover,
.wa-icon-btn:hover {
  color: var(--wa-primary);
  background: rgba(32, 199, 165, 0.12);
}

/* ---------- 「所有系统」入口 ---------- */
.wa-sys-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--wa-border);
  border-radius: 16px;
  color: var(--wa-muted);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.wa-sys-switch:hover {
  color: var(--wa-primary);
  border-color: rgba(32, 199, 165, 0.55);
  background: rgba(32, 199, 165, 0.1);
}

.wa-spin {
  animation: wa-spin 1s linear infinite;
}

@keyframes wa-spin {
  to {
    transform: rotate(360deg);
  }
}

.wa-user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
}

.wa-user:hover {
  background: rgba(255, 255, 255, 0.05);
}

.wa-user-name {
  color: var(--wa-text);
  font-weight: 500;
}

/* ---------- 标签路由（tabview）---------- */
.wa-tabs {
  display: flex;
  align-items: center;
  flex: 0 0 44px;
  height: 44px;
  padding: 0 8px;
  background: var(--wa-sider);
  border-bottom: 1px solid var(--wa-border);
}

.wa-tabs-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 7px 2px;
  overflow-x: auto;
  overflow-y: hidden;
}

.wa-tabs-scroll::-webkit-scrollbar {
  height: 4px;
}

.wa-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--wa-border);
  border-radius: 6px;
  color: var(--wa-muted);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.wa-tab:hover {
  color: var(--wa-text);
  border-color: #33507d;
  background: rgba(255, 255, 255, 0.04);
}

.wa-tab-active,
.wa-tab-active:hover {
  color: #06231d;
  font-weight: 600;
  background: var(--wa-primary);
  border-color: var(--wa-primary);
}

.wa-tab-icon {
  font-size: 13px;
}

.wa-tab-close {
  font-size: 11px;
  padding: 2px;
  border-radius: 50%;
  opacity: 0.6;
  transition: all 0.15s;
}

.wa-tab-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.3);
}

/* ---------- 标签右键菜单 ---------- */
.wa-tab-menu {
  position: fixed;
  z-index: 1050;
  min-width: 148px;
  padding: 4px;
  background: #16253c;
  border: 1px solid var(--wa-border);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
}

.wa-tab-menu-item {
  padding: 7px 12px;
  color: var(--wa-text);
  font-size: 13px;
  white-space: nowrap;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.wa-tab-menu-item:hover {
  color: var(--wa-primary);
  background: rgba(32, 199, 165, 0.12);
}

.wa-tab-menu-disabled {
  color: var(--wa-muted);
  opacity: 0.5;
  cursor: not-allowed;
}

.wa-tab-menu-disabled:hover {
  color: var(--wa-muted);
  background: transparent;
}

.wa-content {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.wa-crumb {
  color: var(--wa-muted);
}

@media (max-width: 700px) {
  .wa-crumb,
  .wa-user-name {
    display: none;
  }
}
</style>
