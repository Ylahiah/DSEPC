import { apiClient } from '@/lib/api-client'

import type { AuthUser } from './auth-storage'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export async function loginAdmin(payload: LoginPayload) {
  const formData = new URLSearchParams()
  formData.append('username', payload.username)
  formData.append('password', payload.password)

  const response = await apiClient.post<LoginResponse>('/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  return response.data
}

export async function fetchCurrentUser() {
  const response = await apiClient.get<AuthUser>('/auth/me')
  return response.data
}
