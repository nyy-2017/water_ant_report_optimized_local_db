const api = require('../../utils/api');

Page({
  data: {
    logged: false,
    user: null,
    stats: { pending: 0, doing: 0, done: 0 }
  },
  onShow() { this.checkAuth(); },
  async checkAuth() {
    if (!wx.getStorageSync('token')) {
      this.setData({ logged: false, user: null, stats: { pending: 0, doing: 0, done: 0 } });
      return;
    }
    try {
      let d = await api.req('/auth/me');
      wx.setStorageSync('user', d.user);
      this.setData({ logged: true, user: d.user });
      this.loadStats();
    } catch (e) {
      // token 失效，清除并提示登录
      wx.removeStorageSync('token');
      wx.removeStorageSync('user');
      this.setData({ logged: false, user: null, stats: { pending: 0, doing: 0, done: 0 } });
    }
  },
  async loadStats() {
    try {
      let d = await api.req('/reports/mine');
      let items = d.items || [];
      this.setData({
        stats: {
          pending: items.filter(i => ['待审核', '待派单', '已派单'].includes(i.status)).length,
          doing: items.filter(i => i.status === '处理中').length,
          done: items.filter(i => i.status === '已完成').length
        }
      });
    } catch (e) { /* 网络失败时保持 0 */ }
  },
  goStats(e) {
    let key = e.currentTarget.dataset.key;
    wx.navigateTo({ url: '/pages/records/records?status=' + key });
  },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }); },
  report() { wx.navigateTo({ url: '/pages/report/report' }); },
  records() { wx.navigateTo({ url: '/pages/records/records' }); }
});
