<template>
  <div>
    <h2 class="page-title">角色信息</h2>
    <p class="page-desc">按岗位职责划分权限集合，通过分配菜单控制成员可见范围与操作权限。</p>

    <a-form class="wa-search" layout="inline" :model="query" @submit.prevent>
      <a-form-item label="关键字">
        <a-input v-model:value="query.keyword" placeholder="角色名称 / 标识" allow-clear style="width: 190px" />
      </a-form-item>
      <a-form-item label="状态">
        <a-select v-model:value="query.status" allow-clear placeholder="全部状态" style="width: 130px">
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
        <span class="wa-muted">共 <b>{{ rows.length }}</b> 个角色</span>
        <div class="spacer" />
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button v-if="hasPerm('role:create')" type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>新增角色
        </a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }"
        :scroll="{ x: 940 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="cell-role">
              <SolutionOutlined class="role-icon" />
              <div>
                <div>{{ record.name }}</div>
                <small class="wa-muted wa-mono">{{ record.code }}</small>
              </div>
              <a-tag v-if="record.builtin" color="purple" class="builtin">内置</a-tag>
            </div>
          </template>
          <template v-else-if="column.key === 'menuIds'">
            <a-tag color="geekblue">已授权 {{ record.menuIds.length }} 个菜单</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-badge :status="record.status ? 'success' : 'default'" :text="record.status ? '启用' : '停用'" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a v-if="hasPerm('role:assign')" @click="openMenus(record)">
                <KeyOutlined /> 分配菜单
              </a>
              <a v-if="hasPerm('role:update')" @click="openEdit(record)">编辑</a>
              <a-popconfirm
                v-if="hasPerm('role:delete')"
                title="确认删除该角色？"
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
      :title="editing ? '编辑角色' : '新增角色'"
      :confirm-loading="saving"
      :mask-closable="false"
      destroy-on-close
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="角色名称" name="name">
          <a-input v-model:value="form.name" placeholder="如：片区巡查组长" />
        </a-form-item>
        <a-form-item label="角色标识" name="code">
          <a-input v-model:value="form.code" :disabled="!!editing" placeholder="英文小写，如 area_manager" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="form.description" :rows="3" placeholder="该角色的职责说明（选填）" />
        </a-form-item>
        <a-form-item label="排序">
          <a-input-number v-model:value="form.sort" :min="0" :max="999" style="width: 100%" />
        </a-form-item>
        <a-form-item label="状态">
          <a-switch v-model:checked="form.status" checked-children="启用" un-checked-children="停用" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 分配菜单 -->
    <a-drawer
      v-model:open="menuOpen"
      :title="`分配菜单 · ${current?.name || ''}`"
      width="520"
      :body-style="{ paddingTop: 8 }"
    >
      <template #extra>
        <a-button type="primary" size="small" :loading="saving" @click="submitMenus">保存授权</a-button>
      </template>

      <a-alert type="info" show-icon class="tip">
        <template #message>
          按子系统分组勾选并保存即可生效：勾选父级会自动包含其下子菜单，被授权的成员重新登录后只会看到已授权系统的模块。
        </template>
      </a-alert>

      <div class="tree-tools">
        <a-space>
          <a-checkbox v-model:checked="expandAll">展开/折叠</a-checkbox>
          <a @click="checkAll">全选</a>
          <a @click="checkedKeys = []">清空</a>
        </a-space>
        <span class="wa-muted">已选 {{ checkedKeys.length }} 项</span>
      </div>

      <a-spin :spinning="treeLoading">
        <div v-for="g in groups" :key="g.code || 'common'" class="sys-group">
          <div class="sys-group-head">
            <component :is="resolveIcon(g.icon)" class="sys-group-icon" :style="{ color: g.color }" />
            <span class="sys-group-name">{{ g.name }}</span>
            <span class="sys-group-count">{{ selectedCount(g) }}/{{ g.keys.length }}</span>
            <a class="sys-group-link" @click="checkGroup(g)">全选本系统</a>
            <a class="sys-group-link" @click="clearGroup(g)">清空</a>
          </div>
          <a-tree
            :key="g.code + '-' + (expandAll ? 'open' : 'close')"
            checkable
            block-node
            :default-expand-all="expandAll"
            :tree-data="g.tree"
            :checked-keys="checkedOfGroup(g)"
            @check="(checked, info) => onGroupCheck(g, checked, info)"
          />
        </div>
        <a-empty v-if="!groups.length" description="暂无可分配的菜单" />
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { SearchOutlined, ReloadOutlined, PlusOutlined, SolutionOutlined, KeyOutlined } from '@ant-design/icons-vue'
import { roleApi, menuApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { SYSTEMS, sysOfPath } from '@/utils/systems'
import { getIcon } from '@/utils/icons'

const user = useUserStore()
const hasPerm = user.hasPerm
const resolveIcon = (name) => getIcon(name)

const list = ref([])
const loading = ref(false)
const query = reactive({ keyword: '', status: undefined })

const rows = computed(() => {
  const kw = (query.keyword || '').trim().toLowerCase()
  return list.value.filter((r) => {
    if (kw && !`${r.name}${r.code}`.toLowerCase().includes(kw)) return false
    if (query.status !== undefined && r.status !== query.status) return false
    return true
  })
})

async function load() {
  loading.value = true
  try {
    list.value = (await roleApi.list()).items
  } catch {
    /* 已统一提示 */
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.keyword = ''
  query.status = undefined
}

const columns = [
  { title: '角色名称 / 标识', key: 'name', width: 220 },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '菜单授权', key: 'menuIds', width: 160 },
  { title: '成员数', dataIndex: 'user_count', key: 'user_count', width: 90 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 70 },
  { title: '状态', key: 'status', width: 90 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' }
]

/* ---------- 角色表单 ---------- */
const formRef = ref()
const formOpen = ref(false)
const saving = ref(false)
const editing = ref(null)
const form = reactive({ name: '', code: '', description: '', sort: 0, status: true })

const rules = {
  name: [{ required: true, message: '请输入角色名称' }],
  code: [
    { required: true, message: '请输入角色标识' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_-]{1,30}$/, message: '字母开头，2-31 位字母/数字/_/-' }
  ]
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', code: '', description: '', sort: 0, status: true })
  formOpen.value = true
}

function openEdit(row) {
  editing.value = row
  Object.assign(form, { name: row.name, code: row.code, description: row.description || '', sort: row.sort || 0, status: !!row.status })
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
      await roleApi.update(editing.value.id, {
        name: form.name,
        description: form.description,
        sort: form.sort,
        status: form.status
      })
      message.success('角色已更新')
    } else {
      await roleApi.create({ name: form.name, code: form.code, description: form.description, sort: form.sort, status: form.status })
      message.success('角色创建成功')
    }
    formOpen.value = false
    load()
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  try {
    await roleApi.remove(row.id)
    message.success('角色已删除')
    load()
  } catch (e) {
    message.error(e.message)
  }
}

/* ---------- 菜单授权抽屉（按子系统分组，支持整组授权） ---------- */
const menuOpen = ref(false)
const treeLoading = ref(false)
const current = ref(null)
const rawMenus = ref([])
const checkedKeys = ref([])
const allKeys = ref([])
const expandAll = ref(true)

function toTree(menus) {
  return menus.map((m) => ({
    key: m.id,
    title: m.type === 'dir' ? `${m.name}（目录）` : m.name,
    children: m.children ? toTree(m.children) : undefined
  }))
}

function collectKeys(menus, out = []) {
  for (const m of menus) {
    out.push(m.id)
    if (m.children) collectKeys(m.children, out)
  }
  return out
}

/** 菜单归属的子系统：优先取菜单配置，未配置时按路由前缀兜底 */
const menuSys = (m) => m.sys || sysOfPath(m.path)

/**
 * 授权树按子系统分组：每组一个独立树 + 「全选本系统」，方便超级管理员按系统整体授权。
 * 未归属子系统的菜单归入「公共菜单」，在所有子系统下都会显示，可单独授予。
 */
const groups = computed(() => {
  const build = (code, name, icon, color, nodes) => ({ code, name, icon, color, nodes, tree: toTree(nodes), keys: collectKeys(nodes) })
  const out = SYSTEMS.map((s) => build(s.code, s.name, s.icon, s.color, rawMenus.value.filter((m) => menuSys(m) === s.code)))
    .filter((g) => g.keys.length)
  const common = rawMenus.value.filter((m) => !menuSys(m))
  if (common.length) out.push(build('', '公共菜单', 'AppstoreOutlined', '#8c9ab2', common))
  return out
})

const checkedOfGroup = (g) => checkedKeys.value.filter((k) => g.keys.includes(k))
const selectedCount = (g) => checkedOfGroup(g).length

/** 合并各分组勾选结果：ant-design-vue 的 check 事件只返回当前树内的选中项 */
function onGroupCheck(group, checked, info) {
  const rest = checkedKeys.value.filter((k) => !group.keys.includes(k))
  checkedKeys.value = [...new Set([...rest, ...checked, ...(info.halfCheckedKeys || [])])]
}

function checkGroup(group) {
  checkedKeys.value = [...new Set([...checkedKeys.value, ...group.keys])]
}

function clearGroup(group) {
  checkedKeys.value = checkedKeys.value.filter((k) => !group.keys.includes(k))
}

async function openMenus(row) {
  current.value = row
  treeLoading.value = true
  menuOpen.value = true
  checkedKeys.value = [...(row.menuIds || [])]
  try {
    const res = await menuApi.list()
    rawMenus.value = res.items
    allKeys.value = collectKeys(res.items)
  } catch (e) {
    message.error(e.message)
  } finally {
    treeLoading.value = false
  }
}

function checkAll() {
  checkedKeys.value = [...allKeys.value]
}

async function submitMenus() {
  saving.value = true
  try {
    await roleApi.assignMenus(current.value.id, checkedKeys.value)
    message.success('菜单授权已保存')
    menuOpen.value = false
    load()
    await user.refreshRoles()
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

.wa-muted {
  color: var(--wa-muted);
}

.wa-mono {
  font-family: Consolas, monospace;
  font-size: 11px;
}

.cell-role {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-icon {
  color: var(--wa-primary);
  font-size: 16px;
}

.builtin {
  margin-left: 4px;
}

.danger {
  color: #ff7875;
}

.tip {
  margin-bottom: 12px;
}

.tree-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  font-size: 12px;
}

/* 子系统分组 */
.sys-group {
  margin-bottom: 14px;
  padding: 10px 12px 6px;
  border: 1px solid var(--wa-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.015);
}

.sys-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  margin-bottom: 4px;
  border-bottom: 1px dashed var(--wa-border);
  font-size: 12px;
}

.sys-group-icon {
  font-size: 14px;
}

.sys-group-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--wa-text);
}

.sys-group-count {
  color: var(--wa-muted);
}

.sys-group-link {
  margin-left: 6px;
  font-size: 12px;
}

.sys-group-link:first-of-type {
  margin-left: auto;
}
</style>
