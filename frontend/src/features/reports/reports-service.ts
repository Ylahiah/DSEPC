import { apiClient } from '@/lib/api-client'

export interface ReportSessionItem {
  session_id: number
  candidate_name: string
  template_name: string
  status: string
  total_score: number | null
  score_percentage: number
  answered_questions: number
  omitted_questions: number
  consumed_time_seconds: number
  started_at: string
  submitted_at: string | null
  completed_by_timeout: boolean
}

export interface ReportsSummary {
  generated_at: string
  evaluated_candidates_count: number
  total_finished_sessions: number
  average_score_percentage: number
  average_time_seconds: number
  sessions: ReportSessionItem[]
}

export interface ReportCategoryMetric {
  category_name: string
  total_questions: number
  answered_questions: number
  omitted_questions: number
  correct_questions: number
  incorrect_questions: number
  score_percentage: number
}

export interface ReportQuestionResult {
  sort_order: number
  category_name: string
  statement: string
  selected_answer: string | null
  correct_answer: string | null
  result_label: string
  time_spent_seconds: number
}

export interface ReportSessionDetail {
  session_id: number
  candidate_name: string
  template_name: string
  status: string
  score_percentage: number
  precision_percentage: number
  consumed_time_seconds: number
  started_at: string
  submitted_at: string | null
  categories: ReportCategoryMetric[]
  questions: ReportQuestionResult[]
}

export async function getReportsSummary() {
  const response = await apiClient.get<ReportsSummary>('/reports/summary')
  return response.data
}

export async function getReportSessionDetail(sessionId: number) {
  const response = await apiClient.get<ReportSessionDetail>(`/reports/sessions/${sessionId}/detail`)
  return response.data
}

export async function downloadGeneralReport(format: 'pdf' | 'xlsx') {
  return downloadReport(`/reports/general.${format}`)
}

export async function downloadSessionReport(sessionId: number, format: 'pdf' | 'xlsx') {
  return downloadReport(`/reports/sessions/${sessionId}.${format}`)
}

async function downloadReport(path: string) {
  const response = await apiClient.get(path, {
    responseType: 'blob',
  })

  const contentDisposition = response.headers['content-disposition']
  const suggestedFilename = getFilenameFromHeader(contentDisposition)
  const fallbackFilename = path.split('/').at(-1) ?? 'reporte'
  const filename = suggestedFilename || fallbackFilename

  const blobUrl = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(blobUrl)
}

function getFilenameFromHeader(header: string | undefined) {
  if (!header) {
    return null
  }

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1])
  }

  const basicMatch = header.match(/filename=\"?([^"]+)\"?/i)
  return basicMatch?.[1] ?? null
}
