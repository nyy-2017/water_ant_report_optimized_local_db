<template>
  <div>
    <h2 class="page-title">用户信息</h2>
    <p class="page-desc">维护后台登录账号，配置所属角色与启用状态。</p>

    <a-form class="wa-search" layout="inline" :model="query" @submit.prevent>
      <a-form-item label="关键字">
        <a-input v-model:value="query.keyword" placeholder="账号 / 姓名" allow-clear style="width: 180px" />
      </a-form-item>
      <a-form-item label="角色">
        <a-select v-model:value="query.role" allow-clear placeholder="全部角色" style="width: 160px">
          <a-select-option v-for="r in user.roles" :key="r.code" :value="r.code">{{ r.name }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="状态">
        <a-select v-model:value="query.active" allow-clear placeholder="全部状态" style="width: 130px">
          <a-select-option :value="1">启用</a-select-option>
          <a-select-option :value="0">停用</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="load"><template #icon><SearchOutlined /></template>查询</a-button>
        <a-button style="margin-left: 8px" @click="resetQuery"><template #icon><ReloadOutlined /></template>重置</a-button>
      </a-form-item>
    </a-form>

    <section class="panel">
      <div class="table-toolbar">
        <span class="wa-muted">
          共 <b>{{ rows.length }}</b> 个账号
        </span>
        <div class="spacer" />
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button v-if="hasPerm('user:create')" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增用户
        </a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }"
        :scroll="{ x: 980 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'username'">
            <div class="cell-user">
              <a-avatar :size="28" :style="{ background: '#178cba' }">{{ (record.name || 'U').slice(0, 1) }}</a-avatar>
              <div>
                <div>{{ record.username }}</div>
                <small class="wa-muted">{{ record.name }}</small>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'role'">
            <a-tag color="cyan">{{ roleLabel(record.role) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'gender'">
            {{ record.gender || '-' }}
          </template>
          <template v-else-if="column.key === 'phone'">
            {{ record.phone || '-' }}
          </template>
          <template v-else-if="column.key === 'active'">
            <a-badge :status="record.active ? 'success' : 'default'" :text="record.active ? '启用' : '停用'" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a v-if="hasPerm('user:update')" @click="openEdit(record)">编辑</a>
              <a v-if="hasPerm('user:update')" @click="toggle(record)">{{ record.active ? '停用' : '启用' }}</a>
              <a v-if="hasPerm('user:reset')" @click="openReset(record)">重置密码</a>
              <a-popconfirm
                v-if="hasPerm('user:delete')"
                title="确认删除该账号？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="remove(record)"
              >
                <a class="danger">删除</a>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="formOpen"
      :title="editing ? '编辑用户' : '新增用户'"
      :confirm-loading="saving"
      :mask-closable="false"
      destroy-on-close
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="登录账号" name="username">
          <a-input v-model:value="form.username" :disabled="!!editing" placeholder="建议使用工号或姓名拼音" />
        </a-form-item>
        <a-form-item label="姓名" name="name">
          <a-input v-model:value="form.name" placeholder="请输入姓名" />
        </a-form-item>
        <a-form-item v-if="!editing" label="初始密码" name="password">
          <a-input-password v-model:value="form.password" placeholder="至少 6 位" />
        </a-form-item>
        <a-form-item label="手机号码" name="phone">
          <a-input v-model:value="form.phone" placeholder="选填" />
        </a-form-item>
        <a-form-item label="性别" name="gender">
          <a-radio-group v-model:value="form.gender">
            <a-radio value="男">男</a-radio>
            <a-radio value="女">女</a-radio>
            <a-radio value="未知">未知</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="所属角色" name="role">
          <a-select v-model:value="form.role" placeholder="请选择角色">
            <a-select-option v-for="r in user.roles" :key="r.code" :value="r.code">
              {{ r.name }}<span class="wa-muted">（{{ r.code }}）</span>
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-switch v-model:checked="form.active" checked-children="启用" un-checked-children="停用" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 重置密码 -->
    <a-modal
      v-model:open="resetOpen"
      title="重置登录密码"
      :confirm-loading="saving"
      ok-text="确认重置"
      :mask-closable="false"
      @ok="submitReset"
    >
      <p class="wa-muted">正在重置账号 <b>{{ current?.username }}</b> 的密码。</p>
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="新密码" required>
          <a-input-password v-model:value="newPassword" placeholder="至少 6 位" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { userApi } from '@/api'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const hasPerm = user.hasPerm

const list = ref([])
const loading = ref(false)
const query = reactive({ keyword: '', role: undefined, active: undefined })

const rows = computed(() => {
  const kw = (query.keyword || '').trim().toLowerCase()
  return list.value.filter((u) => {
    if (kw && !`${u.username}${u.name}`.toLowerCase().includes(kw)) return false
    if (query.role && u.role !== query.role) return false
    if (query.active !== undefined && u.active !== query.active) return false
    return true
  })
})

const roleLabel = (code) => user.roles.find((r) => r.code === code)?.name || code

async function load() {
  loading.value = true
  try {
    list.value = (await userApi.list()).items
    await user.refreshRoles()
  } catch {
    /* 已统一提示 */
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.role = undefined
  query.active = undefined
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '账号 / 姓名', key: 'username', width: 180 },
  { title: '手机号码', dataIndex: 'phone', key: 'phone', width: 130 },
  { title: '性别', dataIndex: 'gender', key: 'gender', width: 80 },
  { title: '角色', key: 'role', width: 160 },
  { title: '状态', key: 'active', width: 100 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
  { title: '操作', key: 'action', width: 210, fixed: 'right' }
]

/* ---------- 表单 ---------- */
const formRef = ref()
const formOpen = ref(false)
const saving = ref(false)
const editing = ref(null)
const current = ref(null)
const form = reactive({ username: '', name: '', password: '', phone: '', gender: '男', role: undefined, active: true })

const rules = {
  username: [{ required: true, message: '请输入登录账号' }, { pattern: /^[A-Za-z0-9_.-]{3,30}$/, message: '3-30 位字母、数字、_ . -' }],
  name: [{ required: true, message: '请输入姓名' }],
  password: [{ required: true, message: '请输入初始密码' }, { min: 6, message: '密码至少 6 位' }],
  role: [{ required: true, message: '请选择角色' }],
  phone: [{ pattern: /^[\d\-+ ]{5,30}$/, message: '手机号格式不正确', trigger: 'blur' }]
}

function openCreate() {
  editing.value = null
  Object.assign(form, { username: '', name: '', password: '', phone: '', gender: '男', role: undefined, active: true })
  formOpen.value = true
}

function openEdit(row) {
  editing.value = row
  current.value = row
  Object.assign(form, {
    username: row.username,
    name: row.name,
    phone: row.phone || '',
    gender: row.gender || '未知',
    role: row.role,
    active: !!row.active
  })
  formOpen.value = true
}

async function submit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await userApi.update(editing.value.id, {
        name: form.name,
        phone: form.phone,
        gender: form.gender,
        role: form.role,
        active: form.active
      })
      message.success('用户信息已更新')
    } else {
      await userApi.create({
        username: form.username,
        name: form.name,
        password: form.password,
        phone: form.phone,
        gender: form.gender,
        role: form.role
      })
      message.success('账号创建成功')
    }
    formOpen.value = false
    load()
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}

/* ---------- 启用 / 停用 / 删除 / 重置密码 ---------- */
async function toggle(row) {
  try {
    await userApi.setActive(row.id, !row.active)
    message.success(row.active ? '账号已停用' : '账号已启用')
    load()
  } catch (e) {
    message.error(e.message)
  }
}

async function remove(row) {
  try {
    await userApi.remove(row.id)
    message.success('账号已删除')
    load()
  } catch (e) {
    message.error(e.message)
  }
}

const resetOpen = ref(false)
const newPassword = ref('')

function openReset(row) {
  current.value = row
  newPassword.value = ''
  resetOpen.value = true
}

async function submitReset() {
  if ((newPassword.value || '').length < 6) return message.warning('新密码至少 6 位')
  saving.value = true
  try {
    await userApi.resetPassword(current.value.id, newPassword.value)
    message.success('密码已重置')
    resetOpen.value = false
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.wa-search {
  margin: 12px 0;
}

.cell-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cell-user small {
  font-size: 11px;
}

.wa-muted {
  color: var(--wa-muted);
}

.danger {
  color: #ff7875;
}
</style>
