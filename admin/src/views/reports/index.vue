<template>
  <div>
    <h2 class="page-title">{{ pageTitle }}</h2>
    <p class="page-desc">对巡查上报的白蚁隐患进行审核、派单与处置闭环。</p>

    <a-form class="wa-search" layout="inline" :model="query" @submit.prevent>
      <a-form-item label="关键字">
        <a-input v-model:value="query.q" placeholder="编号 / 位置 / 地址" allow-clear style="width: 210px" />
      </a-form-item>
      <a-form-item label="状态">
        <a-select v-model:value="query.status" allow-clear placeholder="全部状态" style="width: 150px">
          <a-select-option v-for="s in REPORT_STATUSES" :key="s" :value="s">{{ s }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="load"><template #icon><SearchOutlined /></template>查询</a-button>
        <a-button style="margin-left: 8px" @click="resetQuery"><template #icon><ReloadOutlined /></template>重置</a-button>
      </a-form-item>
    </a-form>

    <section class="panel">
      <div class="table-toolbar">
        <span class="wa-muted">共 <b>{{ rows.length }}</b> 条工单</span>
        <div class="spacer" />
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }"
        :scroll="{ x: 1080 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="wa-mono">{{ record.code }}</span>
            <div class="wa-muted small">{{ record.date }}</div>
          </template>
          <template v-else-if="column.key === 'location'">
            <div>{{ record.location }}</div>
            <small class="wa-muted">{{ record.address }}</small>
          </template>
          <template v-else-if="column.key === 'people'">
            <div>{{ record.submitter_name || record.reporter }}</div>
            <small class="wa-muted">指派：{{ record.assignee_name || '未指派' }}</small>
          </template>
          <template v-else-if="column.key === 'photos'">
            <span v-if="!record.photos.length" class="wa-muted">无</span>
            <template v-else>
              <a-image-preview-group v-if="record.photos.length > 1">
                <a-image
                  v-for="(p, i) in record.photos.slice(0, 3)"
                  :key="i"
                  :src="assetPath(p)"
                  :width="34"
                  :height="34"
                  class="thumb"
                />
              </a-image-preview-group>
              <a-image v-else :src="assetPath(record.photos[0])" :width="34" :height="34" class="thumb" />
            </template>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a @click="openDetail(record)">详情</a>
              <a v-if="canReview(record)" @click="doReview(record, true)">通过</a>
              <a v-if="canReview(record)" class="danger" @click="doReview(record, false)">驳回</a>
              <a v-if="canAssign(record)" @click="openAssign(record)">派单</a>
              <a v-if="canComplete(record)" @click="openComplete(record)">处理结果</a>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="detailOpen" title="隐患工单详情" width="560">
      <a-descriptions :column="1" bordered size="small">
        <a-descriptions-item label="工单编号">{{ cur.code }}</a-descriptions-item>
        <a-descriptions-item label="隐患位置">{{ cur.location }}</a-descriptions-item>
        <a-descriptions-item label="详细地址">{{ cur.address }}</a-descriptions-item>
        <a-descriptions-item label="隐患类型">{{ cur.type }} · {{ cur.date }}</a-descriptions-item>
        <a-descriptions-item label="上报人">{{ cur.reporter }} {{ cur.phone }}</a-descriptions-item>
        <a-descriptions-item label="当前状态">
          <a-tag :color="statusColor(cur.status)">{{ cur.status }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="提交时间">{{ cur.created_at }}</a-descriptions-item>
        <a-descriptions-item label="坐标">
          <span class="wa-mono">{{ cur.latitude }}, {{ cur.longitude }}</span>
          <a class="map-link" target="_blank" :href="`https://maps.google.com/?q=${cur.latitude},${cur.longitude}`">
            查看地图 ↗
          </a>
        </a-descriptions-item>
        <a-descriptions-item label="隐患描述">{{ cur.description }}</a-descriptions-item>
        <a-descriptions-item v-if="cur.result" label="处理结果">{{ cur.result }}</a-descriptions-item>
      </a-descriptions>

      <div v-if="cur.photos && cur.photos.length" class="photo-wall">
        <a-image-preview-group>
          <a-image v-for="(p, i) in cur.photos" :key="i" :src="assetPath(p)" :width="104" :height="104" />
        </a-image-preview-group>
      </div>

      <div v-if="cur.events && cur.events.length" class="event-list">
        <div class="event-title">流转记录</div>
        <a-timeline>
          <a-timeline-item v-for="(e, i) in cur.events" :key="i">
            <b>{{ e.action }}</b>
            <span class="wa-muted"> · {{ e.actor }}</span>
            <div class="wa-muted small">{{ e.created_at }}{{ e.note ? ' · ' + e.note : '' }}</div>
          </a-timeline-item>
        </a-timeline>
      </div>
    </a-drawer>

    <!-- 派单 -->
    <a-modal v-model:open="assignOpen" title="派单处置" :mask-closable="false" @ok="submitAssign">
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="处理人员" required>
          <a-select v-model:value="assignees.assigneeId" placeholder="请选择处理人员">
            <a-select-option v-for="u in candidates" :key="u.id" :value="u.id">
              {{ u.name }}（{{ u.username }} · {{ u.role }}）
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="派单备注">
          <a-textarea v-model:value="assignees.note" :rows="3" placeholder="选填，如：请携带药械尽快处置" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 处理结果 -->
    <a-modal v-model:open="completeOpen" title="填写处理结果" :mask-closable="false" @ok="submitComplete">
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="处理结果" required>
          <a-textarea v-model:value="result" :rows="5" placeholder="请描述处理措施、用药情况与复查结论" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { reportApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { REPORT_STATUSES, statusColor } from '@/utils/report'
import { assetPath } from '@/utils/file'

const route = useRoute()
const user = useUserStore()
const hasPerm = user.hasPerm

/** 标题跟随菜单（工单列表 / 待审核工单） */
const pageTitle = computed(() => route.meta?.title || '隐患工单')

const rows = ref([])
const loading = ref(false)
const query = reactive({ q: '', status: undefined })

const columns = [
  { title: '编号 / 发现日期', key: 'code', width: 160 },
  { title: '隐患位置', key: 'location', width: 240 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '上报 / 处理人', key: 'people', width: 170 },
  { title: '现场照片', key: 'photos', width: 140 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' }
]

const canReview = (r) => r.status === '待审核' && hasPerm('report:review')
const canAssign = (r) => r.status === '待派单' && hasPerm('report:assign')
const canComplete = (r) => ['已派单', '处理中'].includes(r.status) && hasPerm('report:complete')

async function load() {
  loading.value = true
  try {
    const p = {}
    if (query.q) p.q = query.q
    if (query.status) p.status = query.status
    rows.value = (await reportApi.list(p)).items
  } catch {
    /* 已统一提示 */
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.q = ''
  query.status = undefined
  load()
}

/* ---------- 详情 ---------- */
const detailOpen = ref(false)
const cur = ref({})

async function openDetail(row) {
  cur.value = row
  detailOpen.value = true
  try {
    const res = await reportApi.detail(row.id)
    cur.value = res.item
  } catch (e) {
    message.error(e.message)
  }
}

/* ---------- 审核 ---------- */
function doReview(row, approved) {
  Modal.confirm({
    title: approved ? '确认审核通过？' : '确认驳回该工单？',
    content: approved ? '通过后工单将进入「待派单」环节。' : '驳回后请填写原因，便于上报人修改。',
    okText: approved ? '通过' : '驳回',
    cancelText: '取消',
    okButtonProps: { danger: !approved },
    onOk: async () => {
      try {
        await reportApi.review(row.id, { approved, note: approved ? '' : '经复核不符合立项条件，请补充现场照片后重新提交' })
        message.success(approved ? '工单已审核通过' : '工单已驳回')
        detailOpen.value = false
        load()
      } catch (e) {
        message.error(e.message)
      }
    }
  })
}

/* ---------- 派单 ---------- */
const assignOpen = ref(false)
const candidates = ref([])
const assignees = reactive({ id: null, assigneeId: undefined, note: '' })

async function openAssign(row) {
  assignees.id = row.id
  assignees.assigneeId = undefined
  assignees.note = ''
  assignOpen.value = true
  try {
    candidates.value = (await reportApi.assignees()).items
  } catch (e) {
    message.error(e.message)
  }
}

async function submitAssign() {
  if (!assignees.assigneeId) return message.warning('请选择处理人员')
  try {
    await reportApi.assign(assignees.id, { assigneeId: assignees.assigneeId, note: assignees.note })
    message.success('派单成功')
    assignOpen.value = false
    load()
  } catch (e) {
    message.error(e.message)
  }
}

/* ---------- 处理完成 ---------- */
const completeOpen = ref(false)
const completeId = ref(null)
const result = ref('')

function openComplete(row) {
  completeId.value = row.id
  result.value = ''
  completeOpen.value = true
}

async function submitComplete() {
  if (!result.value.trim()) return message.warning('请填写处理结果')
  try {
    await reportApi.complete(completeId.value, { result: result.value.trim() })
    message.success('工单已完成')
    completeOpen.value = false
    load()
  } catch (e) {
    message.error(e.message)
  }
}

onMounted(() => {
  // 二级菜单带入的默认筛选条件，例如「待审核工单」
  const preset = route.meta?.preset
  if (preset && preset.status) query.status = preset.status
  load()
})
</script>

<style scoped>
.wa-search {
  margin: 12px 0;
}

.wa-muted {
  color: var(--wa-muted);
}

.small {
  font-size: 11px;
}

.wa-mono {
  font-family: Consolas, monospace;
  font-size: 12px;
}

.danger {
  color: #ff7875;
}

.map-link {
  margin-left: 8px;
  color: var(--wa-primary);
  font-size: 12px;
}

.thumb {
  margin-right: 4px;
  border-radius: 4px;
  object-fit: cover;
}

.photo-wall {
  margin: 16px 0;
}

.event-list {
  margin-top: 8px;
}

.event-title {
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--wa-text);
}
</style>
