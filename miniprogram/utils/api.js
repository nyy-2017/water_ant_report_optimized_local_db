const app = getApp();

function req(path, method = 'GET', data = {}) {
  return new Promise((ok, no) => wx.request({
    url: app.globalData.apiBase + path,
    method,
    data,
    header: {
      'content-type': 'application/json',
      'Authorization': wx.getStorageSync('token') ? 'Bearer ' + wx.getStorageSync('token') : ''
    },
    success: r => r.statusCode >= 200 && r.statusCode < 300 ? ok(r.data) : no(new Error(r.data.message || '请求失败')),
    fail: no
  }));
}

function upload(path) {
  return new Promise((ok, no) => wx.uploadFile({
    url: app.globalData.apiBase + '/uploads',
    filePath: path,
    name: 'file',
    header: {
      Authorization: wx.getStorageSync('token') ? 'Bearer ' + wx.getStorageSync('token') : ''
    },
    success: r => {
      try {
        let d = JSON.parse(r.data);
        r.statusCode < 300 ? ok(d) : no(new Error(d.message))
      } catch (e) {
        no(e)
      }
    },
    fail: no
  }));
}
module.exports = {
  req,
  upload
};