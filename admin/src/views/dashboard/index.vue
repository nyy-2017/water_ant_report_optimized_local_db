<template>
  <div class="dash">
    <!-- 大屏标题条 -->
    <div class="dash-head">
      <div class="dash-head-left">
        <h2 class="page-title">水利设施白蚁隐患数据大屏</h2>
        <p class="page-desc">数据直连本地业务库 · 每 60 秒自动刷新一次</p>
      </div>
      <div class="dash-head-right">
        <span class="wa-live"><i :class="['wa-dot', autoRefresh ? 'live' : 'paused']" /> {{ autoRefresh ? '实时' : '已暂停' }}</span>
        <span class="wa-mono">{{ clock }}</span>
        <span class="wa-muted">更新于 {{ data.updatedAt || '--' }}</span>
        <a-button size="small" type="primary" :loading="loading" @click="load">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </div>
    </div>

    <!-- 核心指标 -->
    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="kpi-card" :style="{ '--kpi': k.color }">
        <div class="kpi-top">
          <span class="kpi-label">{{ k.label }}</span>
          <component :is="k.icon" class="kpi-icon" />
        </div>
        <div class="kpi-value">
          <span>{{ k.value }}</span>
          <small v-if="k.suffix">{{ k.suffix }}</small>
        </div>
        <div class="kpi-foot">{{ k.foot }}</div>
      </div>
    </div>

    <a-spin :spinning="loading && !data.updatedAt">
      <a-row :gutter="[16, 16]">
        <!-- 趋势 -->
        <a-col :xs="24" :lg="16">
          <section class="panel">
            <header class="panel-head">
              <span class="panel-title">近 14 天工单趋势</span>
              <span class="wa-muted">新增 / 办结</span>
            </header>
            <a-skeleton v-if="!data.updatedAt" active :paragraph="{ rows: 5 }" />
            <EChart v-else :option="trendOption" height="290px" />
          </section>
        </a-col>

        <!-- 状态分布 -->
        <a-col :xs="24" :lg="8">
          <section class="panel">
            <header class="panel-head">
              <span class="panel-title">工单状态分布</span>
            </header>
            <EChart v-if="data.updatedAt" :option="statusOption" height="290px" />
          </section>
        </a-col>

        <!-- 类型分布 -->
        <a-col :xs="24" :lg="8">
          <section class="panel">
            <header class="panel-head">
              <span class="panel-title">隐患类型分布</span>
            </header>
            <EChart v-if="data.updatedAt" :option="typeOption" height="260px" />
            <a-empty v-else description="暂无数据" />
          </section>
        </a-col>

        <!-- 高发位置 -->
        <a-col :xs="24" :lg="8">
          <section class="panel">
            <header class="panel-head">
              <span class="panel-title">高发位置 TOP 8</span>
            </header>
            <EChart v-if="data.updatedAt" :option="locationOption" height="260px" />
          </section>
        </a-col>

        <!-- 人员角色 -->
        <a-col :xs="24" :lg="8">
          <section class="panel">
            <header class="panel-head">
              <span class="panel-title">人员角色分布</span>
            </header>
            <EChart v-if="data.updatedAt" :option="userOption" height="260px" />
          </section>
        </a-col>

        <!-- 最新工单 -->
        <a-col :xs="24" :lg="14">
          <section class="panel">
            <header class="panel-head">
              <span class="panel-title">最新隐患工单</span>
              <a v-if="hasPerm('report:list')" class="wa-link" @click="$router.push('/reports/list')">查看全部 →</a>
            </header>
            <a-table
              size="small"
              :columns="reportCols"
              :data-source="data.reports"
              :pagination="false"
              :scroll="{ x: 520 }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'status'">
                  <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
                </template>
                <template v-else-if="column.key === 'code'">
                  <span class="wa-mono">{{ record.code }}</span>
                </template>
              </template>
            </a-table>
          </section>
        </a-col>

        <!-- 操作日志 -->
        <a-col :xs="24" :lg="10">
          <section class="panel">
            <header class="panel-head">
              <span class="panel-title">实时操作日志</span>
              <a v-if="hasPerm('log:list')" class="wa-link" @click="$router.push('/logs/list')">查看全部 →</a>
            </header>
            <a-timeline class="log-timeline">
              <a-timeline-item v-for="l in data.logs" :key="l.id" :color="l.status ? '#20c7a5' : '#ff7875'">
                <div class="log-row">
                  <b>{{ l.action }}</b>
                  <span class="wa-muted">{{ l.user_name || l.username }}</span>
                  <span class="wa-mono">{{ String(l.created_at).slice(11) }}</span>
                </div>
                <div class="log-sub wa-muted">{{ l.browser }} · {{ l.ip }}</div>
              </a-timeline-item>
              <a-empty v-if="!data.logs || !data.logs.length" description="暂无操作日志" />
            </a-timeline>
          </section>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  ReloadOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import EChart from '@/components/EChart.vue'
import { dashboardApi } from '@/api'
import { baseAxis, baseTooltip, palette } from '@/utils/echarts'
import { statusColor, statusChartColor } from '@/utils/report'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const hasPerm = user.hasPerm

const loading = ref(false)
const autoRefresh = ref(true)
const clock = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
const data = reactive({
  updatedAt: '',
  total: 0,
  today: 0,
  week: 0,
  month: 0,
  pending: 0,
  processing: 0,
  finished: 0,
  completionRate: 0,
  avgHours: 0,
  statusList: [],
  trend: [],
  types: [],
  locations: [],
  userRoles: [],
  userTotal: 0,
  userActive: 0,
  reports: [],
  logs: []
})

let clockTimer = null

async function load() {
  loading.value = true
  try {
    Object.assign(data, await dashboardApi.stats())
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

const kpis = computed(() => [
  {
    label: '工单总数',
    value: data.total,
    suffix: '件',
    color: '#20c7a5',
    icon: FileTextOutlined,
    foot: `今日 ${data.today} · 本周 ${data.week} · 本月 ${data.month}`
  },
  {
    label: '待处理',
    value: data.pending,
    suffix: '件',
    color: '#faad14',
    icon: ClockCircleOutlined,
    foot: '待审核 + 待派单'
  },
  {
    label: '处理中',
    value: data.processing,
    suffix: '件',
    color: '#3b9dff',
    icon: SyncOutlined,
    foot: '已派单现场处置中'
  },
  {
    label: '已办结',
    value: data.finished,
    suffix: '件',
    color: '#36cfc9',
    icon: CheckCircleOutlined,
    foot: `办结率 ${data.completionRate}%`
  },
  {
    label: '平均办结时长',
    value: data.avgHours,
    suffix: '小时',
    color: '#7c6cff',
    icon: ThunderboltOutlined,
    foot: '提交至完成的时间差'
  },
  {
    label: '平台人员',
    value: data.userTotal,
    suffix: '人',
    color: '#178cba',
    icon: TeamOutlined,
    foot: `启用中 ${data.userActive} 人`
  }
])

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis', ...baseTooltip },
  legend: { data: ['新增工单', '办结工单'], textStyle: { color: '#8c9ab2' }, top: 0, right: 0, icon: 'roundRect' },
  grid: { left: 8, right: 12, top: 36, bottom: 4, containLabel: true },
  xAxis: { type: 'category', boundaryGap: false, data: data.trend.map((t) => t.date), ...baseAxis, splitLine: { show: false } },
  yAxis: { type: 'value', minInterval: 1, ...baseAxis },
  series: [
    {
      name: '新增工单',
      type: 'line',
      smooth: true,
      symbolSize: 6,
      data: data.trend.map((t) => t.created),
      lineStyle: { width: 2.5, color: '#faad14' },
      itemStyle: { color: '#faad14' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(250,173,20,0.34)' },
            { offset: 1, color: 'rgba(250,173,20,0)' }
          ]
        }
      }
    },
    {
      name: '办结工单',
      type: 'line',
      smooth: true,
      symbolSize: 6,
      data: data.trend.map((t) => t.completed),
      lineStyle: { width: 2.5, color: '#20c7a5' },
      itemStyle: { color: '#20c7a5' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(32,199,165,0.36)' },
            { offset: 1, color: 'rgba(32,199,165,0)' }
          ]
        }
      }
    }
  ]
}))

const statusOption = computed(() => ({
  tooltip: { trigger: 'item', ...baseTooltip },
  legend: { orient: 'vertical', right: 0, top: 'middle', textStyle: { color: '#8c9ab2' }, itemWidth: 10, itemHeight: 10 },
  series: [
    {
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['38%', '52%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#122032', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 15, color: '#e8eef8', formatter: '{b}\n{c} 件' } },
      data: data.statusList.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: statusChartColor(s.name) } }))
    }
  ]
}))

const typeOption = computed(() => ({
  tooltip: { trigger: 'item', ...baseTooltip },
  legend: { bottom: 0, textStyle: { color: '#8c9ab2' }, itemWidth: 10, itemHeight: 10 },
  series: [
    {
      type: 'pie',
      radius: [24, 78],
      center: ['50%', '44%'],
      roseType: 'radius',
      itemStyle: { borderColor: '#122032', borderWidth: 2 },
      label: { color: '#c6d2e4', fontSize: 11, formatter: '{b} {d}%' },
      data: data.types.map((t, i) => ({ ...t, itemStyle: { color: palette[i % palette.length] } }))
    }
  ]
}))

const locationOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...baseTooltip },
  grid: { left: 8, right: 24, top: 12, bottom: 4, containLabel: true },
  xAxis: { type: 'value', minInterval: 1, ...baseAxis },
  yAxis: {
    type: 'category',
    data: [...data.locations].reverse().map((l) => l.name),
    ...baseAxis,
    splitLine: { show: false }
  },
  series: [
    {
      type: 'bar',
      barWidth: 12,
      data: [...data.locations].reverse().map((l, i, arr) => ({
        value: l.value,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(23,140,186,0.35)' },
              { offset: 1, color: arr.length - 1 === i ? '#faad14' : '#20c7a5' }
            ]
          }
        }
      }))
    }
  ]
}))

const userOption = computed(() => ({
  tooltip: { trigger: 'item', ...baseTooltip },
  legend: { orient: 'vertical', right: 0, top: 'middle', textStyle: { color: '#8c9ab2' }, itemWidth: 10, itemHeight: 10 },
  series: [
    {
      type: 'pie',
      radius: ['52%', '74%'],
      center: ['36%', '52%'],
      itemStyle: { borderColor: '#122032', borderWidth: 2 },
      label: { color: '#c6d2e4', fontSize: 11, formatter: '{b}: {c}' },
      data: data.userRoles.map((u, i) => ({ name: u.name, value: u.value, itemStyle: { color: palette[i % palette.length] } }))
    }
  ]
}))

const reportCols = [
  { title: '编号', dataIndex: 'code', key: 'code', width: 130 },
  { title: '位置', dataIndex: 'location', key: 'location', ellipsis: true },
  { title: '上报人', dataIndex: 'submitter', key: 'submitter', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '提交时间', dataIndex: 'created_at', key: 'created_at', width: 150, customRender: ({ text }) => String(text || '').slice(5, 16) }
]

function onTick() {
  if (autoRefresh.value) load()
}

onMounted(() => {
  load()
  clockTimer = setInterval(() => (clock.value = dayjs().format('YYYY-MM-DD HH:mm:ss')), 1000)
  window.addEventListener('wa-realtime-tick', onTick)
})

onBeforeUnmount(() => {
  clearInterval(clockTimer)
  window.removeEventListener('wa-realtime-tick', onTick)
})
</script>

<style scoped>
.dash-head {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 14px;
}

.dash-head-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.wa-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--wa-muted);
}

.wa-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8c9ab2;
}

.wa-dot.live {
  background: var(--wa-primary);
  box-shadow: 0 0 0 0 rgba(32, 199, 165, 0.7);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  70% {
    box-shadow: 0 0 0 8px rgba(32, 199, 165, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(32, 199, 165, 0);
  }
}

.wa-mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--wa-text);
}

.wa-muted {
  color: var(--wa-muted);
}

.wa-link {
  color: var(--wa-primary);
  cursor: pointer;
  font-size: 12px;
}

/* KPI 卡片 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 1400px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.kpi-card {
  position: relative;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--wa-border);
  background: linear-gradient(160deg, color-mix(in srgb, var(--kpi) 16%, transparent), transparent 62%), var(--wa-panel);
  overflow: hidden;
}

.kpi-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--kpi);
}

.kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--wa-muted);
  font-size: 13px;
}

.kpi-icon {
  font-size: 18px;
  color: var(--kpi);
}

.kpi-value {
  margin: 6px 0 4px;
  font-size: 28px;
  font-weight: 700;
  color: var(--wa-text);
  line-height: 1.1;
}

.kpi-value small {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 400;
  color: var(--wa-muted);
}

.kpi-foot {
  font-size: 11px;
  color: var(--wa-muted);
}

/* 面板 */
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wa-text);
}

.log-timeline {
  margin: 8px 0 0 4px;
  max-height: 300px;
  overflow-y: auto;
}

.log-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
  color: var(--wa-text);
}

.log-row span:nth-child(3) {
  margin-left: auto;
}

.log-sub {
  font-size: 11px;
}
</style>
