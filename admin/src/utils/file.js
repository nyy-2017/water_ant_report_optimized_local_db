/**
 * 照片地址统一转成同源路径，走 Nginx / Vite 代理转发给后端静态目录，
 * 避免服务部署端口变化后图片无法加载。
 */
export function assetPath(url) {
  if (!url) return ''
  const s = String(url)
  if (!/^https?:\/\//i.test(s)) return s
  try {
    return new URL(s).pathname + new URL(s).search
  } catch {
    return s
  }
}
