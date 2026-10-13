import http from './request'

/* ---------------- 认证 ---------------- */
export const authApi = {
  login: (data) => http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
  logout: () => http.post('/auth/logout'),
  updateProfile: (data) => http.patch('/auth/profile', data),
  menus: () => http.get('/auth/menus')
}

/* ---------------- 系统管理：用户 ---------------- */
export const userApi = {
  list: () => http.get('/admin/users'),
  create: (data) => http.post('/admin/users', data),
  update: (id, data) => http.put(`/admin/users/${id}`, data),
  remove: (id) => http.delete(`/admin/users/${id}`),
  setActive: (id, active) => http.patch(`/admin/users/${id}/active`, { active }),
  resetPassword: (id, password) => http.post(`/admin/users/${id}/reset-password`, { password })
}

/* ---------------- 系统管理：角色 ---------------- */
export const roleApi = {
  list: () => http.get('/admin/roles'),
  create: (data) => http.post('/admin/roles', data),
  update: (id, data) => http.put(`/admin/roles/${id}`, data),
  remove: (id) => http.delete(`/admin/roles/${id}`),
  assignMenus: (id, menuIds) => http.put(`/admin/roles/${id}/menus`, { menuIds })
}

/* ---------------- 系统管理：菜单 ---------------- */
export const menuApi = {
  list: () => http.get('/admin/menus'),
  create: (data) => http.post('/admin/menus', data),
  update: (id, data) => http.put(`/admin/menus/${id}`, data),
  remove: (id) => http.delete(`/admin/menus/${id}`)
}

/* ---------------- 操作日志 ---------------- */
export const logApi = {
  list: (params) => http.get('/admin/logs', { params }),
  options: () => http.get('/admin/logs/modules'),
  clear: (before) => http.delete('/admin/logs', { params: before ? { before } : {} })
}

/* ---------------- 隐患工单 ---------------- */
export const reportApi = {
  list: (params) => http.get('/admin/reports', { params }),
  /** 派单可选处理人（拥有处置权限的启用账号） */
  assignees: () => http.get('/admin/reports/assignees'),
  detail: (id) => http.get(`/reports/${id}`),
  review: (id, payload) => http.patch(`/admin/reports/${id}/review`, payload),
  assign: (id, payload) => http.patch(`/admin/reports/${id}/assign`, payload),
  complete: (id, payload) => http.patch(`/admin/reports/${id}/complete`, payload)
}

/* ---------------- 首页看板 ---------------- */
export const dashboardApi = {
  stats: () => http.get('/admin/dashboard')
}
