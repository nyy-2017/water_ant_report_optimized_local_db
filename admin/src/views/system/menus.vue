<template>
  <div>
    <h2 class="page-title">菜单信息</h2>
    <p class="page-desc">
      配置后台左侧菜单树与路由；组件路径必须填写系统已存在的视图，否则该菜单不会注册到路由。
      「所属系统」决定菜单归属的子系统，成员在被授权后可看到对应系统模块。
    </p>

    <section class="panel">
      <div class="table-toolbar">
        <span class="wa-muted">共 <b>{{ tree.length }}</b> 个顶级菜单</span>
        <div class="spacer" />
        <a-button @click="load"><template #icon><ReloadOutlined /></template>刷新</a-button>
        <a-button v-if="hasPerm('menu:create')" type="primary" @click="openCreate()">
          <template #icon><PlusOutlined /></template>新增顶级菜单
        </a-button>
      </div>

      <a-table
        :columns="columns"
        v-model:expanded-row-keys="expandedRowKeys"
        :data-source="tree"
        row-key="id"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1320 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span class="menu-name">
              <component :is="resolveIcon(record.icon)" />
              {{ record.name }}
            </span>
          </template>
          <template v-else-if="column.key === 'type'">
            <a-tag :color="typeColor(record.type)">{{ typeLabel(record.type) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'sys'">
            <a-tag v-if="record.sys" :color="systemMeta(record.sys).color">{{ systemMeta(record.sys).name }}</a-tag>
            <a-tag v-else>公共菜单</a-tag>
          </template>
          <template v-else-if="column.key === 'path'">
            <span class="wa-mono">{{ record.path || '-' }}</span>
          </template>
          <template v-else-if="column.key === 'permission'">
            <div class="perm-tags">
              <a-tag v-for="p in perms(record.permission)" :key="p" color="blue">{{ p }}</a-tag>
              <span v-if="!perms(record.permission).length" class="wa-muted">-</span>
            </div>
          </template>
          <template v-else-if="column.key === 'visible'">
            <a-switch
              size="small"
              :checked="!!record.visible"
              checked-children="显示"
              un-checked-children="隐藏"
              @change="(v) => quickToggle(record, 'visible', v)"
            />
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              size="small"
              :checked="!!record.status"
              checked-children="启用"
              un-checked-children="停用"
              @change="(v) => quickToggle(record, 'status', v)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a v-if="record.type === 'dir' && hasPerm('menu:create')" @click="openCreate(record)">新增下级</a>
              <a v-if="hasPerm('menu:update')" @click="openEdit(record)">编辑</a>
              <a-popconfirm
                v-if="hasPerm('menu:delete')"
                title="确认删除该菜单？"
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

    <a-modal
      v-model:open="formOpen"
      :title="editing ? '编辑菜单' : '新增菜单'"
      :confirm-loading="saving"
      :mask-closable="false"
      destroy-on-close
      width="640px"
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" :label-col="{ span: 5 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="菜单类型" name="type">
          <a-radio-group v-model:value="form.type" button-style="solid" size="small">
            <a-radio-button value="dir">目录</a-radio-button>
            <a-radio-button value="menu">菜单</a-radio-button>
            <a-radio-button value="action">按钮/权限点</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="上级菜单" name="parent_id">
          <a-tree-select
            v-model:value="form.parent_id"
            :tree-data="parentOptions"
            tree-default-expand-all
            allow-clear
            placeholder="顶级菜单（不选）"
            :disabled="!!editing"
          />
        </a-form-item>
        <a-form-item label="所属系统">
          <a-select v-model:value="form.sys" placeholder="公共菜单（所有子系统可见）">
            <a-select-option value="">公共菜单（所有子系统可见）</a-select-option>
            <a-select-option v-for="s in SYSTEMS" :key="s.code" :value="s.code">{{ s.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="菜单名称" name="name">
          <a-input v-model:value="form.name" placeholder="如：用户信息" />
        </a-form-item>
        <a-form-item label="路由地址" name="path">
          <a-input v-model:value="form.path" placeholder="如：/system/users，按钮类型可留空" />
        </a-form-item>
        <a-form-item v-if="form.type === 'dir'" label="默认跳转">
          <a-input v-model:value="form.redirect" placeholder="点击目录时默认打开的页面，如：/system/users" />
        </a-form-item>
        <a-form-item v-if="form.type === 'menu'" label="组件路径" name="component">
          <a-select v-model:value="form.component" allow-clear show-search placeholder="选择前端视图组件">
            <a-select-option v-for="c in components" :key="c" :value="c">{{ c }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="form.type !== 'action'" label="菜单图标">
          <a-select v-model:value="form.icon" allow-clear show-search placeholder="选择图标">
            <a-select-option v-for="i in icons" :key="i" :value="i">
              <span class="opt-icon"><component :is="i" /> {{ i }}</span>
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="权限标识">
          <a-input v-model:value="form.permission" placeholder="多个用英文逗号分隔，如 user:list,user:create" />
        </a-form-item>
        <a-form-item label="排序号">
          <a-input-number v-model:value="form.sort" :min="0" :max="999" style="width: 100%" />
        </a-form-item>
        <a-form-item label="显示状态">
          <a-space size="large">
            <a-switch v-model:checked="form.visible" checked-children="显示" un-checked-children="隐藏" />
            <a-switch v-model:checked="form.status" checked-children="启用" un-checked-children="停用" />
          </a-space>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { menuApi } from '@/api'
import { useUserStore } from '@/stores/user'
import { ICON_OPTIONS, getIcon } from '@/utils/icons'
import { SYSTEMS, systemMeta } from '@/utils/systems'
import { viewMap, buildDynamicRoutes } from '@/router'

const user = useUserStore()
const hasPerm = user.hasPerm
const icons = ICON_OPTIONS
const components = Object.keys(viewMap)

const tree = ref([])
const loading = ref(false)

const columns = [
  { title: '菜单名称', key: 'name', width: 200 },
  { title: '类型', key: 'type', width: 100 },
  { title: '所属系统', key: 'sys', width: 140 },
  { title: '路由地址', key: 'path', width: 170 },
  { title: '组件路径', dataIndex: 'component', key: 'component', width: 160 },
  { title: '权限标识', key: 'permission', width: 240 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 70 },
  { title: '显示', key: 'visible', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 190, fixed: 'right' }
]

const typeColor = (t) => ({ dir: 'purple', menu: 'cyan', action: 'blue' }[t] || 'default')
const typeLabel = (t) => ({ dir: '目录', menu: '菜单', action: '按钮' }[t] || t)
const perms = (p) => String(p || '').split(',').map((x) => x.trim()).filter(Boolean)
const resolveIcon = (name) => getIcon(name)

const expandedRowKeys = ref([])

function collectIds(list, out = []) {
  for (const m of list) {
    out.push(m.id)
    if (m.children && m.children.length) collectIds(m.children, out)
  }
  return out
}

async function load() {
  loading.value = true
  try {
    tree.value = (await menuApi.list()).items
    // 数据异步返回，需手动展开已存在的层级
    expandedRowKeys.value = collectIds(tree.value)
  } catch {
    /* 已统一提示 */
  } finally {
    loading.value = false
  }
}

/* ---------- 表单 ---------- */
const formRef = ref()
const formOpen = ref(false)
const saving = ref(false)
const editing = ref(null)
const form = reactive({
  parent_id: undefined,
  name: '',
  path: '',
  redirect: '',
  component: undefined,
  icon: undefined,
  type: 'menu',
  permission: '',
  sort: 0,
  visible: true,
  status: true,
  sys: ''
})

const parentOptions = computed(() => {
  const build = (list) =>
    list.map((m) => ({
      value: m.id,
      title: m.name,
      children: m.children ? build(m.children) : undefined,
      disabled: editing.value ? m.id === editing.value.id : false
    }))
  return [{ value: 0, title: '顶级菜单', children: build(tree.value) }]
})

const rules = {
  name: [{ required: true, message: '请输入菜单名称' }],
  path: [{ required: true, message: '请输入路由地址' }]
}

function resetForm() {
  Object.assign(form, {
    parent_id: undefined,
    name: '',
    path: '',
    redirect: '',
    component: undefined,
    icon: undefined,
    type: 'menu',
    permission: '',
    sort: 0,
    visible: true,
    status: true,
    sys: ''
  })
}

function openCreate(parent) {
  editing.value = null
  resetForm()
  if (parent) {
    form.parent_id = parent.id
    form.type = 'menu'
    // 下级菜单默认继承父级所属系统
    form.sys = parent.sys || ''
  }
  formOpen.value = true
}

function openEdit(row) {
  editing.value = row
  Object.assign(form, {
    parent_id: row.parent_id || undefined,
    name: row.name,
    path: row.path,
    redirect: row.redirect || '',
    component: row.component || undefined,
    icon: row.icon || undefined,
    type: row.type,
    permission: row.permission || '',
    sort: row.sort || 0,
    visible: !!row.visible,
    status: !!row.status,
    sys: row.sys || ''
  })
  formOpen.value = true
}

async function submit() {
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (form.type === 'menu' && !form.component) return message.warning('菜单类型必须选择组件路径')
  saving.value = true
  try {
    if (editing.value) {
      await menuApi.update(editing.value.id, { ...form })
      message.success('菜单已更新')
    } else {
      await menuApi.create({ ...form, parent_id: form.parent_id || 0 })
      message.success('菜单创建成功')
    }
    formOpen.value = false
    // 菜单变化即时同步到侧边栏与路由表
    await user.loadProfile()
    buildDynamicRoutes(user.menus)
    load()
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  try {
    await menuApi.remove(row.id)
    message.success('菜单已删除')
    load()
  } catch (e) {
    message.error(e.message)
  }
}

async function quickToggle(row, field, value) {
  const payload = {
    parent_id: row.parent_id,
    name: row.name,
    path: row.path,
    redirect: row.redirect,
    component: row.component,
    icon: row.icon,
    type: row.type,
    permission: row.permission,
    sort: row.sort,
    visible: !!row.visible,
    status: !!row.status,
    sys: row.sys || '',
    [field]: value
  }
  try {
    await menuApi.update(row.id, payload)
    message.success('已更新')
    load()
  } catch (e) {
    message.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.wa-muted {
  color: var(--wa-muted);
}

.wa-mono {
  font-family: Consolas, monospace;
  font-size: 12px;
}

.menu-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.perm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.opt-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.danger {
  color: #ff7875;
}
</style>
