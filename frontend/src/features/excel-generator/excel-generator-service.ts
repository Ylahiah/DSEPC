import { apiClient } from '@/lib/api-client'

export interface BlueprintParameterOption {
  id: string
  label: string
  description?: string | null
}

export interface Blueprint {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'basic' | 'intermediate' | 'advanced'
  skills_tested: string[]
  supported_industries: BlueprintParameterOption[]
  default_rows: number
  icon: string
}

export interface GenerateExercisePayload {
  blueprint_id: string
  title: string
  description?: string
  industry_id: string
  difficulty: string
  row_count: number
  save_to_question_bank: boolean
  category_id?: number | null
  subcategory_id?: number | null
  assign_to_template_id?: number | null
  template_section_mode?: 'new_section' | 'existing_section'
  target_section_id?: number | null
  section_time_limit_seconds?: number | null
  section_weight?: number | null
}

export interface GeneratedExerciseSummary {
  exercise_id?: number | null
  question_id?: number | null
  name: string
  blueprint_id: string
  industry: string
  difficulty: string
  row_count: number
  source_sheet_name: string
  task_sheet_name: string
  instructions: string
  criteria_count: number
  total_target_cells: number
  sample_metrics: Record<string, unknown>
  category_id?: number | null
  category_name?: string | null
  subcategory_id?: number | null
  subcategory_name?: string | null
  template_id?: number | null
  template_name?: string | null
  assigned_to_template?: boolean
}

export interface AssignExerciseToTemplatePayload {
  question_id: number
  template_id: number
  mode?: 'new_section' | 'existing_section'
  section_id?: number | null
  time_limit_seconds?: number
  weight_override?: number | null
}

export interface AssignExerciseToTemplateResponse {
  success: boolean
  message: string
  template_id: number
  template_name: string
  section_id: number
}

export async function getBlueprints(): Promise<Blueprint[]> {
  const res = await apiClient.get<Blueprint[]>('/excel-generator/blueprints')
  return res.data
}

export async function downloadPreviewExercise(params: {
  blueprint_id: string
  title: string
  industry_id: string
  difficulty: string
  row_count: number
  variant: 'candidate' | 'solution'
}): Promise<void> {
  const response = await apiClient.get('/excel-generator/preview', {
    params,
    responseType: 'blob',
  })

  const disposition = response.headers['content-disposition'] as string | undefined
  let filename = `${params.title.replace(/\s+/g, '_')}_${params.variant.toUpperCase()}.xlsx`
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^"]+)"?/)
    if (match && match[1]) {
      filename = match[1]
    }
  }

  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function generateAndSaveExercise(
  payload: GenerateExercisePayload,
): Promise<GeneratedExerciseSummary> {
  const res = await apiClient.post<GeneratedExerciseSummary>(
    '/excel-generator/generate',
    payload,
  )
  return res.data
}

export async function assignExerciseToTemplate(
  payload: AssignExerciseToTemplatePayload,
): Promise<AssignExerciseToTemplateResponse> {
  const res = await apiClient.post<AssignExerciseToTemplateResponse>(
    '/excel-generator/assign-to-template',
    payload,
  )
  return res.data
}
