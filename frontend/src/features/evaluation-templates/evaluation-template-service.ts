import { apiClient } from '@/lib/api-client'

export interface EvaluationTemplateSectionPayload {
  category_id: number
  subcategory_id: number | null
  difficulty: string | null
  question_count: number
  time_limit_seconds: number
  weight_override: number | null
  sort_order: number
}

export interface EvaluationTemplatePayload {
  name: string
  description: string | null
  instructions: string | null
  show_result_to_candidate: boolean
  randomize_question_order: boolean
  sections: EvaluationTemplateSectionPayload[]
}

export interface EvaluationTemplateListItem {
  id: number
  name: string
  description: string | null
  is_active: boolean
  show_result_to_candidate: boolean
  randomize_question_order: boolean
  created_at: string
  section_count: number
  total_question_count: number
  total_time_seconds: number
  is_valid: boolean
  validation_message: string
}

export interface EvaluationTemplateSection {
  id: number
  category_id: number
  category_name: string
  subcategory_id: number | null
  subcategory_name: string | null
  difficulty: string | null
  question_count: number
  time_limit_seconds: number
  weight_override: number | null
  sort_order: number
}

export interface EvaluationTemplateDetail {
  id: number
  name: string
  description: string | null
  instructions: string | null
  is_active: boolean
  show_result_to_candidate: boolean
  randomize_question_order: boolean
  created_at: string
  sections: EvaluationTemplateSection[]
  is_valid: boolean
  validation_message: string
  total_question_count: number
  total_time_seconds: number
}

export interface TemplatePreviewSection {
  section_id: number | null
  category_id: number
  category_name: string
  subcategory_id: number | null
  subcategory_name: string | null
  difficulty: string | null
  requested_question_count: number
  available_question_count: number
  sufficient: boolean
  time_limit_seconds: number
  estimated_score: number
  warning: string | null
}

export interface EvaluationTemplatePreview {
  template_id: number | null
  template_name: string
  total_sections: number
  total_requested_questions: number
  total_available_questions: number
  total_time_seconds: number
  estimated_total_score: number
  is_valid: boolean
  validation_message: string
  sections: TemplatePreviewSection[]
}

export async function getEvaluationTemplates() {
  const response = await apiClient.get<EvaluationTemplateListItem[]>('/evaluation-templates')
  return response.data
}

export async function getEvaluationTemplate(templateId: number) {
  const response = await apiClient.get<EvaluationTemplateDetail>(
    `/evaluation-templates/${templateId}`,
  )
  return response.data
}

export async function createEvaluationTemplate(payload: EvaluationTemplatePayload) {
  const response = await apiClient.post<EvaluationTemplateDetail>(
    '/evaluation-templates',
    payload,
  )
  return response.data
}

export async function updateEvaluationTemplate(
  templateId: number,
  payload: EvaluationTemplatePayload,
) {
  const response = await apiClient.put<EvaluationTemplateDetail>(
    `/evaluation-templates/${templateId}`,
    payload,
  )
  return response.data
}

export async function setEvaluationTemplateStatus(templateId: number, isActive: boolean) {
  const response = await apiClient.patch<EvaluationTemplateDetail>(
    `/evaluation-templates/${templateId}/status`,
    {
      is_active: isActive,
    },
  )
  return response.data
}

export async function deleteEvaluationTemplate(templateId: number) {
  await apiClient.delete(`/evaluation-templates/${templateId}`)
}

export async function previewEvaluationTemplate(templateId: number) {
  const response = await apiClient.post<EvaluationTemplatePreview>(
    `/evaluation-templates/${templateId}/preview`,
  )
  return response.data
}
