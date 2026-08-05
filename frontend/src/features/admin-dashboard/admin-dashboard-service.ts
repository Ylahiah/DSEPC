import { apiClient } from '@/lib/api-client'

export interface DashboardCategoryAverage {
  category_name: string
  average_score_percentage: number
  average_time_seconds: number
  total_questions: number
  evaluated_sessions: number
}

export interface DashboardRankingItem {
  candidate_id: number
  candidate_name: string
  email: string | null
  attempts_count: number
  average_score_percentage: number
  best_score_percentage: number
  average_time_seconds: number
  last_template_name: string | null
  last_status: string | null
  last_submitted_at: string | null
}

export interface DashboardRecentSession {
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

export interface AdminDashboardSummary {
  evaluated_candidates_count: number
  total_sessions_count: number
  completed_sessions_count: number
  active_sessions_count: number
  average_score_percentage: number
  average_time_seconds: number
  best_candidate_name: string | null
  best_candidate_score_percentage: number | null
  category_averages: DashboardCategoryAverage[]
  ranking: DashboardRankingItem[]
  recent_sessions: DashboardRecentSession[]
}

export interface AdminDashboardCleanupResult {
  deleted_sessions_count: number
  deleted_active_sessions_count: number
  deleted_candidates_count: number
  message: string
}

export async function getAdminDashboardSummary() {
  const response = await apiClient.get<AdminDashboardSummary>('/dashboard')
  return response.data
}

export async function cleanupAdminDashboardTestData() {
  const response = await apiClient.post<AdminDashboardCleanupResult>(
    '/dashboard/cleanup-test-data',
  )
  return response.data
}
