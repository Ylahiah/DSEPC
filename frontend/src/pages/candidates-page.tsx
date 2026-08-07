import { CheckCircle2, Search, Users, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  getAdminCandidates,
  type DashboardRankingItem,
} from '@/features/admin-dashboard/admin-dashboard-service'

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`
}

export function CandidatesPage() {
  const [candidates, setCandidates] = useState<DashboardRankingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    void getAdminCandidates()
      .then(setCandidates)
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) {
      return candidates
    }

    const query = searchQuery.toLowerCase()
    return candidates.filter(
      (c) =>
        c.candidate_name.toLowerCase().includes(query) ||
        (c.email && c.email.toLowerCase().includes(query)),
    )
  }, [candidates, searchQuery])

  const { passedCount, failedCount } = useMemo(() => {
    let passed = 0
    let failed = 0
    for (const c of candidates) {
      if (c.best_score_percentage >= 80) passed++
      else failed++
    }
    return { passedCount: passed, failedCount: failed }
  }, [candidates])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Padron de candidatos</h1>
          <p className="text-slate-500">
            Consulta el historial, mejores puntajes y estatus de todos los candidatos evaluados.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <Users className="size-5 text-blue-500" />
            <h3 className="font-medium text-slate-700">Total evaluados</h3>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">{candidates.length}</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-600">
            <CheckCircle2 className="size-5" />
            <h3 className="font-medium text-emerald-800">Candidatos aptos</h3>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-950">{passedCount}</p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-3 text-rose-600">
            <XCircle className="size-5" />
            <h3 className="font-medium text-rose-800">Candidatos no aptos</h3>
          </div>
          <p className="mt-3 text-3xl font-bold text-rose-950">{failedCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nombre o correo..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500">
                <th className="px-5 py-4 font-medium">Candidato</th>
                <th className="px-5 py-4 font-medium">Estatus</th>
                <th className="px-5 py-4 font-medium text-right">Mejor puntaje</th>
                <th className="px-5 py-4 font-medium text-right">Promedio general</th>
                <th className="px-5 py-4 font-medium text-right">Tiempo prom.</th>
                <th className="px-5 py-4 font-medium text-right">Intentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Cargando padron de candidatos...
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    {searchQuery
                      ? 'No se encontraron candidatos que coincidan con la busqueda.'
                      : 'No hay candidatos registrados todavia.'}
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => {
                  const isApto = candidate.best_score_percentage >= 80

                  return (
                    <tr
                      key={candidate.candidate_id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {candidate.candidate_name}
                        </div>
                        {candidate.email && (
                          <div className="mt-0.5 text-xs text-slate-500">{candidate.email}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isApto ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300">
                            Apto
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-300">
                            No Apto
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div
                          className={`inline-flex font-semibold ${
                            isApto ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {formatPercentage(candidate.best_score_percentage)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-slate-600">
                        {formatPercentage(candidate.average_score_percentage)}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-600">
                        {formatDuration(candidate.average_time_seconds)}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-600">
                        {candidate.attempts_count}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
