const grab = (ua, re) => { const m = ua.match(re); return m ? m[1] : ''; };

/** 解析请求中的浏览器、系统、IP 与 UA 原文 */
function parseUA(q) {
  const ua = String(q.headers['user-agent'] || '');
  let browser = !ua ? '未知' : '未知浏览器';
  if (/MicroMessenger\/[\d.]+/.test(ua)) browser = '微信 ' + grab(ua, /MicroMessenger\/([\d.]+)/);
  else if (/Edg\/[\d.]+/.test(ua)) browser = 'Edge ' + grab(ua, /Edg\/([\d.]+)/).split('.')[0];
  else if (/OPR\/[\d.]+/.test(ua)) browser = 'Opera ' + grab(ua, /OPR\/([\d.]+)/).split('.')[0];
  else if (/Firefox\/[\d.]+/.test(ua)) browser = 'Firefox ' + grab(ua, /Firefox\/([\d.]+)/).split('.')[0];
  else if (/Chrome\/[\d.]+/.test(ua)) browser = 'Chrome ' + grab(ua, /Chrome\/([\d.]+)/).split('.')[0];
  else if (/Safari\/[\d.]+/.test(ua)) browser = 'Safari ' + grab(ua, /Version\/([\d.]+)/).split('.')[0];
  let os = !ua ? '未知' : '未知系统';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6\.1/.test(ua)) os = 'Windows 7';
  else if (/Android [\d.]+/.test(ua)) os = 'Android ' + grab(ua, /Android ([\d.]+)/);
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS ' + grab(ua, /OS ([\d_]+)/).replace(/_/g, '.');
  else if (/Mac OS X [\d_]+/.test(ua)) os = 'macOS ' + grab(ua, /Mac OS X ([\d_]+)/).replace(/_/g, '.');
  else if (/Linux/.test(ua)) os = 'Linux';
  const rawIp = String(q.ip || (q.headers['x-forwarded-for'] || '').split(',')[0] || '').replace('::ffff:', '').trim();
  return { browser: browser.trim() || '未知', os: os.trim() || '未知', ip: rawIp === '::1' ? '127.0.0.1' : (rawIp || '未知'), ua: ua.slice(0, 500) };
}

module.exports = { parseUA };
