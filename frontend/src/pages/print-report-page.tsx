import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import {
  Clock,
  Printer,
  ShieldCheck,
  Target,
  Trophy,
  XCircle,
  X,
  Award,
  Download,
  Loader2,
} from 'lucide-react'
import {
  downloadSessionReport,
  getReportSessionDetail,
  type ReportSessionDetail,
} from '@/features/reports/reports-service'
import {
  getLogoUrl,
  getSystemSettings,
  type SystemSetting,
} from '@/features/settings/settings-service'

export function PrintReportPage() {
  const { id } = useParams()
  const reportRef = useRef<HTMLDivElement>(null)
  const [detail, setDetail] = useState<ReportSessionDetail | null>(null)
  const [systemSettings, setSystemSettings] = useState<SystemSetting | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  useEffect(() => {
    if (!id) return

    Promise.all([
      getReportSessionDetail(Number(id)),
      getSystemSettings().catch(() => null),
    ])
      .then(([reportData, settingsData]) => {
        setDetail(reportData)
        if (settingsData) {
          setSystemSettings(settingsData)
        }
      })
      .catch((err) => {
        console.error(err)
        setError('Error al cargar la información del reporte.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  async function handleDownloadDirectPdf() {
    if (!detail) return

    setIsGeneratingPdf(true)
    try {
      await downloadSessionReport(detail.session_id, 'pdf')
    } catch (err) {
      console.error('Error al generar PDF oficial:', err)
      window.print()
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto size-8 animate-spin text-slate-700" />
          <p className="text-sm font-semibold text-slate-700">Generando documento ejecutivo...</p>
        </div>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="border border-slate-300 bg-white p-8 text-center max-w-md">
          <XCircle className="mx-auto size-12 text-rose-600 mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Reporte no disponible</h2>
          <p className="mt-1 text-sm text-slate-600">{error || 'No se encontró la sesión solicitada.'}</p>
          <button
            onClick={() => window.close()}
            className="mt-5 bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Cerrar ventana
          </button>
        </div>
      </div>
    )
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    return `${mins}m ${secs}s`
  }

  const isApto = detail.score_percentage >= 80
  const totalQuestions = detail.questions.length
  const correctCount = detail.categories.reduce((acc, c) => acc + c.correct_questions, 0)

  return (
    <div className="min-h-screen bg-slate-300 py-6 text-slate-900 font-sans antialiased print:bg-white print:py-0">
      
      {/* Estilos CSS estrictos para documento corporativo */}
      <style>{`
        @page {
          size: letter portrait;
          margin: 0;
        }
        @media print {
          html, body {
            width: 215.9mm !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
        .letter-page {
          width: 215.9mm;
          min-height: 279.4mm;
          max-height: 279.4mm;
          padding: 10mm 12mm;
          margin: 0 auto;
          background: #ffffff;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
        }
        .pdf-page-break {
          break-before: page !important;
          page-break-before: always !important;
        }
      `}</style>

      {/* Barra de control en pantalla */}
      <div className="no-print max-w-[215.9mm] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Reporte Ejecutivo de Evaluación</h2>
          <p className="text-xs text-slate-600">Documento Oficial • Tamaño Carta (2 Páginas)</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleDownloadDirectPdf()}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                Descargar PDF
              </>
            )}
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-slate-400 bg-white hover:bg-slate-50 text-slate-800 px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition shadow-sm"
          >
            <Printer className="size-3.5" />
            Imprimir
          </button>

          <button
            onClick={() => window.close()}
            className="flex items-center gap-1 border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 text-xs font-medium transition"
          >
            <X className="size-3.5" />
            Cerrar
          </button>
        </div>
      </div>

      {/* Contenedor del Documento */}
      <div ref={reportRef} className="mx-auto max-w-[215.9mm] space-y-6 print:space-y-0">
        
        {/* ========================================================================= */}
        {/* PÁGINA 1: RESUMEN EJECUTIVO Y DIAGNÓSTICO                                */}
        {/* ========================================================================= */}
        <div className="letter-page flex flex-col justify-between">
          <div className="space-y-4">
            
            {/* Cabecera Formal */}
            <header className="border-b-2 border-slate-900 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {systemSettings?.logo_filename ? (
                    <img
                      src={`${getLogoUrl()}?t=${Date.now()}`}
                      alt="Logo Institucional"
                      className="h-10 max-w-[150px] object-contain"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center bg-slate-900 text-white font-bold text-sm">
                      {(systemSettings?.company_name || 'DSEPC').charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                      {systemSettings?.company_name || 'DSEPC'}
                    </p>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight uppercase">
                      Reporte Ejecutivo de Evaluación
                    </h1>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block border border-slate-400 px-2 py-0.5 text-[11px] font-bold text-slate-900 font-mono">
                    FOLIO #{detail.session_id}
                  </span>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Fecha de Emisión: <span className="font-semibold text-slate-800">{new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </p>
                </div>
              </div>
            </header>

            {/* Ficha Técnica del Candidato */}
            <section className="border border-slate-300 bg-slate-50/60 p-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                    Candidato Evaluado
                  </span>
                  <p className="font-bold text-slate-900 uppercase mt-0.5">
                    {detail.candidate_name}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {detail.submitted_at ? `Evaluación realizada el ${new Date(detail.submitted_at).toLocaleDateString('es-MX')}` : 'En proceso'}
                  </p>
                </div>

                <div className="border-l border-r border-slate-300 px-3">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                    Plantilla / Perfil Evaluado
                  </span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {detail.template_name}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {totalQuestions} Reactivos aplicados
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                    Estatus del Examen
                  </span>
                  <span className="inline-block mt-1 font-bold text-xs uppercase text-slate-900 border-b-2 border-slate-900 pb-0.5">
                    {detail.status === 'completed' ? 'Concluido' : detail.status === 'expired' ? 'Cierre por tiempo' : detail.status}
                  </span>
                  {detail.assistance_level === 'partial' ? (
                    <span className="block mt-0.5 text-[9px] font-bold text-amber-700 uppercase">
                      Asistencia Técnica (50%)
                    </span>
                  ) : detail.assistance_level === 'full' ? (
                    <span className="block mt-0.5 text-[9px] font-bold text-rose-700 uppercase">
                      Asistencia Total (0%)
                    </span>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Indicadores Clave (KPIs) */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                  Resultados Generales de la Evaluación
                </h3>
                <span className="text-[10px] text-slate-500">
                  Umbral mínimo aprobatorio: <strong className="text-slate-800">80%</strong>
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {/* Dictamen */}
                <div
                  className={`border p-2.5 flex flex-col justify-between ${
                    isApto
                      ? 'border-emerald-700 bg-emerald-50/50 text-emerald-950'
                      : 'border-rose-700 bg-rose-50/50 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      Dictamen
                    </span>
                    {isApto ? (
                      <ShieldCheck className="size-4 text-emerald-700" />
                    ) : (
                      <XCircle className="size-4 text-rose-700" />
                    )}
                  </div>
                  <div className="mt-1">
                    <p className={`text-xl font-black tracking-tight ${isApto ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {isApto ? 'APTO' : 'NO APTO'}
                    </p>
                    <p className="text-[9px] font-medium opacity-90 mt-0.5">
                      {isApto ? 'Cumple perfil requerido' : 'Por debajo del umbral'}
                    </p>
                  </div>
                </div>

                {/* Calificación */}
                <div className="border border-slate-300 bg-white p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Calificación
                    </span>
                    <Trophy className="size-4 text-slate-700" />
                  </div>
                  <div className="mt-1">
                    <span className="text-xl font-black text-slate-900">{detail.score_percentage}%</span>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {correctCount} de {totalQuestions} aciertos
                    </p>
                  </div>
                </div>

                {/* Precisión */}
                <div className="border border-slate-300 bg-white p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Precisión
                    </span>
                    <Target className="size-4 text-slate-700" />
                  </div>
                  <div className="mt-1">
                    <span className="text-xl font-black text-slate-900">{detail.precision_percentage}%</span>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      Efectividad en respuestas
                    </p>
                  </div>
                </div>

                {/* Tiempo Total con Eficiencia Operativa */}
                {(() => {
                  const secs = detail.consumed_time_seconds
                  const eff =
                    secs < 25 * 60
                      ? { level: 'ÓPTIMO', desc: 'Dominio ágil y fluido', color: 'text-emerald-700 font-bold' }
                      : secs <= 35 * 60
                      ? { level: 'ACEPTABLE', desc: 'Ritmo normal de trabajo', color: 'text-slate-600 font-semibold' }
                      : { level: 'CRÍTICO', desc: 'Alerta por lentitud operativa', color: 'text-amber-700 font-bold' }

                  return (
                    <div className="border border-slate-300 bg-white p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          Tiempo Total
                        </span>
                        <Clock className="size-4 text-slate-700" />
                      </div>
                      <div className="mt-1">
                        <span className="text-xl font-black text-slate-900">{formatDuration(detail.consumed_time_seconds)}</span>
                        <p className={`text-[8.5px] mt-0.5 leading-tight ${eff.color}`}>
                          <span>{eff.level}:</span> <span className="font-normal text-slate-500">{eff.desc}</span>
                        </p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </section>

            {/* Desempeño por Categoría */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Desglose por Competencia / Área Técnica
              </h3>

              <table className="min-w-full text-left text-xs border border-slate-300" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '26%' }} />
                </colgroup>
                <thead className="bg-slate-100 text-slate-800 text-[10px] font-bold border-b border-slate-300 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-3 py-1.5">Competencia</th>
                    <th scope="col" className="px-2 py-1.5 text-center">Reactivos</th>
                    <th scope="col" className="px-2 py-1.5 text-center">Desglose (✔ / ✘ / ➖)</th>
                    <th scope="col" className="px-3 py-1.5 text-right">Aprovechamiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                  {detail.categories.map((cat, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-semibold text-slate-900 truncate">
                        {cat.category_name}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-700 font-medium">
                        {cat.total_questions}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className="font-semibold text-slate-900">
                          <span className="text-emerald-700">{cat.correct_questions} ✔</span>
                          <span className="mx-1.5 text-slate-300">|</span>
                          <span className="text-rose-700">{cat.incorrect_questions} ✘</span>
                          {cat.omitted_questions > 0 ? (
                            <>
                              <span className="mx-1.5 text-slate-300">|</span>
                              <span className="text-slate-500">{cat.omitted_questions} ➖</span>
                            </>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-slate-200 h-2">
                            <div
                              className={`h-2 ${cat.score_percentage >= 80 ? 'bg-slate-900' : 'bg-slate-500'}`}
                              style={{ width: `${Math.max(4, cat.score_percentage)}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-slate-900 w-8 text-right text-[11px]">
                            {cat.score_percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Dictamen Institucional */}
            <section className="border border-slate-300 bg-slate-50 p-3">
              <div className="flex items-start gap-2.5">
                <Award className="size-4 text-slate-800 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                    Conclusión del Dictamen Institucional
                  </h4>
                  <p className="text-[10px] text-slate-700 mt-0.5 leading-relaxed">
                    {isApto
                      ? `El candidato ${detail.candidate_name} acreditó satisfactoriamente la evaluación con una calificación final de ${detail.score_percentage}%, superando el estándar mínimo institucional del 80% para la posición "${detail.template_name}". Se dictamina como APTO para desempeñar las funciones del puesto.`
                      : `El candidato ${detail.candidate_name} obtuvo una calificación final de ${detail.score_percentage}%, ubicándose por debajo del estándar mínimo del 80% establecido para el puesto "${detail.template_name}". Se dictamina como NO APTO.`}
                    {detail.assistance_level === 'partial'
                      ? ' (Nota de Modalidad: Evaluación realizada con Acompañamiento / Asistencia Técnica en ejercicios prácticos al 50%).'
                      : detail.assistance_level === 'full'
                      ? ' (Nota de Modalidad: Evaluación realizada en Modalidad de Asistencia Total / Inducción Técnica).'
                      : ''}
                    {detail.assistance_notes ? ` [Observaciones: ${detail.assistance_notes}]` : ''}
                  </p>
                </div>
              </div>
            </section>

          </div>

          {/* Pie de Página 1 */}
          <footer className="border-t border-slate-300 pt-2 flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-wider">
            <span>{systemSettings?.company_name || 'DSEPC'} • Reporte Confidencial de Evaluación</span>
            <span>Página 1 de 2</span>
          </footer>
        </div>

        {/* ========================================================================= */}
        {/* PÁGINA 2: DETALLE DE REACTIVOS Y FIRMAS                                  */}
        {/* ========================================================================= */}
        <div className="letter-page pdf-page-break flex flex-col justify-between">
          <div className="space-y-3.5">
            
            {/* Cabecera Secundaria */}
            <header className="border-b border-slate-400 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    Detalle Técnico de Reactivos • {systemSettings?.company_name || 'DSEPC'}
                  </p>
                  <p className="text-xs font-bold text-slate-900 uppercase">
                    Candidato: {detail.candidate_name} <span className="font-normal text-slate-500">({detail.template_name})</span>
                  </p>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-600">
                  FOLIO #{detail.session_id}
                </div>
              </div>
            </header>

            {/* Tabla de Reactivos */}
            <section>
              <table className="min-w-full text-left text-[10px] border border-slate-300" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '40%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead className="bg-slate-100 text-slate-900 font-bold uppercase tracking-wider border-b-2 border-slate-300 text-[9px]">
                  <tr>
                    <th scope="col" className="px-1.5 py-1.5 text-center">#</th>
                    <th scope="col" className="px-2 py-1.5">Área</th>
                    <th scope="col" className="px-2 py-1.5">Planteamiento</th>
                    <th scope="col" className="px-2 py-1.5">Respuesta Registrada</th>
                    <th scope="col" className="px-1.5 py-1.5 text-center">Dictamen</th>
                    <th scope="col" className="px-1.5 py-1.5 text-right">Tiempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {detail.questions.map((q, idx) => {
                    const isCorrect = q.result_label.includes('Correcta') || q.result_label.includes('acierto')
                    const isIncorrect = q.result_label.includes('Incorrecta')
                    return (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="px-1.5 py-1 text-center font-bold text-slate-600 align-top">
                          {q.sort_order}
                        </td>
                        <td className="px-2 py-1 text-slate-600 font-medium align-top break-words">
                          {q.category_name || '-'}
                        </td>
                        <td className="px-2 py-1 text-slate-900 align-top leading-tight break-words">
                          {q.statement}
                        </td>
                        <td className="px-2 py-1 text-slate-800 font-medium align-top break-words">
                          {q.selected_answer || <span className="text-slate-400 italic">Sin responder</span>}
                        </td>
                        <td className="px-1.5 py-1 text-center align-top whitespace-nowrap">
                          {isCorrect ? (
                            <span className="font-bold text-emerald-800 text-[9px]">
                              ✔ Correcta
                            </span>
                          ) : isIncorrect ? (
                            <span className="font-bold text-rose-800 text-[9px]">
                              ✘ Incorrecta
                            </span>
                          ) : (
                            <span className="font-bold text-slate-500 text-[9px]">
                              ➖ Omitida
                            </span>
                          )}
                        </td>
                        <td className="px-1.5 py-1 text-right text-slate-600 font-mono align-top whitespace-nowrap text-[9px]">
                          {formatDuration(q.time_spent_seconds)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>

          </div>

          {/* Bloque Formal de Firmas */}
          <div>
            <section className="pt-2 border-t border-slate-300">
              <div className="grid grid-cols-2 gap-16 px-10 pt-4">
                <div className="text-center">
                  <div className="h-14 border-b border-slate-600 mb-1.5"></div>
                  <p className="text-[10px] font-bold text-slate-900 uppercase">
                    {detail.candidate_name}
                  </p>
                  <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                    Firma de Conformidad del Sustentante
                  </p>
                </div>

                <div className="text-center">
                  <div className="h-14 border-b border-slate-600 mb-1.5"></div>
                  <p className="text-[10px] font-bold text-slate-900 uppercase">
                    Evaluador / Responsable Técnico
                  </p>
                  <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                    Firma y Sello de Validación Técnica
                  </p>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-200 pt-1 text-center text-[7.5px] text-slate-400 leading-tight">
                <p>
                  Documento formal y probatorio emitido electrónicamente por la plataforma {systemSettings?.company_name || 'DSEPC'}.
                </p>
                <p className="mt-0.5">
                  Sesión #{detail.session_id} • Registro: {new Date(detail.started_at).toLocaleString('es-MX')} a {detail.submitted_at ? new Date(detail.submitted_at).toLocaleString('es-MX') : 'N/A'}
                </p>
              </div>
            </section>

            {/* Pie de Página 2 */}
            <footer className="border-t border-slate-300 pt-2 mt-2 flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-wider">
              <span>{systemSettings?.company_name || 'DSEPC'} • Reporte Confidencial de Evaluación</span>
              <span>Página 2 de 2</span>
            </footer>
          </div>
        </div>

      </div>
    </div>
  )
}
