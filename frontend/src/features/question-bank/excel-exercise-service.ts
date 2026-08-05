import { apiClient } from '@/lib/api-client'

export interface ExcelExercise {
  id: number
  name: string
  description: string | null
  instructions: string | null
  workbook_filename: string
  solution_filename: string | null
  source_sheet_name: string
  task_sheet_name: string
  target_cells_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ExcelExercisePayload {
  name: string
  description?: string | null
  instructions?: string | null
  source_sheet_name: string
  task_sheet_name: string
  is_active: boolean
  workbook?: File | null
  solution_workbook?: File | null
}

function buildExerciseFormData(payload: ExcelExercisePayload) {
  const formData = new FormData()
  formData.append('name', payload.name)
  formData.append('description', payload.description ?? '')
  formData.append('instructions', payload.instructions ?? '')
  formData.append('source_sheet_name', payload.source_sheet_name)
  formData.append('task_sheet_name', payload.task_sheet_name)
  formData.append('is_active', String(payload.is_active))
  if (payload.workbook) {
    formData.append('workbook', payload.workbook)
  }
  if (payload.solution_workbook) {
    formData.append('solution_workbook', payload.solution_workbook)
  }
  return formData
}

export async function getExcelExercises() {
  const response = await apiClient.get<ExcelExercise[]>('/excel-exercises')
  return response.data
}

export async function createExcelExercise(payload: ExcelExercisePayload) {
  const response = await apiClient.post<ExcelExercise>(
    '/excel-exercises',
    buildExerciseFormData(payload)
  )
  return response.data
}

export async function updateExcelExercise(exerciseId: number, payload: ExcelExercisePayload) {
  const response = await apiClient.put<ExcelExercise>(
    `/excel-exercises/${exerciseId}`,
    buildExerciseFormData(payload)
  )
  return response.data
}

export async function setExcelExerciseStatus(exerciseId: number, isActive: boolean) {
  const response = await apiClient.patch<ExcelExercise>(`/excel-exercises/${exerciseId}/status`, {
    is_active: isActive,
  })
  return response.data
}

export async function deleteExcelExercise(exerciseId: number) {
  await apiClient.delete(`/excel-exercises/${exerciseId}`)
}

export async function downloadExcelExerciseWorkbook(exerciseId: number, filename: string) {
  const response = await apiClient.get<Blob>(`/excel-exercises/${exerciseId}/download`, {
    responseType: 'blob',
  })
  const blobUrl = window.URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(blobUrl)
}
