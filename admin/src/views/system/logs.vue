<template>
  <div>
    <h2 class="page-title">{{ pageTitle }}</h2>
    <p class="page-desc">记录登录、系统配置与工单处置等关键操作，包含账号、时间、浏览器与来源 IP。</p>

    <a-form class="wa-search" layout="inline" :model="query" @submit.prevent>
      <a-form-item label="关键字">
        <a-input v-model:value="query.username" placeholder="账号 / 姓名" allow-clear style="width: 170px" />
      </a-form-item>
      <a-form-item label="模块">
        <a-select v-model:value="query.module" allow-clear show-search placeholder="全部模块" style="width: 150px">
          <a-select-option v-for="m in options.modules" :key="m" :value="m">{{ m }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="操作">
        <a-select v-model:value="query.action" allow-clear show-search placeholder="全部操作" style="width: 160px">
          <a-select-option v-for="a in options.actions" :key="a" :value="a">{{ a }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="状态">
        <a-select v-model:value="query.status" allow-clear placeholder="全部" style="width: 120px">
          <a-select-option value="1">成功</a-select-option>
          <a-select-option value="0">失败</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="时间范围">
        <a-range-picker v-model:value="range" style="width: 240px" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>查询</a-button>
        <a-button style="margin-left: 8px" @click="resetQuery"><template #icon><ReloadOutlined /></template>重置</a-button>
      </a-form-item>
    </a-form>

    <section class="panel">
      <div class="table-toolbar">
        <span class="wa-muted">
          共 <b>{{ total }}</b> 条日志 · 今日 {{ stat.today }} 条 · 失败 {{ stat.fail }} 条
        </span>
        <div class="spacer" />
        <a-button @click="search"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button @click="exportCsv"><template #icon><DownloadOutlined /></template>导出 CSV</a-button>
        <a-button v-if="hasPerm('log:clear')" danger @click="clearOpen = true">
          <template #icon><DeleteOutlined /></template>清理日志
        </a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: page,
          pageSize: size,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          pageSizeOptions: ['20', '50', '100']
        }"
        :scroll="{ x: 1240 }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created_at'">
            <span class="wa-mono">{{ record.created_at }}</span>
          </template>
          <template v-else-if="column.key === 'user'">
            <div>
              <div>{{ record.user_name || '-' }}</div>
              <small class="wa-muted wa-mono">{{ record.username || '匿名' }}</small>
            </div>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-tag :color="record.status ? 'green' : 'red'">{{ record.action }}</a-tag>
          </template>
          <template v-else-if="column.key === 'request'">
            <span class="wa-mono small">{{ record.method }} {{ record.url }}</span>
          </template>
          <template v-else-if="column.key === 'client'">
            <div class="client-cell">
              <span><component :is="clientIcon(record.browser)" /> {{ record.browser }}</span>
              <small class="wa-muted">{{ record.os }}</small>
            </div>
          </template>
          <template v-else-if="column.key === 'ip'">
            <span class="wa-mono">{{ record.ip }}</span>
          </template>
          <template v-else-if="column.key === 'module'">
            <a-tag color="geekblue">{{ record.module }}</a-tag>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal
      v-model:open="clearOpen"
      title="清理操作日志"
      :confirm-loading="saving"
      ok-text="确认清理"
      ok-type="danger"
      @ok="submitClear"
    >
      <a-alert type="warning" show-icon class="tip">
        <template #message>清理后不可恢复，请确认已按需导出备份。</template>
      </a-alert>
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="清理范围">
          <a-select v-model:value="clearBefore">
            <a-select-option :value="0">清空全部日志</a-select-option>
            <a-select-option :value="7">仅保留最近 7 天</a-select-option>
            <a-select-option :value="30">仅保留最近 30 天</a-select-option>
            <a-select-option :value="90">仅保留最近 90 天</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  DesktopOutlined,
  MobileOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'
import { logApi, dashboardApi } from '@/api'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const user = useUserStore()
const hasPerm = user.hasPerm

/** 标题跟随菜单（操作日志 / 登录日志） */
const pageTitle = computed(() => route.meta?.title || '操作日志')

const rows = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const size = ref(20)
const range = ref(null)
const query = reactive({ username: '', module: undefined, action: undefined, status: undefined })
const options = reactive({ modules: [], actions: [] })
const stat = reactive({ today: 0, fail: 0 })

const columns = [
  { title: '操作时间', key: 'created_at', width: 165 },
  { title: '操作人', key: 'user', width: 130 },
  { title: '模块', key: 'module', width: 110 },
  { title: '操作', key: 'action', width: 120 },
  { title: '请求', key: 'request', width: 230 },
  { title: '来源 IP', key: 'ip', width: 130 },
  { title: '浏览器 / 系统', key: 'client', width: 170 },
  { title: '说明', dataIndex: 'message', key: 'message', ellipsis: true }
]

function clientIcon(browser) {
  const b = String(browser || '')
  if (b.includes('微信') || b.includes('Android') || b.includes('iOS')) return MobileOutlined
  if (b === '未知' || !b) return QuestionCircleOutlined
  return DesktopOutlined
}

function buildParams() {
  const p = { page: page.value, size: size.value }
  if (query.username) p.username = query.username
  if (query.module) p.module = query.module
  if (query.action) p.action = query.action
  if (query.status) p.status = query.status
  if (range.value && range.value[0]) p.from = range.value[0].format('YYYY-MM-DD')
  if (range.value && range.value[1]) p.to = range.value[1].format('YYYY-MM-DD')
  return p
}

async function search() {
  page.value = 1
  await fetchData()
}

async function fetchData() {
  loading.value = true
  try {
    const res = await logApi.list(buildParams())
    rows.value = res.items
    total.value = res.total
  } catch {
    /* 已统一提示 */
  } finally {
    loading.value = false
  }
}

function onTableChange(pager) {
  page.value = pager.current
  size.value = pager.pageSize
  fetchData()
}

function resetQuery() {
  query.username = ''
  query.module = undefined
  query.action = undefined
  query.status = undefined
  range.value = null
  search()
}

async function loadOptions() {
  try {
    const res = await logApi.options()
    const presetModule = route.meta?.preset?.module
    options.modules = presetModule && !res.modules.includes(presetModule) ? [presetModule, ...res.modules] : res.modules
    options.actions = res.actions
  } catch {
    /* 忽略 */
  }
}

async function loadStat() {
  try {
    const d = await dashboardApi.stats()
    stat.today = d.logToday
    stat.fail = d.logFail
  } catch {
    /* 忽略 */
  }
}

/* ---------- 导出 CSV ---------- */
function exportCsv() {
  const head = ['操作时间', '操作人账号', '操作人姓名', '模块', '操作', '请求方式', '请求地址', '来源IP', '浏览器', '操作系统', '状态', '说明']
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const body = rows.value.map((r) =>
    [
      r.created_at, r.username, r.user_name, r.module, r.action, r.method, r.url,
      r.ip, r.browser, r.os, r.status ? '成功' : '失败', r.message
    ].map(escape).join(',')
  )
  const csv = '\uFEFF' + [head.map(escape).join(','), ...body].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `操作日志_${dayjs().format('YYYYMMDD_HHmm')}.csv`
  a.click()
  URL.revokeObjectURL(url)
  message.success(`已导出当前页 ${rows.value.length} 条日志`)
}

/* ---------- 清理 ---------- */
const clearOpen = ref(false)
const clearBefore = ref(30)
const saving = ref(false)

async function submitClear() {
  saving.value = true
  try {
    const before = clearBefore.value ? dayjs().subtract(clearBefore.value, 'day').format('YYYY-MM-DD') : undefined
    const res = await logApi.clear(before)
    message.success(`已清理 ${res.deleted} 条日志`)
    clearOpen.value = false
    search()
    loadStat()
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  // 二级菜单带入的默认筛选条件，例如「登录日志」
  const preset = route.meta?.preset
  if (preset && preset.module) query.module = preset.module
  loadOptions()
  loadStat()
  fetchData()
})
</script>

<style scoped>
.wa-search {
  margin: 12px 0;
}

.wa-muted {
  color: var(--wa-muted);
}

.wa-mono {
  font-family: Consolas, monospace;
  font-size: 12px;
}

.wa-mono.small {
  font-size: 11px;
}

.client-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.client-cell small {
  font-size: 11px;
}

.tip {
  margin-bottom: 16px;
}
</style>
