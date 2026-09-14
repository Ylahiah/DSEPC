import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Download,
  Mail,
  Percent,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  XCircle,
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
import { Input } from '@/components/ui/input'
import {
  downloadAdminCandidatesExcel,
  getAdminCandidates,
  type DashboardRankingItem,
} from '@/features/admin-dashboard/admin-dashboard-service'

type SortField = 'best_score' | 'avg_score' | 'name' | 'time' | 'attempts' | 'date'
type SortOrder = 'asc' | 'desc'

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remMinutes = minutes % 60
    return `${hours}h ${remMinutes}m`
  }
  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'C'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-sky-100 text-sky-700 border-sky-200',
]

function getAvatarColor(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length]
}

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<DashboardRankingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'apto' | 'no_apto'>('all')
  const [sortField, setSortField] = useState<SortField>('best_score')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  useEffect(() => {
    void loadCandidates()
  }, [])

  async function loadCandidates() {
    setIsLoading(true)
    try {
      const data = await getAdminCandidates()
      setCandidates(data)
    } catch (error) {
      console.error('Error cargando padrón de candidatos:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const { passedCount, failedCount, approvalRate } = useMemo(() => {
    let passed = 0
    let failed = 0
    for (const c of candidates) {
      if (c.is_apto) passed++
      else failed++
    }
    const total = candidates.length
    const rate = total > 0 ? (passed / total) * 100 : 0
    return { passedCount: passed, failedCount: failed, approvalRate: rate }
  }, [candidates])

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return candidates
      .filter((c) => {
        const matchesSearch =
          !query ||
          c.candidate_name.toLowerCase().includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.last_template_name && c.last_template_name.toLowerCase().includes(query))

        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'apto' && c.is_apto) ||
          (statusFilter === 'no_apto' && !c.is_apto)

        return matchesSearch && matchesStatus
      })
      .sort((a, b) => {
        let comp = 0
        if (sortField === 'best_score') {
          comp = a.best_score_percentage - b.best_score_percentage
        } else if (sortField === 'avg_score') {
          comp = a.average_score_percentage - b.average_score_percentage
        } else if (sortField === 'name') {
          comp = a.candidate_name.localeCompare(b.candidate_name)
        } else if (sortField === 'time') {
          comp = a.average_time_seconds - b.average_time_seconds
        } else if (sortField === 'attempts') {
          comp = a.attempts_count - b.attempts_count
        } else if (sortField === 'date') {
          const dateA = a.last_submitted_at ? new Date(a.last_submitted_at).getTime() : 0
          const dateB = b.last_submitted_at ? new Date(b.last_submitted_at).getTime() : 0
          comp = dateA - dateB
        }
        return sortOrder === 'desc' ? -comp : comp
      })
  }, [candidates, searchQuery, statusFilter, sortField, sortOrder])

  const handleDownloadExcel = async () => {
    try {
      setIsDownloading(true)
      await downloadAdminCandidatesExcel()
    } catch (error) {
      console.error(error)
      alert('Error al descargar el archivo Excel.')
    } finally {
      setIsDownloading(false)
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Padrón de Candidatos
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Consulta el historial consolidado, mejores puntajes, promedios y dictamen de aptitud de todos los evaluados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadCandidates()}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleDownloadExcel}
            disabled={isDownloading || candidates.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isDownloading ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Exportar a Excel
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Evaluados
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{candidates.length}</div>
          <p className="mt-1 text-[11px] text-slate-400">Candidatos únicos registrados</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Candidatos Aptos
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{passedCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Superaron el umbral de la plantilla</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Candidatos No Aptos
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-rose-50 text-rose-600">
              <XCircle className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{failedCount}</div>
          <p className="mt-1 text-[11px] text-slate-400">Por debajo del puntaje requerido</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tasa de Aprobación
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-purple-50 text-purple-600">
              <Percent className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {formatPercentage(approvalRate)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Efectividad global del padrón</p>
        </div>
      </div>

      {/* Main Data Grid Card */}
      <Card className="border-slate-200/80 shadow-2xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Padrón Consolidado de Candidatos
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Mostrando {filteredCandidates.length} de {candidates.length} evaluados registrados.
              </CardDescription>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre o correo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>

              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({candidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('apto')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'apto'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  Aptos ({passedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('no_apto')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'no_apto'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  No Aptos ({failedCount})
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 font-medium text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th
                    className="px-5 py-3 cursor-pointer select-none hover:text-slate-800"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Candidato</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-5 py-3">Estatus</th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer select-none hover:text-slate-800"
                    onClick={() => toggleSort('best_score')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Mejor Puntaje</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer select-none hover:text-slate-800"
                    onClick={() => toggleSort('avg_score')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Promedio</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer select-none hover:text-slate-800"
                    onClick={() => toggleSort('time')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Tiempo Prom.</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="px-5 py-3 text-right cursor-pointer select-none hover:text-slate-800"
                    onClick={() => toggleSort('attempts')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Intentos</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <RefreshCw className="mx-auto size-6 animate-spin text-blue-600 mb-2" />
                      Cargando padrón de candidatos...
                    </td>
                  </tr>
                ) : filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <UserCheck className="mx-auto size-10 text-slate-300 stroke-1" />
                      <h3 className="mt-3 text-sm font-semibold text-slate-900">
                        {searchQuery || statusFilter !== 'all'
                          ? 'No se encontraron candidatos con los filtros seleccionados'
                          : 'Aún no hay candidatos evaluados en el sistema'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                        {searchQuery || statusFilter !== 'all'
                          ? 'Intenta ajustar los términos de búsqueda o cambiar el filtro de estatus.'
                          : 'Los candidatos aparecerán aquí automáticamente una vez que completen sus evaluaciones.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((candidate) => {
                    const isApto = candidate.is_apto

                    return (
                      <tr
                        key={candidate.candidate_id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Candidato + Avatar */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold tracking-tight shadow-2xs ${getAvatarColor(
                                candidate.candidate_id,
                              )}`}
                            >
                              {getInitials(candidate.candidate_name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                                {candidate.candidate_name}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                {candidate.email ? (
                                  <span className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                                    <Mail className="size-3 text-slate-400" />
                                    {candidate.email}
                                  </span>
                                ) : null}
                                {candidate.last_template_name ? (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                                    {candidate.last_template_name}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Estatus */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              isApto
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                isApto ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {isApto ? 'Apto' : 'No Apto'}
                          </span>
                        </td>

                        {/* Mejor Puntaje */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div
                            className={`font-mono text-xs sm:text-sm font-bold ${
                              isApto ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {formatPercentage(candidate.best_score_percentage)}
                          </div>
                        </td>

                        {/* Promedio General */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap text-xs sm:text-sm font-mono text-slate-700">
                          {formatPercentage(candidate.average_score_percentage)}
                        </td>

                        {/* Tiempo Promedio */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 text-xs text-slate-600 font-mono">
                            <Clock className="size-3 text-slate-400" />
                            {formatDuration(candidate.average_time_seconds)}
                          </div>
                        </td>

                        {/* Intentos */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-700">
                            {candidate.attempts_count}{' '}
                            {candidate.attempts_count === 1 ? 'intento' : 'intentos'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          {!isLoading && filteredCandidates.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">
              <span>
                Mostrando <strong>{filteredCandidates.length}</strong> de{' '}
                <strong>{candidates.length}</strong> candidatos
              </span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <span className="size-2 rounded-full bg-emerald-500" /> {passedCount} Aptos
                </span>
                <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                  <span className="size-2 rounded-full bg-rose-500" /> {failedCount} No Aptos
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
