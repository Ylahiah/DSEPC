import axios from 'axios'
import {
  Activity,
  BarChart3,
  Clock3,
  Eraser,
  Medal,
  RefreshCw,
  TimerReset,
  TrendingUp,
  Trophy,
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  cleanupAdminDashboardTestData,
  getAdminDashboardSummary,
  type AdminDashboardSummary,
  type DashboardCategoryAverage,
  type DashboardRecentSession,
  type DashboardRankingItem,
} from '@/features/admin-dashboard/admin-dashboard-service'
import { useAuth } from '@/features/auth/auth-provider'

const emptyDashboardSummary: AdminDashboardSummary = {
  evaluated_candidates_count: 0,
  total_sessions_count: 0,
  completed_sessions_count: 0,
  active_sessions_count: 0,
  average_score_percentage: 0,
  average_time_seconds: 0,
  best_candidate_name: null,
  best_candidate_score_percentage: null,
  category_averages: [],
  ranking: [],
  recent_sessions: [],
}

function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.detail
    if (typeof apiMessage === 'string') {
      return apiMessage
    }
  }

  return 'No fue posible cargar el dashboard.'
}

function formatPercentage(value: number | null) {
  if (value === null) {
    return '--'
  }

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
    return 'Sin cierre'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<AdminDashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCleaningTestData, setIsCleaningTestData] = useState(false)
  const [cleanupMessage, setCleanupMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const summary = dashboard ?? emptyDashboardSummary

  const metrics = useMemo(
    () => [
      {
        title: 'Candidatos Evaluados',
        value: String(summary.evaluated_candidates_count),
        description: 'Con intentos cerrados',
        icon: UserRoundCheck,
      },
      {
        title: 'Promedio General',
        value: formatPercentage(summary.average_score_percentage),
        description: 'Puntaje global consolidado',
        icon: TrendingUp,
      },
      {
        title: 'Tiempo Promedio',
        value: formatDuration(summary.average_time_seconds),
        description: 'Por sesión completada',
        icon: Clock3,
      },
      {
        title: 'Sesiones Activas',
        value: String(summary.active_sessions_count),
        description: 'En progreso o pendientes',
        icon: TimerReset,
      },
      {
        title: 'Mejor Rendimiento',
        value: summary.best_candidate_name ?? '--',
        description:
          summary.best_candidate_score_percentage === null
            ? 'Sin evaluaciones cerradas'
            : `Puntaje: ${formatPercentage(summary.best_candidate_score_percentage)}`,
        icon: Trophy,
      },
    ],
    [summary],
  )

  useEffect(() => {
    void loadDashboard()
  }, [])

  async function loadDashboard() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const data = await getAdminDashboardSummary()
      setDashboard(data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const [isConfirmCleanupOpen, setIsConfirmCleanupOpen] = useState(false)

  async function handleConfirmCleanup() {
    setIsCleaningTestData(true)
    setCleanupMessage('')
    setErrorMessage('')

    try {
      const result = await cleanupAdminDashboardTestData()
      setCleanupMessage(
        `${result.message} Sesiones eliminadas: ${result.deleted_sessions_count}. Candidatos eliminados: ${result.deleted_candidates_count}.`,
      )
      setIsConfirmCleanupOpen(false)
      await loadDashboard()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsCleaningTestData(false)
    }
  }

  function handleCleanupTestData() {
    setIsConfirmCleanupOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Executive Welcome Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Panel de Control Operativo
            </h1>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/60">
              En Vivo
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Bienvenido, <span className="font-semibold text-slate-700">{user?.full_name}</span>. Monitoreo en tiempo real de evaluaciones, desempeño y ranking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadDashboard()}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCleanupTestData()}
            disabled={isCleaningTestData}
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
          >
            <Eraser className="size-3.5" />
            Depurar pruebas
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {cleanupMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {cleanupMessage}
        </div>
      ) : null}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(({ title, value, description, icon: Icon }) => (
          <div
            key={title}
            className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
              <div className="flex size-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <Icon className="size-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900 truncate">
              {isLoading ? '...' : value}
            </div>
            <p className="mt-1 text-[11px] text-slate-400 truncate">{description}</p>
          </div>
        ))}
      </div>

      {/* Two Column Layout: Ranking & Recent Sessions */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        {/* Top Candidates Ranking */}
        <Card>
          <CardHeader className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Medal className="size-4 text-amber-500" />
                  Ranking de Candidatos
                </CardTitle>
                <CardDescription className="text-xs">
                  Candidatos ordenados por promedio y mejor puntaje
                </CardDescription>
              </div>
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 font-mono">
                Top {summary.ranking.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-2.5">
            {summary.ranking.length ? (
              summary.ranking.slice(0, 6).map((item, index) => (
                <RankingRow key={item.candidate_id} item={item} position={index + 1} />
              ))
            ) : (
              <EmptyStateMessage
                message={
                  isLoading
                    ? 'Cargando ranking...'
                    : 'Aún no hay intentos cerrados para calcular el ranking.'
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Evaluation Attempts */}
        <Card>
          <CardHeader className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Intentos Recientes</CardTitle>
                <CardDescription className="text-xs">
                  Últimas sesiones registradas en el sistema
                </CardDescription>
              </div>
              <a
                href="/admin/reportes"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Ver todos →
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-y border-slate-200 bg-slate-100/90 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Candidato</th>
                    <th className="px-4 py-2 font-semibold">Plantilla</th>
                    <th className="px-4 py-2 font-semibold">Resultado</th>
                    <th className="px-4 py-2 font-semibold">Tiempo</th>
                    <th className="px-4 py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recent_sessions.slice(0, 7).map((session) => (
                    <RecentSessionRow key={session.session_id} session={session} />
                  ))}
                  {!summary.recent_sessions.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        {isLoading ? 'Cargando intentos...' : 'Aún no hay sesiones registradas.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Performance Breakdown */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-blue-600" />
              Promedio por Categoría
            </CardTitle>
            <CardDescription className="text-xs">
              Rendimiento agregado por área técnica en evaluaciones cerradas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-3.5">
            {summary.category_averages.length ? (
              summary.category_averages.map((category) => (
                <CategoryPerformanceRow key={category.category_name} category={category} />
              ))
            ) : (
              <EmptyStateMessage
                message={
                  isLoading
                    ? 'Cargando categorías...'
                    : 'Las categorías aparecerán cuando existan resultados cerrados.'
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Operational Summary Card */}
        <Card>
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-emerald-600" />
              Resumen Operativo del Sistema
            </CardTitle>
            <CardDescription className="text-xs">
              Métricas consolidadas de capacidad y cobertura
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-3 text-xs">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
              <div className="font-semibold text-slate-800">Sesiones Registradas</div>
              <div className="mt-1 text-slate-600">
                {isLoading
                  ? 'Cargando información...'
                  : `${summary.total_sessions_count} intentos totales registrados: ${summary.completed_sessions_count} cerrados y ${summary.active_sessions_count} en curso.`}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
              <div className="font-semibold text-slate-800">Áreas de Evaluación</div>
              <div className="mt-1 text-slate-600">
                {summary.category_averages.length
                  ? `${summary.category_averages.length} categorías con evaluaciones cerradas listas para analítica y dictamen.`
                  : 'Aún no hay suficientes datos para generar analítica por categoría.'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
              <div className="font-semibold text-slate-800">Exportación de Dictámenes</div>
              <div className="mt-1 text-slate-600">
                El módulo de reportes está sincronizado para generar constancias en PDF y sábanas operativas en Excel.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Confirmación para Limpiar Datos de Prueba */}
      <ConfirmDialog
        isOpen={isConfirmCleanupOpen}
        title="Limpiar Datos de Prueba"
        description="Se eliminarán las sesiones registradas y los candidatos que ya no tengan historial evaluativo.\n\nEsta acción reinicia el ranking, las métricas del dashboard y los intentos recientes."
        confirmText="Limpiar Datos"
        cancelText="Cancelar"
        variant="warning"
        isLoading={isCleaningTestData}
        onConfirm={handleConfirmCleanup}
        onClose={() => {
          if (!isCleaningTestData) setIsConfirmCleanupOpen(false)
        }}
      />
    </div>
  )
}

function RankingRow({
  item,
  position,
}: {
  item: DashboardRankingItem
  position: number
}) {
  const isApto = item.average_score_percentage >= 75.0

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white p-3 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex size-7 shrink-0 items-center justify-center rounded-md font-bold text-xs ${
            position === 1
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : position === 2
                ? 'bg-slate-200 text-slate-700'
                : position === 3
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
          }`}
        >
          {position}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-xs text-slate-900 truncate">
            {item.candidate_name}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {item.attempts_count} intento(s) • {item.last_template_name || 'Sin plantilla'}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="flex items-center gap-2 justify-end">
          <span className="font-mono font-bold text-xs text-slate-900">
            {formatPercentage(item.average_score_percentage)}
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
        <div className="text-[10px] text-slate-400 font-mono">
          Mejor: {formatPercentage(item.best_score_percentage)} • {formatDuration(item.average_time_seconds)}
        </div>
      </div>
    </div>
  )
}

function RecentSessionRow({
  session,
}: {
  session: DashboardRecentSession
}) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-4 py-2.5 font-medium text-slate-900">
        {session.candidate_name}
      </td>
      <td className="px-4 py-2.5 text-slate-600">
        <div>{session.template_name}</div>
        <div className="text-[10px] text-slate-400">{formatDateTime(session.submitted_at)}</div>
      </td>
      <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
        {formatPercentage(session.score_percentage)}
      </td>
      <td className="px-4 py-2.5 font-mono text-slate-600">
        {formatDuration(session.consumed_time_seconds)}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={session.status} />
      </td>
    </tr>
  )
}

function CategoryPerformanceRow({
  category,
}: {
  category: DashboardCategoryAverage
}) {
  const progressWidth = `${Math.min(100, Math.max(category.average_score_percentage, 4))}%`

  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200/80 bg-white p-3">
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="font-semibold text-slate-900">{category.category_name}</span>
          <span className="ml-2 text-[11px] text-slate-400">
            ({category.evaluated_sessions} sesiones • {category.total_questions} reactivos)
          </span>
        </div>
        <span className="font-mono font-bold text-slate-900">
          {formatPercentage(category.average_score_percentage)}
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: progressWidth }}
        />
      </div>
    </div>
  )
}

function EmptyStateMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-500">
      {message}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; tone: string }> = {
    completed: {
      label: 'Completada',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    expired: {
      label: 'Expirada',
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    in_progress: {
      label: 'En progreso',
      tone: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    pending: {
      label: 'Pendiente',
      tone: 'border-slate-200 bg-slate-50 text-slate-700',
    },
  }

  const currentStatus = statusMap[status] ?? {
    label: status,
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${currentStatus.tone}`}>
      {currentStatus.label}
    </span>
  )
}
