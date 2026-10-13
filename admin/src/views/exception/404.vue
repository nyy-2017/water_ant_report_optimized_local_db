<template>
  <div class="exception">
    <a-result status="404" title="404" sub-title="页面不存在或已被删除">
      <template #extra>
        <a-button type="primary" @click="$router.replace('/')">返回首页</a-button>
      </template>
    </a-result>
  </div>
</template>

<style scoped>
.exception {
  padding: 80px 0;
}
</style>
