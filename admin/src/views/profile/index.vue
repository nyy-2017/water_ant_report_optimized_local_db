<template>
  <div>
    <h2 class="page-title">个人中心</h2>
    <p class="page-desc">查看账号信息、所属角色与可访问的功能范围。</p>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="8">
        <section class="panel profile-card">
          <a-avatar :size="76" :style="{ background: 'linear-gradient(135deg,#20c7a5,#178cba)', fontSize: 30 }">
            {{ user.info?.name?.slice(0, 1) || 'U' }}
          </a-avatar>
          <h3>{{ user.info?.name }}</h3>
          <a-tag color="cyan">{{ user.roleName }}</a-tag>
          <a-divider />
          <a-form :label-col="{ span: 7 }" :wrapper-col="{ span: 17 }" size="small">
            <a-form-item label="登录账号"><span class="wa-mono">{{ user.info?.username }}</span></a-form-item>
            <a-form-item label="手机号码">{{ user.info?.phone || '-' }}</a-form-item>
            <a-form-item label="性别">{{ user.info?.gender || '未知' }}</a-form-item>
            <a-form-item label="权限点">{{ user.permissions.length }} 项</a-form-item>
          </a-form>
          <a-divider />
          <a-form :model="profile" :label-col="{ span: 7 }" :wrapper-col="{ span: 17 }" size="small">
            <a-form-item label="姓名">
              <a-input v-model:value="profile.name" />
            </a-form-item>
            <a-form-item label="手机号">
              <a-input v-model:value="profile.phone" placeholder="如 13800138000" />
            </a-form-item>
            <a-form-item label="性别">
              <a-radio-group v-model:value="profile.gender" size="small">
                <a-radio-button value="男">男</a-radio-button>
                <a-radio-button value="女">女</a-radio-button>
                <a-radio-button value="未知">未知</a-radio-button>
              </a-radio-group>
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 7, span: 17 }">
              <a-button type="primary" :loading="saving" @click="save">保存资料</a-button>
            </a-form-item>
          </a-form>
        </section>
      </a-col>

      <a-col :xs="24" :lg="16">
        <section class="panel">
          <header class="panel-head">
            <span class="panel-title">可访问菜单</span>
            <span class="wa-muted">由「{{ user.roleName }}」角色授权</span>
          </header>
          <a-table
            size="small"
            :columns="menuCols"
            :data-source="flatMenus"
            :pagination="false"
            row-key="path"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <span class="menu-name">
                  <component :is="getIcon(record.icon)" />
                  {{ (record.parents || []).join(' / ') ? record.parents.join(' / ') + ' / ' : '' }}{{ record.name }}
                </span>
              </template>
            </template>
          </a-table>
        </section>

        <section class="panel" style="margin-top: 16px">
          <header class="panel-head">
            <span class="panel-title">权限点清单</span>
            <span class="wa-muted">{{ user.permissions.length }} 项</span>
          </header>
          <div class="perm-wall">
            <a-tag v-for="p in user.permissions" :key="p" color="blue">{{ p }}</a-tag>
            <a-empty v-if="!user.permissions.length" description="未分配任何权限点" />
          </div>
        </section>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { authApi } from '@/api'
import { getIcon } from '@/utils/icons'

const user = useUserStore()
const saving = ref(false)

const profile = reactive({ name: '', phone: '', gender: '未知' })
watch(
  () => user.info,
  (v) => {
    if (v) Object.assign(profile, { name: v.name || '', phone: v.phone || '', gender: v.gender || '未知' })
  },
  { immediate: true }
)

function flatten(list, parents = []) {
  const out = []
  for (const m of list) {
    out.push({ path: m.path, name: m.name, icon: m.icon, parents })
    if (m.children && m.children.length) out.push(...flatten(m.children, [...parents, m.name]))
  }
  return out
}

const flatMenus = computed(() => flatten(user.menus))

const menuCols = [
  { title: '菜单路径', dataIndex: 'path', key: 'path', width: 200 },
  { title: '名称', key: 'name' }
]

async function save() {
  saving.value = true
  try {
    const res = await authApi.updateProfile(profile)
    user.info = { ...user.info, ...res.user }
    await user.loadProfile()
    message.success('资料已保存')
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.profile-card {
  text-align: center;
}

.profile-card h3 {
  margin: 12px 0 6px;
  color: var(--wa-text);
}

.wa-mono {
  font-family: Consolas, monospace;
}

.wa-muted {
  color: var(--wa-muted);
}

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

.menu-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.perm-wall {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
