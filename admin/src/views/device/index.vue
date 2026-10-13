<template>
  <div>
    <h2 class="page-title">设备监测</h2>
    <p class="page-desc">物联网监测设备台账、在线状态与告警总览。</p>

    <a-alert class="tip" type="info" show-icon>
      <template #message>设备监测模块为预留模块</template>
      <template #description>
        子系统结构、菜单与权限已就绪，接入设备网关 / 物联网平台数据源后即可展示实时数据；
        如需扩展设备相关页面，可在「系统管理 - 菜单信息」中新增菜单并归属到「设备监测系统」。
      </template>
    </a-alert>

    <a-row :gutter="[16, 16]">
      <a-col v-for="c in capabilities" :key="c.title" :xs="24" :sm="12" :lg="6">
        <div class="cap-card">
          <component :is="c.icon" class="cap-icon" />
          <div class="cap-title">{{ c.title }}</div>
          <div class="cap-desc">{{ c.desc }}</div>
        </div>
      </a-col>
    </a-row>

    <section class="panel">
      <div class="table-toolbar">
        <span class="wa-muted">设备实时监测</span>
        <div class="spacer" />
        <a-button size="small" disabled><template #icon><ReloadOutlined /></template>刷新</a-button>
      </div>
      <a-empty description="暂无设备数据（待接入数据源）" />
    </section>
  </div>
</template>

<script setup>
import {
  ApiOutlined,
  BellOutlined,
  DashboardOutlined,
  ReloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'

const capabilities = [
  { title: '设备台账', desc: '设备编号、类型、安装位置与责任人维护', icon: DashboardOutlined },
  { title: '实时监测', desc: '在线状态、采集指标与历史曲线', icon: ApiOutlined },
  { title: '阈值告警', desc: '异常自动告警并推送处置人员', icon: BellOutlined },
  { title: '联动处置', desc: '告警自动生成工单，闭环跟踪', icon: ThunderboltOutlined }
]
</script>

<style scoped>
.tip {
  margin: 14px 0;
}

.cap-card {
  height: 100%;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--wa-border);
  background: var(--wa-panel);
}

.cap-icon {
  font-size: 20px;
  color: var(--wa-primary);
}

.cap-title {
  margin: 8px 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--wa-text);
}

.cap-desc {
  font-size: 12px;
  color: var(--wa-muted);
}

.panel {
  margin-top: 16px;
}

.wa-muted {
  color: var(--wa-muted);
}
</style>
