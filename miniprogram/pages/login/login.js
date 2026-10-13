const api = require('../../utils/api');

Page({
  data: { username: '', password: '', loading: false },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  async submit() {
    let { username, password, loading } = this.data;
    if (loading) return;
    if (!username.trim() || !password) return wx.showToast({ title: '请填写账号和密码', icon: 'none' });
    this.setData({ loading: true });
    try {
      let d = await api.req('/auth/login', 'POST', { username: username.trim(), password });
      wx.setStorageSync('token', d.token);
      wx.setStorageSync('user', d.user);
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) }), 600);
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
