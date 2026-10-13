<template>
  <div class="exception">
    <a-result status="403" title="403" sub-title="抱歉，当前账号没有访问该页面的权限">
      <template #extra>
        <a-button type="primary" @click="goHome">返回首页</a-button>
        <a-button @click="$router.back()">返回上一页</a-button>
      </template>
    </a-result>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const goHome = () => router.replace('/')
</script>

<style scoped>
.exception {
  padding: 80px 0;
}
</style>
