const {
  req,
  upload
} = require('../../utils/api');

const today = () => {
  let d = new Date(), p = n => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};

Page({
  data: {
    typeOptions: ['蚊', '蝇', '鼠', '蟑螂', '白蚁'],
    levelOptions: ['轻微', '中', '重'],
    situationOptions: ['看到活虫', '发现巢穴/蚁路', '被叮咬', '发现粪便', '夜间活动', '数量很多', '泥被', '泥线', '纷飞孔'],
    placeOptions: ['厨房', '卫生间', '卧室', '阳台', '户外'],
    busy: false,
    sel: { situation: {}, place: {} },
    f: {
      pest: '',
      level: '',
      situations: [],
      places: [],
      area: '',
      note: '',
      photos: [],
      address: '',
      addressDetail: '',
      latitude: null,
      longitude: null
    }
  },
  input(e) {
    this.setData({ ['f.' + e.currentTarget.dataset.k]: e.detail.value });
  },
  pickType(e) { this.setData({ 'f.pest': e.currentTarget.dataset.v }); },
  pickLevel(e) { this.setData({ 'f.level': e.currentTarget.dataset.v }); },
  toggle(listKey, selKey, v) {
    let arr = this.data.f[listKey].slice(), i = arr.indexOf(v), sel = { ...this.data.sel[selKey], [v]: !this.data.sel[selKey][v] };
    i > -1 ? arr.splice(i, 1) : arr.push(v);
    this.setData({ ['f.' + listKey]: arr, ['sel.' + selKey]: sel });
  },
  toggleSituation(e) { this.toggle('situations', 'situation', e.currentTarget.dataset.v); },
  togglePlace(e) { this.toggle('places', 'place', e.currentTarget.dataset.v); },
  locate() {
    wx.chooseLocation({
      success: r => this.setData({
        'f.address': r.address || r.name || '已选位置',
        'f.latitude': r.latitude,
        'f.longitude': r.longitude
      }),
      fail: () => wx.showToast({ title: '未选择位置', icon: 'none' })
    });
  },
  photos() {
    let n = 5 - this.data.f.photos.length;
    if (!n) return;
    wx.chooseMedia({
      count: n,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: async r => {
        wx.showLoading({ title: '上传照片中' });
        try {
          let ps = this.data.f.photos.slice();
          for (let x of r.tempFiles) ps.push(await upload(x.tempFilePath));
          this.setData({ 'f.photos': ps.slice(0, 5) });
        } catch (e) {
          wx.showToast({ title: e.message || '上传失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },
  removePhoto(e) {
    let i = +e.currentTarget.dataset.i;
    wx.showActionSheet({
      itemList: ['删除这张照片'],
      success: () => {
        let ps = this.data.f.photos.slice();
        ps.splice(i, 1);
        this.setData({ 'f.photos': ps });
      }
    });
  },
  buildDescription(f) {
    let parts = [];
    if (f.level) parts.push('危害程度：' + f.level);
    if (f.situations.length) parts.push('情况：' + f.situations.join('、'));
    if (f.places.length) parts.push('出现位置：' + f.places.join('、'));
    if (f.area) parts.push('房屋面积：' + f.area + '㎡');
    if (f.note) parts.push('补充说明：' + f.note);
    return parts.join('；') || '无补充说明';
  },
  async submit() {
    let f = this.data.f;
    if (!f.pest || !f.level) return wx.showToast({ title: '请选择虫害类型和危害程度', icon: 'none' });
    if (!f.photos.length) return wx.showToast({ title: '请至少上传1张现场照片', icon: 'none' });
    if (f.latitude == null) return wx.showToast({ title: '请在地图上选点', icon: 'none' });
    this.setData({ busy: true });
    try {
      await req('/reports', 'POST', {
        location: f.addressDetail || f.address,
        address: f.address,
        latitude: f.latitude,
        longitude: f.longitude,
        date: today(),
        type: f.pest,
        description: this.buildDescription(f),
        photos: f.photos.map(x => x.url)
      });
      wx.showToast({ title: '提交成功' });
      setTimeout(() => wx.redirectTo({ url: '/pages/records/records' }), 600);
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  }
});
