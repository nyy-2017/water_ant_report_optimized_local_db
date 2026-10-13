<template>
  <div class="portal-page">
    <div class="portal-bg" />

    <div class="portal-inner">
      <!-- 顶栏：平台标识 + 当前账号 + 退出登录 -->
      <header class="portal-top">
        <div class="top-brand">
          <div class="top-logo"><ClusterOutlined /></div>
          <span class="top-name">{{ PLATFORM_NAME }}</span>
        </div>
        <div class="top-right">
          <div class="top-user">
            <a-avatar :size="26" :style="{ background: '#20c7a5', color: '#06231d' }">
              {{ user.info?.name?.slice(0, 1) || 'U' }}
            </a-avatar>
            <span class="top-user-name">{{ user.info?.name }}</span>
            <a-tag color="cyan" bordered>{{ user.roleName }}</a-tag>
          </div>
          <a-button size="small" @click="logout">退出登录</a-button>
        </div>
      </header>

      <!-- 欢迎条 -->
      <section class="hero">
        <div class="hero-text">
          <p class="hero-hi">{{ greeting }}</p>
          <h2 class="hero-title">
            {{ user.info?.name || '用户' }}
            <em>【{{ user.roleName }}】</em>
          </h2>
          <p class="hero-sub">欢迎使用{{ PLATFORM_NAME }} · 选择下方系统进入对应工作台</p>
        </div>
        <div class="hero-art"><ClusterOutlined /></div>
      </section>

      <!-- 系统入口 -->
      <section class="entry-panel">
        <header class="entry-head">
          <span class="entry-bar" />
          <span class="entry-title">系统入口</span>
          <span class="entry-count">共 {{ systems.length }} 个可用系统</span>
        </header>

        <div v-if="systems.length" class="sys-grid">
          <div v-for="s in systems" :key="s.code" class="sys-card" :style="{ '--sys': s.color }" @click="enter(s)">
            <div class="sys-icon"><component :is="resolveIcon(s.icon)" /></div>
            <div class="sys-info">
              <div class="sys-name">{{ s.name }}</div>
              <div class="sys-desc">{{ s.desc }}</div>
              <div class="sys-detail">{{ s.detail }}</div>
            </div>
            <div class="sys-enter">进入 <ArrowRightOutlined /></div>
          </div>
        </div>
        <a-empty v-else description="当前账号尚未分配任何系统，请联系超级管理员" />
      </section>

      <p class="portal-tip">
        <InfoCircleOutlined />
        系统范围由超级管理员在「系统管理 - 角色信息 - 分配菜单」中配置，授权变更后重新登录即可看到最新系统模块。
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import { ArrowRightOutlined, ClusterOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { PLATFORM_NAME } from '@/utils/systems'
import { getIcon } from '@/utils/icons'

const router = useRouter()
const user = useUserStore()

const systems = computed(() => user.systems)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '凌晨好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const resolveIcon = (name) => getIcon(name)

function enter(sys) {
  if (!sys.home) {
    message.warning(`${sys.name} 暂未配置可访问页面，请联系超级管理员`)
    return
  }
  router.push(sys.home)
}

function logout() {
  Modal.confirm({
    title: '确认退出登录？',
    content: '退出后需要重新输入账号密码。',
    okText: '退出',
    cancelText: '取消',
    onOk: async () => {
      await user.logout()
      router.replace('/login')
    }
  })
}
</script>

<style scoped>
.portal-page {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
}

.portal-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(1100px 520px at 12% 8%, rgba(32, 199, 165, 0.14), transparent 60%),
    radial-gradient(900px 480px at 88% 86%, rgba(23, 140, 186, 0.16), transparent 62%),
    #0b1220;
}

.portal-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 50% 26%, #000 34%, transparent 76%);
}

.portal-inner {
  position: relative;
  max-width: 1120px;
  margin: 0 auto;
  padding: 22px 20px 40px;
}

/* ---------- 顶栏 ---------- */
.portal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 18px;
  border: 1px solid var(--wa-border);
  border-radius: 10px;
  background: rgba(14, 23, 41, 0.85);
  backdrop-filter: blur(4px);
}

.top-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.top-logo {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 15px;
  color: var(--wa-primary);
  background: rgba(32, 199, 165, 0.12);
  border: 1px solid rgba(32, 199, 165, 0.32);
}

.top-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--wa-text);
  letter-spacing: 0.5px;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.top-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-user-name {
  font-size: 13px;
  color: var(--wa-text);
}

/* ---------- 欢迎条 ---------- */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  margin-top: 16px;
  border-radius: 10px;
  border: 1px solid var(--wa-border);
  background:
    radial-gradient(600px 200px at 8% 0%, rgba(32, 199, 165, 0.12), transparent 68%),
    linear-gradient(120deg, #12233a, #101d2f);
}

.hero-hi {
  margin: 0;
  color: var(--wa-muted);
  font-size: 13px;
}

.hero-title {
  margin: 6px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--wa-text);
}

.hero-title em {
  font-size: 15px;
  font-style: normal;
  font-weight: 500;
  color: var(--wa-primary);
}

.hero-sub {
  margin: 0;
  font-size: 13px;
  color: var(--wa-muted);
}

.hero-art {
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  border-radius: 14px;
  font-size: 34px;
  color: var(--wa-primary);
  background: rgba(32, 199, 165, 0.08);
  border: 1px solid rgba(32, 199, 165, 0.28);
}

/* ---------- 系统入口 ---------- */
.entry-panel {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--wa-border);
  border-radius: 10px;
  background: rgba(18, 32, 50, 0.92);
}

.entry-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.entry-bar {
  width: 3px;
  height: 15px;
  border-radius: 2px;
  background: var(--wa-primary);
}

.entry-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wa-text);
}

.entry-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--wa-muted);
}

.sys-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 1100px) {
  .sys-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .sys-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.sys-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--wa-border);
  background: linear-gradient(150deg, color-mix(in srgb, var(--sys) 12%, transparent), transparent 62%), #101c2d;
  cursor: pointer;
  transition: all 0.2s;
}

.sys-card:hover {
  border-color: color-mix(in srgb, var(--sys) 55%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
}

.sys-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  font-size: 22px;
  color: var(--sys);
  background: color-mix(in srgb, var(--sys) 16%, transparent);
}

.sys-info {
  min-width: 0;
}

.sys-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--wa-text);
}

.sys-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--wa-muted);
}

.sys-detail {
  font-size: 12px;
  color: var(--wa-muted);
  opacity: 0.72;
}

.sys-enter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--sys);
  white-space: nowrap;
}

.portal-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 14px 2px 0;
  font-size: 12px;
  color: var(--wa-muted);
}
</style>
