const { req } = require('../../utils/api');

const GROUP = {
  pending: ['待审核', '待派单', '已派单'],
  doing: ['处理中'],
  done: ['已完成']
};

Page({
  data: {
    items: [],
    filtered: [],
    filters: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待处理' },
      { key: 'doing', label: '处理中' },
      { key: 'done', label: '已完成' }
    ],
    filter: 'all'
  },
  onLoad(options) {
    // 支持从首页统计卡片跳转：?status=pending|doing|done
    if (options && options.status && GROUP[options.status]) {
      this.setData({ filter: options.status });
    }
  },
  onShow() {
    req('/reports/mine')
      .then(r => { this.setData({ items: r.items || [] }); this.applyFilter(); })
      .catch(() => {});
  },
  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key });
    this.applyFilter();
  },
  applyFilter() {
    let { items, filter } = this.data;
    let filtered = filter === 'all' ? items : items.filter(i => GROUP[filter].includes(i.status));
    this.setData({ filtered });
  },
  report() { wx.navigateTo({ url: '/pages/report/report' }); },
  detail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }); }
});
