const api = require('../../utils/api');

const GENDERS = ['未知', '男', '女'];

/** 角色显示名：优先使用后端返回的 role_name（含自定义角色），旧接口数据按内置角色兜底 */
const ROLE_TEXT = { admin: '管理员', dispatcher: '派单员', reviewer: '审核员', reporter: '居民用户', servers: '上门服务人员' };
const withRoleText = u => Object.assign({}, u, { role_text: u.role_name || ROLE_TEXT[u.role] || '工作人员' });

Page({
  data: {
    logged: false,
    user: null,
    reportCount: 0,
    editing: false,
    saving: false,
    form: { name: '', gender: '未知', phone: '' },
    genders: GENDERS,
    genderIndex: 0
  },
  onShow() { this.checkAuth(); },
  async checkAuth() {
    if (!wx.getStorageSync('token')) {
      this.setData({ logged: false, user: null, editing: false });
      return;
    }
    try {
      let d = await api.req('/auth/me');
      let u = withRoleText(d.user);
      wx.setStorageSync('user', u);
      this.setData({ logged: true, user: u });
      this.loadCount();
    } catch (e) {
      wx.removeStorageSync('token');
      wx.removeStorageSync('user');
      this.setData({ logged: false, user: null, editing: false });
    }
  },
  async loadCount() {
    try {
      let d = await api.req('/reports/mine');
      this.setData({ reportCount: (d.items || []).length });
    } catch (e) { /* 忽略 */ }
  },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },

  /* 查看态 */
  startEdit() {
    let u = this.data.user || {};
    this.setData({
      editing: true,
      form: { name: u.name || '', gender: u.gender || '未知', phone: u.phone || '' },
      genderIndex: Math.max(0, GENDERS.indexOf(u.gender || '未知'))
    });
  },
  cancelEdit() { this.setData({ editing: false }); },

  /* 编辑态 */
  onInput(e) { this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }); },
  onGender(e) {
    let i = +e.detail.value;
    this.setData({ genderIndex: i, 'form.gender': GENDERS[i] });
  },
  async chooseAvatar() {
    try {
      let r = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] });
      let tmp = r.tempFiles[0].tempFilePath;
      wx.showLoading({ title: '上传中' });
      let d = await api.upload(tmp);
      wx.hideLoading();
      this.setData({ 'form.avatar': d.url });
    } catch (e) {
      wx.hideLoading();
      if (e && e.message) wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  async save() {
    if (this.data.saving) return;
    let f = this.data.form;
    if (!f.name.trim()) return wx.showToast({ title: '请填写姓名', icon: 'none' });
    this.setData({ saving: true });
    try {
      let d = await api.req('/auth/profile', 'PATCH', {
        name: f.name.trim(),
        gender: f.gender,
        phone: f.phone.trim(),
        avatar: f.avatar || (this.data.user && this.data.user.avatar) || ''
      });
      let u = withRoleText(d.user);
      wx.setStorageSync('user', u);
      this.setData({ user: u, editing: false, saving: false });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      this.setData({ saving: false });
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      success: r => {
        if (!r.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('user');
        this.setData({ logged: false, user: null, editing: false, reportCount: 0 });
      }
    });
  },
  goRecords() { wx.navigateTo({ url: '/pages/records/records' }); }
});
