import axios from 'axios'
import {
  Activity,
  ChartColumnIncreasing,
  Clock3,
  Eraser,
  Medal,
  RefreshCw,
  TimerReset,
  Trophy,
  UserRoundCheck,
  type LucideIcon,
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
    if (Array.isArray(apiMessage)) {
      const validationMessages = apiMessage
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }
          if (item && typeof item === 'object' && 'msg' in item) {
            return String(item.msg)
          }
          return null
        })
        .filter(Boolean)

      if (validationMessages.length) {
        return validationMessages.join(' | ')
      }
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

  return date.toLocaleString()
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
        title: 'Candidatos evaluados',
        value: String(summary.evaluated_candidates_count),
        description: 'Candidatos con al menos un intento cerrado.',
        icon: UserRoundCheck,
      },
      {
        title: 'Promedio general',
        value: formatPercentage(summary.average_score_percentage),
        description: 'Promedio global de aciertos sobre sesiones cerradas.',
        icon: ChartColumnIncreasing,
      },
      {
        title: 'Tiempo promedio',
        value: formatDuration(summary.average_time_seconds),
        description: 'Tiempo consumido por intento finalizado.',
        icon: Clock3,
      },
      {
        title: 'Sesiones activas',
        value: String(summary.active_sessions_count),
        description: 'Intentos pendientes o en progreso en este momento.',
        icon: TimerReset,
      },
      {
        title: 'Mejor candidato',
        value: summary.best_candidate_name ?? '--',
        description:
          summary.best_candidate_score_percentage === null
            ? 'Se mostrara cuando existan evaluaciones cerradas.'
            : `Promedio actual: ${formatPercentage(summary.best_candidate_score_percentage)}`,
        icon: Medal,
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

  async function handleCleanupTestData() {
    const confirmed = window.confirm(
      'Se eliminaran sesiones registradas y candidatos que ya no tengan historial. Esta accion limpia ranking, intentos recientes y metricas del dashboard. Deseas continuar?',
    )

    if (!confirmed) {
      return
    }

    setIsCleaningTestData(true)
    setCleanupMessage('')
    setErrorMessage('')

    try {
      const result = await cleanupAdminDashboardTestData()
      setCleanupMessage(
        `${result.message} Sesiones eliminadas: ${result.deleted_sessions_count}. Candidatos eliminados: ${result.deleted_candidates_count}.`,
      )
      await loadDashboard()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsCleaningTestData(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border bg-[linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(30,41,59,0.94))] p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-300">
              Panel Administrativo
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Bienvenido, {user?.full_name}
            </h2>
            <p className="max-w-2xl text-slate-300">
              Este panel ya consume sesiones reales para mostrar avance operativo,
              rendimiento promedio y ranking de candidatos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
                  <Activity className="size-5 text-sky-300" />
                </div>
                <div>
                  <p className="text-sm font-medium">Estado del modulo</p>
                  <p className="text-sm text-slate-300">Dashboard operativo</p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
              onClick={() => void loadDashboard()}
            >
              <RefreshCw className="size-4" />
              Actualizar
            </Button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {cleanupMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {cleanupMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ title, value, description, icon }) => (
          <MetricCard
            key={title}
            title={title}
            value={isLoading ? '...' : value}
            description={description}
            icon={icon}
          />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Depuracion de datos de prueba</CardTitle>
          <CardDescription>
            Elimina resultados de prueba cuando ya no los necesites. Conserva preguntas,
            categorias, subcategorias, plantillas y codigos de acceso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Que limpia</div>
              <div className="mt-2">
                Sesiones registradas, ranking, intentos recientes y candidatos que queden sin
                historial despues de la limpieza.
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Que conserva</div>
              <div className="mt-2">
                Banco de preguntas, categorias, subcategorias, plantillas y configuracion del
                acceso candidato.
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              <div className="font-medium text-amber-900">Importante</div>
              <div className="mt-2">
                Si hay candidatos respondiendo una evaluacion, su intento tambien sera eliminado.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void handleCleanupTestData()}
              disabled={isCleaningTestData}
            >
              <Eraser className="size-4" />
              {isCleaningTestData ? 'Limpiando datos...' : 'Limpiar datos de prueba'}
            </Button>
            <span className="text-sm text-muted-foreground">
              Estado actual: {summary.total_sessions_count} sesiones registradas.
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ranking de candidatos</CardTitle>
            <CardDescription>
              Promedio y mejor puntaje por candidato usando intentos cerrados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.ranking.length ? (
              summary.ranking.slice(0, 8).map((item, index) => (
                <RankingRow key={item.candidate_id} item={item} position={index + 1} />
              ))
            ) : (
              <EmptyStateMessage
                message={
                  isLoading
                    ? 'Cargando ranking...'
                    : 'Aun no hay intentos cerrados para calcular ranking.'
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intentos recientes</CardTitle>
            <CardDescription>
              Seguimiento rapido de las sesiones mas nuevas y su estado actual.
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
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent_sessions.map((session) => (
                    <RecentSessionRow key={session.session_id} session={session} />
                  ))}
                </tbody>
              </table>
              {!summary.recent_sessions.length ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  {isLoading ? 'Cargando intentos recientes...' : 'Aun no hay sesiones registradas.'}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Promedio por categoria</CardTitle>
            <CardDescription>
              Rendimiento agregado por area de conocimiento en sesiones cerradas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.category_averages.length ? (
              summary.category_averages.map((category) => (
                <CategoryPerformanceRow key={category.category_name} category={category} />
              ))
            ) : (
              <EmptyStateMessage
                message={
                  isLoading
                    ? 'Cargando categorias...'
                    : 'Las categorias apareceran cuando existan resultados cerrados.'
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lectura rapida del modulo</CardTitle>
            <CardDescription>
              Resumen operativo para saber si ya hay datos suficientes para analitica avanzada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="font-medium text-foreground">Sesiones registradas</div>
              <div className="mt-1">
                {isLoading
                  ? 'Cargando informacion...'
                  : `${summary.total_sessions_count} intentos en total, ${summary.completed_sessions_count} cerrados y ${summary.active_sessions_count} activos.`}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="font-medium text-foreground">Cobertura analitica</div>
              <div className="mt-1">
                {summary.category_averages.length
                  ? `Ya hay ${summary.category_averages.length} categorias con datos para comparativos y reportes.`
                  : 'Aun no hay suficientes evaluaciones cerradas para comparativos por categoria.'}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="font-medium text-foreground">Siguiente base disponible</div>
              <div className="mt-1">
                El sistema ya quedo listo para extenderse a reportes PDF/Excel y gestion de historico
                sin rehacer este dashboard.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: LucideIcon
}) {
  return (
    <Card className="bg-card/90">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-3 text-3xl">{value}</CardTitle>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function RankingRow({
  item,
  position,
}: {
  item: DashboardRankingItem
  position: number
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
      <div className="flex gap-4">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {position === 1 ? <Trophy className="size-5" /> : <span className="text-sm">{position}</span>}
        </div>
        <div className="space-y-1">
          <div className="font-medium text-foreground">{item.candidate_name}</div>
          <div className="text-xs text-muted-foreground">
            {item.email || 'Sin correo registrado'}
          </div>
          <div className="text-xs text-muted-foreground">
            {item.attempts_count} intento(s) | Ultima plantilla: {item.last_template_name || 'Sin dato'}
          </div>
        </div>
      </div>

      <div className="text-right text-sm">
        <div className="font-semibold text-foreground">
          {formatPercentage(item.average_score_percentage)}
        </div>
        <div className="text-muted-foreground">
          Mejor: {formatPercentage(item.best_score_percentage)}
        </div>
        <div className="text-muted-foreground">
          Tiempo: {formatDuration(item.average_time_seconds)}
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
    <tr className="border-t border-border/70 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{session.candidate_name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Inicio: {formatDateTime(session.started_at)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{session.template_name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Cierre: {formatDateTime(session.submitted_at)}
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
      <td className="px-4 py-3">
        <div className="space-y-2">
          <StatusBadge status={session.status} />
          {session.completed_by_timeout ? (
            <div className="text-xs text-amber-600">Cerrada por tiempo agotado</div>
          ) : null}
        </div>
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
    <div className="space-y-2 rounded-2xl border border-border p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-medium text-foreground">{category.category_name}</div>
          <div className="text-xs text-muted-foreground">
            {category.evaluated_sessions} sesiones | {category.total_questions} reactivos evaluados
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold text-foreground">
            {formatPercentage(category.average_score_percentage)}
          </div>
          <div className="text-muted-foreground">
            Tiempo promedio: {formatDuration(category.average_time_seconds)}
          </div>
        </div>
      </div>

      <div className="h-2.5 rounded-full bg-muted">
        <div
          className="h-2.5 rounded-full bg-[linear-gradient(90deg,_rgba(14,165,233,1),_rgba(59,130,246,1))]"
          style={{ width: progressWidth }}
        />
      </div>
    </div>
  )
}

function EmptyStateMessage({
  message,
}: {
  message: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: string
}) {
  const statusMap: Record<string, { label: string; tone: string }> = {
    completed: {
      label: 'Completada',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    expired: {
      label: 'Expirada',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    in_progress: {
      label: 'En progreso',
      tone: 'border-sky-200 bg-sky-50 text-sky-700',
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
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${currentStatus.tone}`}>
      {currentStatus.label}
    </span>
  )
}
