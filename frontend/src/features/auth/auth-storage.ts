const AUTH_TOKEN_KEY = 'dsepc.auth.token'
const AUTH_USER_KEY = 'dsepc.auth.user'

export interface AuthUser {
  id: number
  username: string
  full_name: string
  email: string
  role: string
}

export const authStorage = {
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  },
  setToken(token: string) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  },
  clearToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  },
  getUser(): AuthUser | null {
    const raw = localStorage.getItem(AUTH_USER_KEY)

    if (!raw) {
      return null
    }

    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      localStorage.removeItem(AUTH_USER_KEY)
      return null
    }
  },
  setUser(user: AuthUser) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  },
  clearUser() {
    localStorage.removeItem(AUTH_USER_KEY)
  },
  clearSession() {
    this.clearToken()
    this.clearUser()
  },
}
