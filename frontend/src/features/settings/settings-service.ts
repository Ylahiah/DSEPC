import { apiClient } from '@/lib/api-client'

export interface SystemSetting {
  company_name: string
  welcome_message: string
  primary_color: string
  logo_filename: string | null
}

export interface SystemSettingUpdatePayload {
  company_name: string
  welcome_message: string
  primary_color: string
}

export async function getSystemSettings() {
  const response = await apiClient.get<SystemSetting>('/settings/')
  return response.data
}

export async function updateSystemSettings(payload: SystemSettingUpdatePayload) {
  const response = await apiClient.put<SystemSetting>('/settings/', payload)
  return response.data
}

export async function updateSystemLogo(file: File | null) {
  const formData = new FormData()
  if (file) {
    formData.append('file', file)
  }
  
  const response = await apiClient.post<SystemSetting>('/settings/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export function getLogoUrl(): string {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  return `${baseURL}/settings/logo`
}
