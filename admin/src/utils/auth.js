const TOKEN_KEY = 'water_admin_token'
const USER_KEY = 'water_admin_user'

export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export const getLocalUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}
export const setLocalUser = (u) => (u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY))

export const clearAuth = () => {
  setToken('')
  setLocalUser(null)
}
