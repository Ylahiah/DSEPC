import { apiClient } from '@/lib/api-client'

export interface Category {
  id: number
  code: string
  name: string
  description: string | null
  weight: number
  is_active: boolean
  created_at: string
  subcategory_count: number
  question_count: number
}

export interface Subcategory {
  id: number
  category_id: number
  category_name: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  question_count: number
}

export interface QuestionOption {
  id?: number
  option_text: string
  option_order?: number
}

export interface QuestionListItem {
  id: number
  category_id: number
  category_name: string
  subcategory_id: number
  subcategory_name: string
  difficulty: string
  question_type: string
  statement: string
  max_time_seconds: number
  score: number
  is_active: boolean
  option_count: number
  created_at: string
}

export interface QuestionImportRowError {
  row_number: number
  message: string
}

export interface QuestionImportSummary {
  created_categories: number
  created_subcategories: number
  created_questions: number
  errors: QuestionImportRowError[]
}

export interface QuestionDetail {
  id: number
  category_id: number
  category_name: string
  subcategory_id: number
  subcategory_name: string
  excel_exercise_id: number | null
  difficulty: string
  question_type: string
  statement: string
  correct_answer: string
  feedback: string | null
  max_time_seconds: number
  score: number
  is_active: boolean
  created_at: string
  options: QuestionOption[]
}

export interface CategoryPayload {
  code: string
  name: string
  description: string | null
  weight: number
}

export interface SubcategoryPayload {
  category_id: number
  name: string
  description: string | null
}

export interface QuestionPayload {
  category_id: number
  subcategory_id: number
  excel_exercise_id: number | null
  difficulty: string
  question_type: string
  statement: string
  correct_answer: string
  feedback: string | null
  max_time_seconds: number
  score: number
  options: Array<{ option_text: string }>
}

export interface QuestionFilters {
  category_id?: number
  subcategory_id?: number
  difficulty?: string
  is_active?: boolean
  search?: string
}

export async function getCategories() {
  const response = await apiClient.get<Category[]>('/categories')
  return response.data
}

export async function createCategory(payload: CategoryPayload) {
  const response = await apiClient.post<Category>('/categories', payload)
  return response.data
}

export async function updateCategory(categoryId: number, payload: CategoryPayload) {
  const response = await apiClient.put<Category>(`/categories/${categoryId}`, payload)
  return response.data
}

export async function setCategoryStatus(categoryId: number, isActive: boolean) {
  const response = await apiClient.patch<Category>(`/categories/${categoryId}/status`, {
    is_active: isActive,
  })
  return response.data
}

export async function deleteCategory(categoryId: number) {
  await apiClient.delete(`/categories/${categoryId}`)
}

export async function getSubcategories() {
  const response = await apiClient.get<Subcategory[]>('/subcategories')
  return response.data
}

export async function createSubcategory(payload: SubcategoryPayload) {
  const response = await apiClient.post<Subcategory>('/subcategories', payload)
  return response.data
}

export async function updateSubcategory(
  subcategoryId: number,
  payload: SubcategoryPayload,
) {
  const response = await apiClient.put<Subcategory>(
    `/subcategories/${subcategoryId}`,
    payload,
  )
  return response.data
}

export async function setSubcategoryStatus(subcategoryId: number, isActive: boolean) {
  const response = await apiClient.patch<Subcategory>(
    `/subcategories/${subcategoryId}/status`,
    {
      is_active: isActive,
    },
  )
  return response.data
}

export async function deleteSubcategory(subcategoryId: number) {
  await apiClient.delete(`/subcategories/${subcategoryId}`)
}

export async function getQuestions(filters: QuestionFilters = {}) {
  const params = new URLSearchParams()

  if (filters.category_id) {
    params.append('category_id', String(filters.category_id))
  }
  if (filters.subcategory_id) {
    params.append('subcategory_id', String(filters.subcategory_id))
  }
  if (filters.difficulty) {
    params.append('difficulty', filters.difficulty)
  }
  if (typeof filters.is_active === 'boolean') {
    params.append('is_active', String(filters.is_active))
  }
  if (filters.search?.trim()) {
    params.append('search', filters.search.trim())
  }

  const response = await apiClient.get<QuestionListItem[]>('/questions', { params })
  return response.data
}

export async function getQuestion(questionId: number) {
  const response = await apiClient.get<QuestionDetail>(`/questions/${questionId}`)
  return response.data
}

export async function createQuestion(payload: QuestionPayload) {
  const response = await apiClient.post<QuestionDetail>('/questions', payload)
  return response.data
}

export async function updateQuestion(questionId: number, payload: QuestionPayload) {
  const response = await apiClient.put<QuestionDetail>(`/questions/${questionId}`, payload)
  return response.data
}

export async function setQuestionStatus(questionId: number, isActive: boolean) {
  const response = await apiClient.patch<QuestionDetail>(`/questions/${questionId}/status`, {
    is_active: isActive,
  })
  return response.data
}

export async function deleteQuestion(questionId: number) {
  await apiClient.delete(`/questions/${questionId}`)
}

export async function importQuestionsFromExcel(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<QuestionImportSummary>('/questions/import', formData)
  return response.data
}

export async function downloadQuestionImportTemplate() {
  const response = await apiClient.get('/questions/import-template', {
    responseType: 'blob',
  })

  const blobUrl = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = 'plantilla_preguntas_dsepc.xlsx'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(blobUrl)
}
