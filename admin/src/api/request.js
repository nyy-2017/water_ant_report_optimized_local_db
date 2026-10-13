import axios from 'axios'
import { message } from 'ant-design-vue'
import { getToken, clearAuth } from '@/utils/auth'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 20000
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const resp = error.response
    const text = (resp && resp.data && resp.data.message) || error.message || '网络异常，请稍后重试'
    if (resp && resp.status === 401) {
      clearAuth()
      if (!location.hash.startsWith('#/login')) {
        message.error('登录状态已失效，请重新登录')
        setTimeout(() => location.replace('#/login'), 400)
      }
    } else {
      message.error(text)
    }
    return Promise.reject(new Error(text))
  }
)

export default http
