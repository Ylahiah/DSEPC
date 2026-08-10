import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getReportSessionDetail, type ReportSessionDetail } from '@/features/reports/reports-service'
import { CheckCircle2, Clock, Target, Trophy, XCircle, MinusCircle } from 'lucide-react'

export function PrintReportPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState<ReportSessionDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    getReportSessionDetail(Number(id))
      .then((data) => {
        setDetail(data)
      })
      .catch((err) => {
        console.error(err)
        setError('Error al cargar el reporte.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    // Automatically open print dialog when data is loaded
    if (detail && !loading) {
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [detail, loading])

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Cargando reporte...</div>
  }

  if (error || !detail) {
    return <div className="p-10 text-center text-red-500">{error || 'Reporte no encontrado'}</div>
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const isApto = detail.score_percentage >= 80

  return (
    <div className="min-h-screen bg-gray-100 py-10 print:bg-white print:py-0 text-gray-800">
      <div className="max-w-4xl mx-auto mb-6 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow flex items-center gap-2"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto rounded-xl overflow-hidden bg-white p-10 border border-gray-200 print:shadow-none print:border-none print:p-0">
        
        {/* Header */}
        <header className="flex justify-between items-end border-b-2 border-gray-100 pb-6 mb-8">
          <div>
            <h3 className="text-sm font-semibold tracking-widest text-blue-600 uppercase mb-1">DSEPC PENSIV</h3>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Reporte Ejecutivo de Evaluacion</h1>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Generado el: <span className="font-medium text-gray-800">{new Date().toLocaleDateString()}</span></p>
            <p>ID de Sesion: <span className="font-medium text-gray-800">#{detail.session_id}</span></p>
          </div>
        </header>

        {/* Candidate Info */}
        <section className="mb-10 flex justify-between items-center bg-gray-50 rounded-xl p-6 border border-gray-100 print:bg-gray-50/50">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Candidato</p>
            <h2 className="text-2xl font-semibold text-gray-900 capitalize">{detail.candidate_name.toLowerCase()}</h2>
          </div>
          <div className="text-center px-6 border-l border-r border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Plantilla</p>
            <p className="text-lg font-medium text-gray-800">{detail.template_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estado</p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 print:border print:border-green-300">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Completado
            </span>
          </div>
        </section>

        {/* KPIs */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Resultados Generales</h3>
          <div className="grid grid-cols-4 gap-4">
            
            {/* Dictamen */}
            <div className={`col-span-4 sm:col-span-1 flex flex-col justify-center rounded-xl p-5 text-white shadow-sm print:shadow-none print:border ${isApto ? 'bg-gradient-to-br from-green-500 to-emerald-600 print:border-green-600 print:text-green-800 print:from-green-50 print:to-green-100' : 'bg-gradient-to-br from-red-500 to-rose-600 print:border-red-600 print:text-red-800 print:from-red-50 print:to-red-100'}`}>
              <p className={`text-sm font-medium uppercase tracking-wider mb-1 ${isApto ? 'text-green-100 print:text-green-700' : 'text-red-100 print:text-red-700'}`}>Dictamen</p>
              <h4 className="text-3xl font-bold mb-1">{isApto ? 'APTO' : 'NO APTO'}</h4>
              <p className={`text-sm ${isApto ? 'text-green-50 print:text-green-600' : 'text-red-50 print:text-red-600'}`}>Umbral 80%</p>
            </div>

            {/* Score */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Trophy className="w-5 h-5" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Puntaje</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{detail.score_percentage}%</span>
              </div>
            </div>

            {/* Precision */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Target className="w-5 h-5" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Precision</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{detail.precision_percentage}%</span>
              </div>
            </div>

            {/* Time */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Tiempo</p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{formatDuration(detail.consumed_time_seconds)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mb-10 page-break-inside-avoid">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Desempeño por Categoria</h3>
          
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Metricas</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progreso</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detail.categories.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{cat.category_name}</p>
                      <p className="text-xs text-gray-500">{cat.total_questions} Reactivos evaluados</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-3 text-sm">
                        <span className="text-green-600 font-medium">{cat.correct_questions} ✔</span>
                        <span className="text-red-500 font-medium">{cat.incorrect_questions} ✘</span>
                        <span className="text-gray-400 font-medium">{cat.omitted_questions} ➖</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 w-48">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 print:border print:border-gray-300">
                        <div className="bg-blue-600 h-2.5 rounded-full print:bg-blue-500" style={{ width: `${cat.score_percentage}%` }}></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-right">{cat.score_percentage}%</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Questions Details */}
        <section className="mb-10 page-break-before-always">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Detalle de Preguntas</h3>
          
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sec.</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pregunta</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Respuesta</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resultado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {detail.questions.map((q, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{q.sort_order}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate" title={q.statement}>{q.statement}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={q.selected_answer || '-'}>{q.selected_answer || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {q.result_label.includes('Correcta') || q.result_label.includes('acierto') ? (
                         <span className="flex items-center gap-1 text-green-600 font-medium">
                           <CheckCircle2 className="w-4 h-4" /> {q.result_label}
                         </span>
                      ) : q.result_label.includes('Incorrecta') ? (
                         <span className="flex items-center gap-1 text-red-500 font-medium">
                           <XCircle className="w-4 h-4" /> {q.result_label}
                         </span>
                      ) : (
                         <span className="flex items-center gap-1 text-gray-400 font-medium">
                           <MinusCircle className="w-4 h-4" /> {q.result_label}
                         </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Signatures */}
        <section className="mt-20 pt-8 border-t border-gray-200 page-break-inside-avoid">
          <div className="grid grid-cols-2 gap-8 px-10">
            <div className="text-center">
              <div className="h-16 border-b border-gray-400 mb-2"></div>
              <p className="text-sm font-semibold text-gray-800 capitalize">{detail.candidate_name.toLowerCase()}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Candidato Evaluado</p>
            </div>
            <div className="text-center">
              <div className="h-16 border-b border-gray-400 mb-2"></div>
              <p className="text-sm font-semibold text-gray-800">Firma del Evaluador / Reclutador</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Responsable DSEPC</p>
            </div>
          </div>
          
          <p className="text-center text-xs text-gray-400 mt-12">
            Reporte confidencial generado por la plataforma DSEPC.<br/>
            Periodo de evaluacion: {new Date(detail.started_at).toLocaleString()} a {detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : 'N/A'}
          </p>
        </section>
      </div>
    </div>
  )
}
