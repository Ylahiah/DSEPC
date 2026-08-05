import axios from 'axios'
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Timer,
  UserRoundCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  downloadGeneralReport,
  downloadSessionReport,
  getReportsSummary,
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

  return date.toLocaleString()
}

export function ReportsPage() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const reportSummary = summary ?? emptySummary

  const metrics = useMemo(
    () => [
      {
        label: 'Candidatos evaluados',
        value: String(reportSummary.evaluated_candidates_count),
        icon: UserRoundCheck,
      },
      {
        label: 'Sesiones cerradas',
        value: String(reportSummary.total_finished_sessions),
        icon: BarChart3,
      },
      {
        label: 'Promedio general',
        value: formatPercentage(reportSummary.average_score_percentage),
        icon: FileText,
      },
      {
        label: 'Tiempo promedio',
        value: formatDuration(reportSummary.average_time_seconds),
        icon: Timer,
      },
    ],
    [reportSummary],
  )

  useEffect(() => {
    void loadSummary()
  }, [])

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
          ? `Reporte PDF de la sesion ${sessionId} descargado correctamente.`
          : `Reporte Excel de la sesion ${sessionId} descargado correctamente.`,
      )
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border bg-[linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.94))] p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-300">
              Reportes Administrativos
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Exportacion operativa de resultados
            </h2>
            <p className="max-w-3xl text-slate-300">
              Descarga reportes generales e individuales en PDF y Excel usando las
              evaluaciones reales ya registradas en el sistema.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
              onClick={() => void loadSummary()}
            >
              <RefreshCw className="size-4" />
              Actualizar
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              disabled={isDownloading}
              onClick={() => void handleDownloadGeneral('pdf')}
            >
              <FileText className="size-4" />
              General PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl bg-white text-slate-900 hover:bg-slate-100"
              disabled={isDownloading}
              onClick={() => void handleDownloadGeneral('xlsx')}
            >
              <FileSpreadsheet className="size-4" />
              General Excel
            </Button>
          </div>
        </div>
      </section>

      {feedbackMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedbackMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="mt-3 text-3xl">
                  {isLoading ? '...' : value}
                </CardTitle>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Icon className="size-5" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alcance del reporte general</CardTitle>
            <CardDescription>
              El archivo general se genera con consolidado real para direccion y seguimiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {[
              'Resumen ejecutivo con promedio general, candidatos evaluados y tiempos.',
              'Hoja o seccion de sesiones cerradas con puntajes y fechas.',
              'Consolidado por categoria para comparativos.',
              'Ranking de candidatos para identificar desempeno.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sesiones disponibles para reporte individual</CardTitle>
            <CardDescription>
              Cada intento cerrado ya se puede exportar por separado en PDF o Excel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Candidato</th>
                    <th className="px-4 py-3 font-medium">Plantilla</th>
                    <th className="px-4 py-3 font-medium">Resultado</th>
                    <th className="px-4 py-3 font-medium">Tiempo</th>
                    <th className="px-4 py-3 font-medium">Cierre</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reportSummary.sessions.map((session) => (
                    <ReportSessionRow
                      key={session.session_id}
                      session={session}
                      isDownloading={isDownloading}
                      onDownload={(format) =>
                        void handleDownloadSession(session.session_id, format)
                      }
                    />
                  ))}
                </tbody>
              </table>

              {!reportSummary.sessions.length ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  {isLoading
                    ? 'Cargando sesiones...'
                    : 'Aun no hay sesiones cerradas para exportar.'}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function ReportSessionRow({
  session,
  isDownloading,
  onDownload,
}: {
  session: ReportSessionItem
  isDownloading: boolean
  onDownload: (format: 'pdf' | 'xlsx') => void
}) {
  return (
    <tr className="border-t border-border/70 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{session.candidate_name}</div>
        <div className="mt-1 text-xs text-muted-foreground">Sesion #{session.session_id}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{session.template_name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {session.completed_by_timeout ? 'Cerrada por tiempo' : 'Cierre normal'}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">
          {formatPercentage(session.score_percentage)}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Respondidas: {session.answered_questions} | Omitidas: {session.omitted_questions}
        </div>
      </td>
      <td className="px-4 py-3">{formatDuration(session.consumed_time_seconds)}</td>
      <td className="px-4 py-3">{formatDateTime(session.submitted_at)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isDownloading}
            onClick={() => onDownload('pdf')}
          >
            <Download className="size-4" />
            PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isDownloading}
            onClick={() => onDownload('xlsx')}
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
        </div>
      </td>
    </tr>
  )
}
