import axios from 'axios'
import {
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Sliders,
  Timer,
  Trash2,
  UserRoundCheck,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import {
  deleteReportSession,
  downloadCandidateExcelSubmission,
  downloadGeneralReport,
  downloadSessionReport,
  getReportSessionDetail,
  getReportsSummary,
  updateSessionAssistance,
  type ReportSessionDetail,
  type ReportSessionItem,
  type ReportsSummary,
} from '@/features/reports/reports-service'

const emptySummary: ReportsSummary = {
  generated_at: '',
  evaluated_candidates_count: 0,
  total_finished_sessions: 0,
  average_score_percentage: 0,
  average_time_seconds: 0,
  sessions: [],
}

function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.detail
    if (typeof apiMessage === 'string') {
      return apiMessage
    }
  }

  return 'No fue posible completar la operacion.'
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`
  }
  return `${remainingSeconds}s`
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Sin dato'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Sin dato'
  }

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReportsPage() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'apto' | 'no_apto' | 'assisted'>('all')

  // Modal de ajuste de asistencia técnica
  const [editingSession, setEditingSession] = useState<ReportSessionItem | null>(null)
  const [selectedLevel, setSelectedLevel] = useState('none')
  const [notes, setNotes] = useState('')
  const [isSavingAssistance, setIsSavingAssistance] = useState(false)

  // Modal de Auditoría / Detalle de Respuestas y Descarga de Excel
  const [detailSession, setDetailSession] = useState<ReportSessionItem | null>(null)
  const [sessionDetail, setSessionDetail] = useState<ReportSessionDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<number | null>(null)

  const reportSummary = summary ?? emptySummary

  const metrics = useMemo(
    () => [
      {
        label: 'Candidatos Evaluados',
        value: String(reportSummary.evaluated_candidates_count),
        icon: UserRoundCheck,
        description: 'Total acumulado en plataforma',
      },
      {
        label: 'Sesiones Finalizadas',
        value: String(reportSummary.total_finished_sessions),
        icon: BarChart3,
        description: 'Evaluaciones cerradas',
      },
      {
        label: 'Calificación Promedio',
        value: formatPercentage(reportSummary.average_score_percentage),
        icon: FileText,
        description: 'Puntaje ponderado global',
      },
      {
        label: 'Tiempo Promedio',
        value: formatDuration(reportSummary.average_time_seconds),
        icon: Timer,
        description: 'Por sesión completada',
      },
    ],
    [reportSummary],
  )

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return reportSummary.sessions.filter((session) => {
      const isApto = session.score_percentage >= 75.0
      const isAssisted = session.assistance_level === 'partial' || session.assistance_level === 'full'

      // Filter by status tab
      if (statusFilter === 'apto' && !isApto) return false
      if (statusFilter === 'no_apto' && isApto) return false
      if (statusFilter === 'assisted' && !isAssisted) return false

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = session.candidate_name.toLowerCase().includes(query)
        const matchSessionId = String(session.session_id).includes(query)
        const matchTemplate = session.template_name.toLowerCase().includes(query)
        if (!matchName && !matchSessionId && !matchTemplate) return false
      }

      return true
    })
  }, [reportSummary.sessions, statusFilter, searchQuery])

  // Stats counts for filter badges
  const filterCounts = useMemo(() => {
    let aptos = 0
    let noAptos = 0
    let assisted = 0

    for (const session of reportSummary.sessions) {
      if (session.score_percentage >= 75.0) aptos++
      else noAptos++

      if (session.assistance_level === 'partial' || session.assistance_level === 'full') {
        assisted++
      }
    }

    return {
      all: reportSummary.sessions.length,
      apto: aptos,
      no_apto: noAptos,
      assisted: assisted,
    }
  }, [reportSummary.sessions])

  useEffect(() => {
    void loadSummary()
  }, [])

  useEffect(() => {
    if (!editingSession) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingAssistance) {
        setEditingSession(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [editingSession, isSavingAssistance])

  async function loadSummary() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const data = await getReportsSummary()
      setSummary(data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function handleOpenAssistanceModal(session: ReportSessionItem) {
    setEditingSession(session)
    setSelectedLevel(session.assistance_level || 'none')
    setNotes(session.assistance_notes || '')
  }

  async function handleSaveAssistance() {
    if (!editingSession) return

    setIsSavingAssistance(true)
    setErrorMessage('')
    setFeedbackMessage('')

    try {
      await updateSessionAssistance(editingSession.session_id, {
        assistance_level: selectedLevel,
        assistance_notes: notes.trim() || undefined,
      })
      setFeedbackMessage(
        `Modalidad y asistencia de la sesión #${editingSession.session_id} actualizadas correctamente.`,
      )
      setEditingSession(null)
      await loadSummary()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSavingAssistance(false)
    }
  }

  async function handleOpenDetail(session: ReportSessionItem) {
    setDetailSession(session)
    setIsLoadingDetail(true)
    setSessionDetail(null)
    setErrorMessage('')

    try {
      const data = await getReportSessionDetail(session.session_id)
      setSessionDetail(data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsLoadingDetail(false)
    }
  }

  async function handleDownloadCandidateSubmission(sessionId: number, sessionQuestionId: number) {
    setDownloadingSubmissionId(sessionQuestionId)
    setErrorMessage('')
    setFeedbackMessage('')

    try {
      await downloadCandidateExcelSubmission(sessionId, sessionQuestionId)
      setFeedbackMessage('Archivo entregado por el candidato descargado correctamente.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setDownloadingSubmissionId(null)
    }
  }

  async function handleDownloadGeneral(format: 'pdf' | 'xlsx') {
    setIsDownloading(true)
    setErrorMessage('')
    setFeedbackMessage('')

    try {
      await downloadGeneralReport(format)
      setFeedbackMessage(
        format === 'pdf'
          ? 'Reporte general PDF descargado correctamente.'
          : 'Reporte general Excel descargado correctamente.',
      )
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleDownloadSession(sessionId: number, format: 'pdf' | 'xlsx') {
    setIsDownloading(true)
    setErrorMessage('')
    setFeedbackMessage('')

    try {
      await downloadSessionReport(sessionId, format)
      setFeedbackMessage(
        format === 'pdf'
          ? `Reporte PDF oficial de la sesión #${sessionId} descargado correctamente.`
          : `Reporte Excel de la sesión #${sessionId} descargado correctamente.`,
      )
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDownloading(false)
    }
  }

  const [sessionToDelete, setSessionToDelete] = useState<ReportSessionItem | null>(null)
  const [isDeletingSession, setIsDeletingSession] = useState(false)

  async function handleConfirmDeleteSession() {
    if (!sessionToDelete) return

    setIsDeletingSession(true)
    setErrorMessage('')
    setFeedbackMessage('')

    try {
      const res = await deleteReportSession(sessionToDelete.session_id)
      setFeedbackMessage(res.message || `Sesión #${sessionToDelete.session_id} eliminada correctamente.`)
      setSessionToDelete(null)
      await loadSummary()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDeletingSession(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Reportes Operativos y Dictámenes
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Exportación de resultados individuales y globales, ajuste de asistencia y dictamen de aptitud.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadSummary()}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isDownloading}
            onClick={() => void handleDownloadGeneral('pdf')}
          >
            <FileText className="size-3.5" />
            General PDF
          </Button>
        </div>
      </div>

      {feedbackMessage ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage('')}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <XCircle className="size-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-600 hover:text-rose-900"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* KPI Metrics Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, description }) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
              <div className="flex size-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <Icon className="size-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900">
              {isLoading ? '...' : value}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{description}</p>
          </div>
        ))}
      </div>

      {/* Main Data Grid Container */}
      <Card>
        <CardHeader className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Sesiones Evaluadas</CardTitle>
              <CardDescription className="text-xs">
                {filteredSessions.length} de {reportSummary.sessions.length} evaluaciones mostradas
              </CardDescription>
            </div>

            {/* Live Search and Quick Filter Toolbar */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative min-w-[240px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar candidato, plantilla o ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8.5"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Segmented Filter Pills */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({filterCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('apto')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    statusFilter === 'apto'
                      ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Aptos ({filterCounts.apto})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('no_apto')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    statusFilter === 'no_apto'
                      ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  No Aptos ({filterCounts.no_apto})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('assisted')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    statusFilter === 'assisted'
                      ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Asistidos ({filterCounts.assisted})
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-y border-slate-200 bg-slate-100/90 text-slate-600 backdrop-blur">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">ID</th>
                  <th className="px-4 py-2.5 font-semibold">Candidato</th>
                  <th className="px-4 py-2.5 font-semibold">Plantilla Evaluada</th>
                  <th className="px-4 py-2.5 font-semibold">Modalidad / Asistencia</th>
                  <th className="px-4 py-2.5 font-semibold">Resultado & Dictamen</th>
                  <th className="px-4 py-2.5 font-semibold">Tiempo</th>
                  <th className="px-4 py-2.5 font-semibold">Fecha Cierre</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((session) => (
                  <ReportSessionRow
                    key={session.session_id}
                    session={session}
                    isDownloading={isDownloading}
                    onOpenDetail={() => void handleOpenDetail(session)}
                    onEditAssistance={() => handleOpenAssistanceModal(session)}
                    onDownload={(format) =>
                      void handleDownloadSession(session.session_id, format)
                    }
                    onDelete={() => setSessionToDelete(session)}
                  />
                ))}

                {!filteredSessions.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      {isLoading
                        ? 'Cargando evaluaciones...'
                        : searchQuery || statusFilter !== 'all'
                          ? 'No se encontraron sesiones que coincidan con los filtros aplicados.'
                          : 'Aún no hay sesiones cerradas registradas.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Auditoría / Detalle de Respuestas y Descarga de Excel */}
      {detailSession && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
              onClick={() => setDetailSession(null)}
            >
              <div
                className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header del Modal */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-5 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xs">
                      {detailSession.candidate_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {detailSession.candidate_name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            detailSession.score_percentage >= 75.0
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                          }`}
                        >
                          {detailSession.score_percentage >= 75.0 ? 'Apto' : 'No Apto'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sesión #{detailSession.session_id} • {detailSession.template_name} •{' '}
                        <strong className="text-slate-700 font-mono">
                          {formatPercentage(detailSession.score_percentage)}
                        </strong>{' '}
                        ({formatDuration(detailSession.consumed_time_seconds)})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailSession(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Contenido del Modal (Scrollable) */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                  {isLoadingDetail ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                      <Loader2 className="size-6 animate-spin text-blue-600" />
                      <span>Cargando detalle de respuestas y entregas...</span>
                    </div>
                  ) : sessionDetail ? (
                    <>
                      {/* Desglose de Competencias */}
                      {sessionDetail.categories.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                            Desglose por Competencia
                          </h4>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {sessionDetail.categories.map((cat) => (
                              <div
                                key={cat.category_name}
                                className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3"
                              >
                                <div className="flex items-center justify-between font-semibold text-slate-900">
                                  <span className="truncate">{cat.category_name}</span>
                                  <span className="font-mono text-blue-700">
                                    {cat.score_percentage}%
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                                  <span>
                                    {cat.correct_questions}/{cat.total_questions} aciertos
                                  </span>
                                  <span>{cat.omitted_questions} omitidas</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lista de Reactivos y Entregas */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                          Reactivos Evaluados ({sessionDetail.questions.length})
                        </h4>

                        <div className="space-y-3">
                          {sessionDetail.questions.map((q, idx) => {
                            const isExcel = q.question_type === 'excel_practical'
                            const isCorrect =
                              q.result_label.includes('Correcta') ||
                              q.result_label.includes('acierto')

                            return (
                              <div
                                key={idx}
                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="flex size-5 items-center justify-center rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-600">
                                      {idx + 1}
                                    </span>
                                    <span className="font-semibold text-slate-800">
                                      {q.category_name}
                                    </span>
                                    {isExcel && (
                                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                        Ejercicio Excel
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-slate-400 text-[11px]">
                                      ⏱️ {formatDuration(q.time_spent_seconds)}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        isCorrect
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : q.result_label === 'Omitida'
                                          ? 'bg-slate-100 text-slate-600'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {q.result_label}
                                    </span>
                                  </div>
                                </div>

                                <p className="font-medium text-slate-900 leading-relaxed text-xs">
                                  {q.statement}
                                </p>

                                <div className="rounded-lg bg-slate-50 p-3 space-y-1.5 border border-slate-100 text-[11px]">
                                  <div className="flex items-baseline gap-2">
                                    <span className="font-semibold text-slate-500 w-24 shrink-0">
                                      Respuesta del candidato:
                                    </span>
                                    <span className="font-medium text-slate-900">
                                      {q.selected_answer || 'Sin respuesta / Omitida'}
                                    </span>
                                  </div>

                                  {!isExcel && q.correct_answer && (
                                    <div className="flex items-baseline gap-2">
                                      <span className="font-semibold text-emerald-700 w-24 shrink-0">
                                        Respuesta correcta:
                                      </span>
                                      <span className="font-medium text-emerald-950">
                                        {q.correct_answer}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Botón de Descarga de Archivo Excel entregado */}
                                {isExcel && (
                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                                      <FileSpreadsheet className="size-4 text-emerald-600 shrink-0" />
                                      <span>
                                        {q.practical_submission_filename
                                          ? `Archivo entregado: ${q.practical_submission_filename}`
                                          : 'Archivo de ejercicio práctico'}
                                      </span>
                                    </div>

                                    {q.has_practical_submission ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          void handleDownloadCandidateSubmission(
                                            sessionDetail.session_id,
                                            q.session_question_id || q.question_id || 0,
                                          )
                                        }
                                        disabled={
                                          downloadingSubmissionId ===
                                          (q.session_question_id || q.question_id)
                                        }
                                        className="h-7 text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50 shadow-2xs"
                                      >
                                        {downloadingSubmissionId ===
                                        (q.session_question_id || q.question_id) ? (
                                          <>
                                            <Loader2 className="size-3 animate-spin mr-1.5" />
                                            Descargando...
                                          </>
                                        ) : (
                                          <>
                                            <Download className="size-3 mr-1.5 text-emerald-600" />
                                            Descargar Solución (.xlsx)
                                          </>
                                        )}
                                      </Button>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic">
                                        No se subió archivo para este reactivo
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-3">
                      <XCircle className="size-8 text-rose-500" />
                      <p className="text-sm font-semibold text-slate-800">
                        {errorMessage || 'No fue posible cargar el detalle de la auditoría.'}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleOpenDetail(detailSession)}
                        className="text-xs"
                      >
                        <RefreshCw className="size-3 mr-1" />
                        Reintentar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Footer del Modal */}
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleDownloadSession(detailSession.session_id, 'pdf')}
                      disabled={isDownloading}
                      className="text-xs font-semibold"
                    >
                      <Download className="size-3 mr-1" />
                      Descargar PDF Oficial
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDownloadSession(detailSession.session_id, 'xlsx')}
                      disabled={isDownloading}
                      className="text-xs font-semibold"
                    >
                      <FileSpreadsheet className="size-3 mr-1 text-emerald-600" />
                      Reporte Excel
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailSession(null)}
                    className="text-xs"
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Modal de Ajuste de Asistencia Técnica (Portal a document.body) */}
      {editingSession && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
              onClick={() => {
                if (!isSavingAssistance) {
                  setEditingSession(null)
                }
              }}
            >
              <div
                className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Ajuste de Asistencia Técnica
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sesión #{editingSession.session_id} • {editingSession.candidate_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSession(null)}
                    disabled={isSavingAssistance}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Modalidad de Resolución
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="assistance_level"
                          value="none"
                          checked={selectedLevel === 'none'}
                          onChange={(e) => setSelectedLevel(e.target.value)}
                          className="mt-0.5 accent-blue-600"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            🟢 100% Autónomo (Ponderación Normal)
                          </span>
                          <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                            El candidato resolvió los ejercicios prácticos y teóricos sin intervención.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="assistance_level"
                          value="partial"
                          checked={selectedLevel === 'partial'}
                          onChange={(e) => setSelectedLevel(e.target.value)}
                          className="mt-0.5 accent-blue-600"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            🟡 Asistencia Parcial / Guiado (50% en Prácticos)
                          </span>
                          <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                            Se le brindó orientación técnica o acompañamiento en ejercicios de Excel.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="assistance_level"
                          value="full"
                          checked={selectedLevel === 'full'}
                          onChange={(e) => setSelectedLevel(e.target.value)}
                          className="mt-0.5 accent-blue-600"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            🔴 Asistencia Total / Inducción (0% en Prácticos)
                          </span>
                          <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                            Sesión demostrativa o prueba de entrenamiento no evaluable de forma autónoma.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Observaciones del Evaluador (Opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Se le orientó en la estructura de tablas dinámicas..."
                      rows={3}
                      className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSession(null)}
                    disabled={isSavingAssistance}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveAssistance()}
                    disabled={isSavingAssistance}
                  >
                    {isSavingAssistance ? 'Guardando...' : 'Guardar y Recalcular'}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Modal de Confirmación para Eliminar Sesión */}
      <ConfirmDialog
        isOpen={Boolean(sessionToDelete)}
        title="Eliminar Sesión de Evaluación"
        description={`¿Estás seguro de que deseas eliminar permanentemente la evaluación #${sessionToDelete?.session_id} del candidato "${sessionToDelete?.candidate_name}"?\n\nEsta acción borrará todas sus respuestas, tiempos y métricas asociadas de forma irreversible.`}
        confirmText="Eliminar Sesión"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingSession}
        onConfirm={handleConfirmDeleteSession}
        onClose={() => {
          if (!isDeletingSession) setSessionToDelete(null)
        }}
      />
    </div>
  )
}

function ReportSessionRow({
  session,
  isDownloading,
  onOpenDetail,
  onEditAssistance,
  onDownload,
  onDelete,
}: {
  session: ReportSessionItem
  isDownloading: boolean
  onOpenDetail: () => void
  onEditAssistance: () => void
  onDownload: (format: 'pdf' | 'xlsx') => void
  onDelete: () => void
}) {
  const isApto = session.score_percentage >= 75.0

  return (
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-4 py-3 font-mono text-slate-500 font-medium">
        #{session.session_id}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-left font-semibold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer group flex items-center gap-1.5"
        >
          <span>{session.candidate_name}</span>
          <Eye className="size-3 text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <div className="text-[11px] text-slate-400">
          {session.answered_questions} preguntas registradas
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{session.template_name}</div>
        <div className="text-[11px] text-slate-400">
          {session.completed_by_timeout ? 'Cierre por timeout' : 'Cierre normal'}
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onEditAssistance}
          title="Clic para modificar modalidad de asistencia"
          className="group inline-flex items-center gap-1.5 cursor-pointer"
        >
          {session.assistance_level === 'partial' ? (
            <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 group-hover:bg-amber-100">
              🟡 Guiado (50%)
              <Sliders className="size-3 text-amber-600" />
            </span>
          ) : session.assistance_level === 'full' ? (
            <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 group-hover:bg-rose-100">
              🔴 Asist. Total
              <Sliders className="size-3 text-rose-600" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 group-hover:bg-slate-200">
              🟢 Autónomo
              <Sliders className="size-3 text-slate-400" />
            </span>
          )}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-900">
            {formatPercentage(session.score_percentage)}
          </span>
          <span
            className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${
              isApto
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {isApto ? 'Apto' : 'No Apto'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-slate-600">
        {formatDuration(session.consumed_time_seconds)}
      </td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
        {formatDateTime(session.submitted_at)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenDetail}
            className="h-7 text-xs px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
            title="Auditar respuestas y descargar ejercicios resueltos"
          >
            <Eye className="size-3 mr-1" />
            Auditar
          </Button>
          <a
            href={`/admin/reportes/${session.session_id}/imprimir`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 rounded shadow-2xs transition"
            title="Ver reporte ejecutivo en nueva pestaña"
          >
            <Printer className="size-3" />
            Ver
          </a>
          <Button
            type="button"
            size="sm"
            disabled={isDownloading}
            onClick={() => onDownload('pdf')}
            className="h-7 text-xs px-2"
          >
            <Download className="size-3" />
            PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title={`Eliminar sesión #${session.session_id}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
