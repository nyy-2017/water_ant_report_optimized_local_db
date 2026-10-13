const {
  req
} = require('../../utils/api');

// 允许上报人自行取消的状态
const CANCELABLE = ['待审核', '待派单'];

// 后端把「危害程度/情况/出现位置/房屋面积/补充说明」拼接在 description 中：
// 危害程度：轻微；情况：发现巢穴/蚁路；出现位置：厨房；房屋面积：13㎡；补充说明：xxx
function parseDescription(text) {
  let out = {
    level: '',
    situations: '',
    places: '',
    area: '',
    note: ''
  };
  String(text || '').split('；').forEach(part => {
    let i = part.indexOf('：');
    if (i < 0) return;
    let key = part.slice(0, i).trim();
    let val = part.slice(i + 1).trim();
    if (key === '危害程度') out.level = val;
    else if (key === '情况') out.situations = val;
    else if (key === '出现位置') out.places = val;
    else if (key === '房屋面积') out.area = val;
    else if (key === '补充说明') out.note = val;
  });
  return out;
}

Page({
  data: {
    r: null,
    canCancel: false
  },

  onLoad(options) {
    this.id = options.id;
    this.load();
  },

  load() {
    wx.showLoading({ title: '加载中', mask: true });
    req('/reports/' + this.id)
      .then(res => {
        let r = res.item || {};
        let d = parseDescription(r.description);
        // 老数据或未结构化的描述，兜底展示在「说明」中
        if (!d.level && !d.situations && !d.places && !d.area && !d.note && r.description && r.description !== '无补充说明') d.note = r.description;
        Object.assign(r, d);
        r.events = r.events || [];
        r.photos = r.photos || [];
        this.setData({
          r,
          canCancel: CANCELABLE.indexOf(r.status) > -1
        });
      })
      .catch(() => wx.showToast({ title: '加载失败', icon: 'none' }))
      .then(() => wx.hideLoading());
  },

  map() {
    let r = this.data.r;
    if (r.latitude == null || r.longitude == null) return;
    wx.openLocation({
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      name: r.location || r.address,
      address: r.address,
      scale: 16
    });
  },

  preview(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.r.photos
    });
  },

  cancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这条上报订单吗？取消后无法恢复。',
      confirmText: '确认取消',
      cancelText: '再想想',
      success: res => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中', mask: true });
        req('/reports/' + this.id + '/cancel', 'PATCH')
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '订单已取消' });
            this.load();
          })
          .catch(e => {
            wx.hideLoading();
            wx.showToast({ title: (e && e.message) || '取消失败', icon: 'none' });
          });
      }
    });
  }
});
