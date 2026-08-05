import { apiClient } from '@/lib/api-client'

export interface AccessCode {
  id: number
  code: string
  evaluation_template_id: number | null
  evaluation_template_name: string | null
  template_is_active: boolean | null
  template_is_valid: boolean | null
  template_validation_message: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface AccessCodePayload {
  code: string
  evaluation_template_id: number | null
  expires_at: string | null
  is_active: boolean
}

export async function getAccessCodes() {
  const response = await apiClient.get<AccessCode[]>('/access-codes')
  return response.data
}

export async function createAccessCode(payload: AccessCodePayload) {
  const response = await apiClient.post<AccessCode>('/access-codes', payload)
  return response.data
}

export async function updateAccessCode(accessCodeId: number, payload: AccessCodePayload) {
  const response = await apiClient.put<AccessCode>(`/access-codes/${accessCodeId}`, payload)
  return response.data
}

export async function setAccessCodeStatus(accessCodeId: number, isActive: boolean) {
  const response = await apiClient.patch<AccessCode>(`/access-codes/${accessCodeId}/status`, {
    is_active: isActive,
  })
  return response.data
}

export async function deleteAccessCode(accessCodeId: number) {
  await apiClient.delete(`/access-codes/${accessCodeId}`)
}
