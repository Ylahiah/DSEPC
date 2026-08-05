import { apiClient } from '@/lib/api-client'

export interface CandidateAccessValidationPayload {
  code: string
}

export interface CandidateAccessValidationResponse {
  valid: boolean
  message: string
  template_name: string | null
  show_result_to_candidate: boolean | null
}

export async function validateCandidateAccessCode(
  payload: CandidateAccessValidationPayload,
) {
  const response = await apiClient.post<CandidateAccessValidationResponse>(
    '/candidate/access-code/validate',
    payload,
  )

  return response.data
}

export async function getActiveAccessCodes() {
  const response = await apiClient.get<string[]>('/candidate/access-code/active')
  return response.data
}

export interface CandidateSessionStartPayload {
  access_code: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  employee_reference?: string
}

export interface CandidateExamOption {
  id: number
  option_text: string
  option_order: number
}

export interface CandidateExamQuestion {
  id: number
  question_id: number
  category_name: string
  question_type: string
  statement: string
  difficulty: string
  score: number
  selected_answer: string | null
  is_answered: boolean
  was_omitted: boolean
  time_spent_seconds: number
  sort_order: number
  excel_exercise?: {
    id: number
    name: string
    instructions: string | null
    workbook_filename: string
  }
  options: CandidateExamOption[]
}

export interface CandidateExamSection {
  id: number
  title: string
  sort_order: number
  time_limit_seconds: number
  consumed_time_seconds: number
  questions: CandidateExamQuestion[]
}

export interface CandidateCategoryResult {
  category_name: string
  total_questions: number
  answered_questions: number
  omitted_questions: number
  correct_questions: number
  incorrect_questions: number
  score_obtained: number
  score_possible: number
}

export interface CandidateSession {
  id: number
  status: string
  started_at: string
  submitted_at: string | null
  expires_at: string
  total_time_seconds: number
  consumed_time_seconds: number
  completed_by_timeout: boolean
  current_section_index: number
  current_question_index: number
  answered_questions_count: number
  omitted_questions_count: number
  correct_questions_count: number
  incorrect_questions_count: number
  average_time_per_question_seconds: number
  total_score: number | null
  show_result_to_candidate: boolean
  template_name: string
  candidate: {
    id: number
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    employee_reference: string | null
  }
  sections: CandidateExamSection[]
  category_results: CandidateCategoryResult[]
}

export interface CandidateAnswerPayload {
  question_id: number
  selected_answer: string
  time_spent_seconds: number
  current_section_index: number
  current_question_index: number
}

export interface CandidateHeartbeatPayload {
  question_id: number
  time_spent_seconds: number
  current_section_index: number
  current_question_index: number
  mark_question_omitted?: boolean
}

export interface CandidateSessionProgress {
  session_id: number
  status: string
  answered_questions: number
  total_questions: number
  omitted_questions: number
  correct_questions: number
  incorrect_questions: number
  current_section_index: number
  current_question_index: number
  consumed_time_seconds: number
  average_time_per_question_seconds: number
  total_score: number | null
}

export interface CandidateSessionCompletion {
  session_id: number
  status: string
  answered_questions: number
  total_questions: number
  omitted_questions: number
  correct_questions: number
  incorrect_questions: number
  consumed_time_seconds: number
  average_time_per_question_seconds: number
  total_score: number | null
  show_result_to_candidate: boolean
  message: string
  category_results: CandidateCategoryResult[]
}

export interface CandidateSessionResultSummary {
  session_id: number
  status: string
  completed_by_timeout: boolean
  answered_questions: number
  total_questions: number
  omitted_questions: number
  correct_questions: number
  incorrect_questions: number
  consumed_time_seconds: number
  total_time_seconds: number
  average_time_per_question_seconds: number
  total_score: number | null
  show_result_to_candidate: boolean
  category_results: CandidateCategoryResult[]
}

export async function startCandidateSession(payload: CandidateSessionStartPayload) {
  const response = await apiClient.post<CandidateSession>('/candidate/sessions/start', payload)
  return response.data
}

export async function getCandidateSession(sessionId: number) {
  const response = await apiClient.get<CandidateSession>(`/candidate/sessions/${sessionId}`)
  return response.data
}

export async function saveCandidateAnswer(
  sessionId: number,
  payload: CandidateAnswerPayload,
) {
  const response = await apiClient.post<CandidateSessionProgress>(
    `/candidate/sessions/${sessionId}/answers`,
    payload,
  )
  return response.data
}

export async function trackCandidateHeartbeat(
  sessionId: number,
  payload: CandidateHeartbeatPayload,
) {
  const response = await apiClient.post<CandidateSessionProgress>(
    `/candidate/sessions/${sessionId}/heartbeat`,
    payload,
  )
  return response.data
}

export async function completeCandidateSession(sessionId: number) {
  const response = await apiClient.post<CandidateSessionCompletion>(
    `/candidate/sessions/${sessionId}/complete`,
  )
  return response.data
}

export async function getCandidateResultSummary(sessionId: number) {
  const response = await apiClient.get<CandidateSessionResultSummary>(
    `/candidate/sessions/${sessionId}/result-summary`,
  )
  return response.data
}

export async function submitExcelAnswer(
  sessionId: number,
  questionId: number,
  workbookBlob: Blob,
  timeSpentSeconds: number,
  currentSectionIndex: number,
  currentQuestionIndex: number,
) {
  const formData = new FormData()
  formData.append('workbook', workbookBlob, 'answer.xlsx')
  formData.append('time_spent_seconds', String(timeSpentSeconds))
  formData.append('current_section_index', String(currentSectionIndex))
  formData.append('current_question_index', String(currentQuestionIndex))

  const response = await apiClient.post<CandidateSessionProgress>(
    `/candidate/sessions/${sessionId}/questions/${questionId}/excel-submission`,
    formData
  )
  return response.data
}

export async function getExcelExerciseDownload(
  sessionId: number,
  questionId: number,
) {
  const response = await apiClient.get(
    `/candidate/sessions/${sessionId}/questions/${questionId}/excel-download`,
    {
      responseType: 'blob',
    },
  )
  return response.data as Blob
}
