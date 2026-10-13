<template>
  <div class="login-wrap">
    <div class="login-bg" />
    <div class="login-card">
      <div class="login-brand">
        <div class="login-logo"><ClusterOutlined /></div>
        <div>
          <h1>小蚁水利统一平台</h1>
          <p>WATER UNIFIED PLATFORM</p>
        </div>
      </div>

      <a-form layout="vertical" :model="form" @submit.prevent="submit">
        <a-form-item label="工作人员账号">
          <a-input v-model:value="form.username" size="large" placeholder="请输入账号" allow-clear autocomplete="username">
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item label="密码">
          <a-input-password v-model:value="form.password" size="large" placeholder="请输入密码" autocomplete="current-password" @press-enter="submit">
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>
        <a-form-item>
          <a-button type="primary" size="large" block :loading="loading" @click="submit">登 录</a-button>
        </a-form-item>
      </a-form>

      <div class="login-tip">请使用管理员分配的账号登录，登录行为会被记录在操作日志中。</div>
    </div>
    <div class="login-foot">小蚁水利统一平台 · 白蚁上报 / 设备监测 / 系统管理 · 本地化部署</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { UserOutlined, LockOutlined, ClusterOutlined } from '@ant-design/icons-vue'
import { PORTAL_PATH } from '@/utils/systems'

const form = ref({ username: '', password: '' })
const loading = ref(false)
const router = useRouter()
const route = useRoute()
const user = useUserStore()

async function submit() {
  if (!form.value.username || !form.value.password) return
  loading.value = true
  try {
    await user.login({ username: form.value.username.trim(), password: form.value.password })
    await user.loadProfile()
    // 动态路由尚未注册，先构建一次再跳转；登录成功统一进入系统入口（所有系统）
    const { buildDynamicRoutes } = await import('@/router')
    buildDynamicRoutes(user.menus)
    const redirect = route.query.redirect
    await router.replace(typeof redirect === 'string' && redirect ? redirect : PORTAL_PATH)
  } catch (e) {
    /* request 拦截器已统一提示 */
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1100px 520px at 15% 12%, rgba(32, 199, 165, 0.16), transparent 60%),
    radial-gradient(900px 480px at 88% 82%, rgba(23, 140, 186, 0.18), transparent 62%),
    #0b1220;
}

.login-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 50% 40%, #000 40%, transparent 78%);
}

.login-card {
  position: relative;
  width: 400px;
  max-width: calc(100vw - 32px);
  padding: 34px 32px 26px;
  border-radius: 14px;
  background: rgba(18, 32, 50, 0.92);
  border: 1px solid #24374f;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 26px;
}

.login-logo {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #20c7a5, #178cba);
  color: #06231d;
  font-size: 24px;
}

.login-brand h1 {
  margin: 0;
  font-size: 20px;
  color: #e8eef8;
  letter-spacing: 1px;
}

.login-brand p {
  margin: 3px 0 0;
  font-size: 11px;
  color: #8c9ab2;
  letter-spacing: 1.4px;
}

.login-tip {
  margin-top: 6px;
  font-size: 12px;
  color: #6d7d96;
  text-align: center;
}

.login-foot {
  position: absolute;
  bottom: 22px;
  color: #5b6b84;
  font-size: 12px;
}
</style>
