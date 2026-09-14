import axios from 'axios'
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Cpu,
  Download,
  FileCheck,
  FileSpreadsheet,
  Layers3,
  Loader2,
  Plus,
  Scale,
  Search,
  Sparkles,
  Table,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getEvaluationTemplate,
  getEvaluationTemplates,
  type EvaluationTemplateDetail,
  type EvaluationTemplateListItem,
} from '@/features/evaluation-templates/evaluation-template-service'
import {
  assignExerciseToTemplate,
  downloadPreviewExercise,
  generateAndSaveExercise,
  getBlueprints,
  type Blueprint,
  type GeneratedExerciseSummary,
} from '@/features/excel-generator/excel-generator-service'
import {
  getCategories,
  getSubcategories,
  type Category,
  type Subcategory,
} from '@/features/question-bank/question-bank-service'

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d) => (typeof d === 'string' ? d : d?.msg || '')).filter(Boolean).join(' | ')
    }
  }
  return 'Ocurrió un error inesperado al procesar la solicitud.'
}

export function ExcelGeneratorPage() {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([])
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [templates, setTemplates] = useState<EvaluationTemplateListItem[]>([])
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true)

  // Form State
  const [title, setTitle] = useState('')
  const [industryId, setIndustryId] = useState('pharma')
  const [difficulty, setDifficulty] = useState<'basic' | 'intermediate' | 'advanced'>('intermediate')
  const [rowCount, setRowCount] = useState(150)
  const [saveToQuestionBank, setSaveToQuestionBank] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('')

  // Template Direct Assignment Form State
  const [assignDirectlyToTemplate, setAssignDirectlyToTemplate] = useState(false)
  const [targetTemplateId, setTargetTemplateId] = useState<string>('')
  const [templateSectionMode, setTemplateSectionMode] = useState<'new_section' | 'existing_section'>('new_section')
  const [targetTemplateDetail, setTargetTemplateDetail] = useState<EvaluationTemplateDetail | null>(null)
  const [targetSectionId, setTargetSectionId] = useState<string>('')
  const [sectionTimeLimit, setSectionTimeLimit] = useState<string>('900')
  const [sectionWeight, setSectionWeight] = useState<string>('10')

  // Quick Assign Modal State (Post Generation)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [modalTemplateId, setModalTemplateId] = useState<string>('')
  const [modalTemplateDetail, setModalTemplateDetail] = useState<EvaluationTemplateDetail | null>(null)
  const [modalSectionMode, setModalSectionMode] = useState<'new_section' | 'existing_section'>('new_section')
  const [modalSectionId, setModalSectionId] = useState<string>('')
  const [modalTimeLimit, setModalTimeLimit] = useState<string>('900')
  const [modalWeight, setModalWeight] = useState<string>('10')
  const [isAssigning, setIsAssigning] = useState(false)

  // Feedback and Progress
  const [isDownloadingCandidate, setIsDownloadingCandidate] = useState(false)
  const [isDownloadingSolution, setIsDownloadingSolution] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [savedSummary, setSavedSummary] = useState<GeneratedExerciseSummary | null>(null)

  useEffect(() => {
    void loadInitialData()
  }, [])

  async function loadInitialData() {
    setIsLoadingInitialData(true)
    try {
      const [list, cats, subs, tpls] = await Promise.all([
        getBlueprints(),
        getCategories(),
        getSubcategories(),
        getEvaluationTemplates(),
      ])
      setBlueprints(list)
      setCategories(cats)
      setSubcategories(subs)
      setTemplates(tpls)

      if (list.length > 0) {
        handleSelectBlueprint(list[0])
      }

      // Find best default category for practical exercises
      const practicalCat = cats.find((c) => c.name.toLowerCase().includes('práctico') || c.name.toLowerCase().includes('practico'))
      const excelCat = cats.find((c) => c.name.toLowerCase().includes('excel'))
      const defaultCat = practicalCat || excelCat || cats[0]

      if (defaultCat) {
        setSelectedCategoryId(String(defaultCat.id))
        const matchingSub = subs.find((s) => s.category_id === defaultCat.id)
        if (matchingSub) {
          setSelectedSubcategoryId(String(matchingSub.id))
        }
      }

      if (tpls.length > 0) {
        setTargetTemplateId(String(tpls[0].id))
        setModalTemplateId(String(tpls[0].id))
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsLoadingInitialData(false)
    }
  }

  // When Category changes in form, update subcategories
  function handleCategoryChange(categoryId: string) {
    setSelectedCategoryId(categoryId)
    const matchingSubs = subcategories.filter((s) => String(s.category_id) === categoryId)
    if (matchingSubs.length > 0) {
      setSelectedSubcategoryId(String(matchingSubs[0].id))
    } else {
      setSelectedSubcategoryId('')
    }
  }

  // When target template changes in form, fetch template detail for section list
  useEffect(() => {
    if (!targetTemplateId) {
      setTargetTemplateDetail(null)
      return
    }
    void (async () => {
      try {
        const detail = await getEvaluationTemplate(Number(targetTemplateId))
        setTargetTemplateDetail(detail)
        if (detail.sections.length > 0) {
          setTargetSectionId(String(detail.sections[0].id))
        }
      } catch {
        setTargetTemplateDetail(null)
      }
    })()
  }, [targetTemplateId])

  // When modal template changes, fetch detail
  useEffect(() => {
    if (!modalTemplateId) {
      setModalTemplateDetail(null)
      return
    }
    void (async () => {
      try {
        const detail = await getEvaluationTemplate(Number(modalTemplateId))
        setModalTemplateDetail(detail)
        if (detail.sections.length > 0) {
          setModalSectionId(String(detail.sections[0].id))
        }
      } catch {
        setModalTemplateDetail(null)
      }
    })()
  }, [modalTemplateId])

  function handleSelectBlueprint(bp: Blueprint) {
    setSelectedBlueprint(bp)
    setDifficulty(bp.difficulty)
    setRowCount(bp.default_rows)
    if (bp.supported_industries.length > 0) {
      setIndustryId(bp.supported_industries[0].id)
    }
    setTitle(`${bp.title} - ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`)
  }

  async function handleDownloadSample(variant: 'candidate' | 'solution') {
    if (!selectedBlueprint) return

    setErrorMessage('')
    setFeedbackMessage('')
    if (variant === 'candidate') {
      setIsDownloadingCandidate(true)
    } else {
      setIsDownloadingSolution(true)
    }

    try {
      await downloadPreviewExercise({
        blueprint_id: selectedBlueprint.id,
        title: title.trim() || selectedBlueprint.title,
        industry_id: industryId,
        difficulty,
        row_count: rowCount,
        variant,
      })
      setFeedbackMessage(
        variant === 'candidate'
          ? `Archivo de prueba para el candidato descargado correctamente (${difficulty === 'basic' ? 'Nivel Básico' : difficulty === 'intermediate' ? 'Nivel Intermedio' : 'Nivel Avanzado'}).`
          : `Archivo con la solución esperada descargado correctamente (${difficulty === 'basic' ? 'Nivel Básico' : difficulty === 'intermediate' ? 'Nivel Intermedio' : 'Nivel Avanzado'}).`,
      )
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDownloadingCandidate(false)
      setIsDownloadingSolution(false)
    }
  }

  async function handleSaveExercise() {
    if (!selectedBlueprint) return
    if (!title.trim()) {
      setErrorMessage('Por favor ingresa un título para el ejercicio.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    setFeedbackMessage('')
    setSavedSummary(null)

    try {
      const summary = await generateAndSaveExercise({
        blueprint_id: selectedBlueprint.id,
        title: title.trim(),
        industry_id: industryId,
        difficulty,
        row_count: rowCount,
        save_to_question_bank: saveToQuestionBank,
        category_id: selectedCategoryId ? Number(selectedCategoryId) : null,
        subcategory_id: selectedSubcategoryId ? Number(selectedSubcategoryId) : null,
        assign_to_template_id: assignDirectlyToTemplate && targetTemplateId ? Number(targetTemplateId) : null,
        template_section_mode: templateSectionMode,
        target_section_id: templateSectionMode === 'existing_section' && targetSectionId ? Number(targetSectionId) : null,
        section_time_limit_seconds: Number(sectionTimeLimit) || 900,
        section_weight: Number(sectionWeight) || 10,
      })

      setSavedSummary(summary)
      if (summary.assigned_to_template && summary.template_name) {
        setFeedbackMessage(
          `¡Ejercicio "${summary.name}" generado y asignado exitosamente a la plantilla "${summary.template_name}"!`,
        )
      } else {
        setFeedbackMessage(
          `¡Ejercicio "${summary.name}" generado e integrado al Banco de Preguntas exitosamente!`,
        )
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleQuickAssignToTemplate() {
    if (!savedSummary?.question_id) {
      setErrorMessage('El ejercicio generado no cuenta con un reactivo válido en el banco de preguntas.')
      return
    }
    if (!modalTemplateId) {
      setErrorMessage('Por favor selecciona una plantilla de evaluación.')
      return
    }

    setIsAssigning(true)
    setErrorMessage('')
    try {
      const res = await assignExerciseToTemplate({
        question_id: savedSummary.question_id,
        template_id: Number(modalTemplateId),
        mode: modalSectionMode,
        section_id: modalSectionMode === 'existing_section' && modalSectionId ? Number(modalSectionId) : null,
        time_limit_seconds: Number(modalTimeLimit) || 900,
        weight_override: Number(modalWeight) || 10,
      })

      setIsAssignModalOpen(false)
      setFeedbackMessage(res.message)
      setSavedSummary((curr) =>
        curr
          ? {
              ...curr,
              assigned_to_template: true,
              template_id: res.template_id,
              template_name: res.template_name,
            }
          : null,
      )
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsAssigning(false)
    }
  }

  const getBlueprintIcon = (iconName: string) => {
    switch (iconName) {
      case 'Table':
        return <Table className="size-6 text-blue-600" />
      case 'Search':
        return <Search className="size-6 text-emerald-600" />
      case 'CheckSquare':
        return <CheckSquare className="size-6 text-amber-600" />
      case 'Scale':
        return <Scale className="size-6 text-purple-600" />
      default:
        return <FileSpreadsheet className="size-6 text-blue-600" />
    }
  }

  const filteredSubcategories = subcategories.filter(
    (s) => !selectedCategoryId || String(s.category_id) === selectedCategoryId,
  )

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 mb-1.5">
            <Cpu className="size-3.5" />
            MOTOR ALGORÍTMICO OFFLINE (SIN COSTO DE APIS)
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Generador Inteligente de Ejercicios Excel
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Crea libros prácticos de evaluación (.xlsx) con datos sintéticos anti-copia, diseño corporativo y matriz de solución automática.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <Zap className="size-4 text-emerald-600" />
            Generación Instantánea &lt;0.2s
          </span>
        </div>
      </div>

      {/* Messages */}
      {feedbackMessage ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs font-medium text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4.5 shrink-0 text-emerald-600" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage('')}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            ✕
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-xs font-medium text-rose-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-4.5 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-700 hover:text-rose-950 font-bold"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Grid Principal */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Columna Izquierda: Catálogo de Blueprints / Recetas */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              1. Selecciona la Receta de Evaluación ({blueprints.length})
            </h2>
            <span className="text-xs text-slate-400">Esquemas paramétricos validados</span>
          </div>

          {isLoadingInitialData ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
              <Loader2 className="size-8 animate-spin text-blue-600" />
              <span className="text-xs">Cargando catálogo de recetas y categorías...</span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {blueprints.map((bp) => {
                const isSelected = selectedBlueprint?.id === bp.id
                return (
                  <div
                    key={bp.id}
                    onClick={() => handleSelectBlueprint(bp)}
                    className={`group relative cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-600/20'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-white shadow-2xs transition-colors">
                        {getBlueprintIcon(bp.icon)}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          bp.difficulty === 'basic'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : bp.difficulty === 'intermediate'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-purple-200 bg-purple-50 text-purple-700'
                        }`}
                      >
                        {bp.difficulty === 'basic'
                          ? 'Básico'
                          : bp.difficulty === 'intermediate'
                          ? 'Intermedio'
                          : 'Avanzado'}
                      </span>
                    </div>

                    <div className="mt-3">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                        {bp.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {bp.description}
                      </p>
                    </div>

                    {/* Habilidades evaluadas pills */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {bp.skills_tested.slice(0, 3).map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-slate-100/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Características del Motor Algorítmico */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              Garantías del Motor Anti-Copia Local
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Semillas aleatorias para datos únicos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Formatos numéricos de moneda y fecha</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Hoja de Criterios con rangos calculados</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Calificación automática al 100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Parámetros del Generador y Asignación */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              2. Parámetros del Ejercicio
            </h2>
          </div>

          <Card className="border-slate-200/90 shadow-sm">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-blue-600" />
                Configurar y Generar Libro (.xlsx)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Personaliza el escenario, clasifícalo y asígnalo a tus plantillas de evaluación.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4 text-xs">
              {/* Título */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Título del Ejercicio Práctico *
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Análisis de Surtimiento y Ventas Mayo 2026"
                  className="text-xs"
                />
              </div>

              {/* Industria / Giro */}
              {selectedBlueprint && selectedBlueprint.supported_industries.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Industria / Giro del Caso *
                  </Label>
                  <select
                    value={industryId}
                    onChange={(e) => setIndustryId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {selectedBlueprint.supported_industries.map((ind) => (
                      <option key={ind.id} value={ind.id}>
                        {ind.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {selectedBlueprint.supported_industries.find((i) => i.id === industryId)?.description}
                  </p>
                </div>
              )}

              {/* Nivel de Dificultad */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">
                    Nivel de Dificultad
                  </Label>
                  <span className="text-[11px] font-semibold text-blue-700">
                    {difficulty === 'basic'
                      ? '⏱️ 10 min | Fórmulas Básicas'
                      : difficulty === 'intermediate'
                      ? '⏱️ 15 min | Fórmulas Combinadas'
                      : '⏱️ 20 min | Lógica Anidada / Multicriterio'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['basic', 'intermediate', 'advanced'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`rounded-lg border p-2 font-semibold text-center transition-all cursor-pointer text-xs ${
                        difficulty === diff
                          ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-xs ring-1 ring-blue-500/20 font-bold'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {diff === 'basic' ? 'Básico' : diff === 'intermediate' ? 'Intermedio' : 'Avanzado'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Volumen de Filas */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">
                    Volumen de Datos
                  </Label>
                  <span className="font-mono font-bold text-blue-700">
                    {rowCount} transacciones
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[50, 100, 200, 400].map((rows) => (
                    <button
                      key={rows}
                      type="button"
                      onClick={() => setRowCount(rows)}
                      className={`rounded-md border py-1.5 text-center font-mono text-[11px] transition-all cursor-pointer ${
                        rowCount === rows
                          ? 'border-blue-600 bg-blue-600 text-white font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {rows} filas
                    </button>
                  ))}
                </div>
              </div>

              {/* Integración al Banco de Preguntas y Selección de Categoría */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="saveQuestionBank"
                    checked={saveToQuestionBank}
                    onChange={(e) => setSaveToQuestionBank(e.target.checked)}
                    className="size-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="saveQuestionBank" className="text-xs text-slate-700 cursor-pointer">
                    <strong className="block text-slate-900">Vincular al Banco de Preguntas</strong>
                    Registrar automáticamente como reactivo práctico para usarlo en evaluaciones.
                  </label>
                </div>

                {saveToQuestionBank && (
                  <div className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-slate-200/60">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">
                        Categoría Destino *
                      </Label>
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">
                        Subcategoría
                      </Label>
                      <select
                        value={selectedSubcategoryId}
                        onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="">-- Sin subcategoría --</option>
                        {filteredSubcategories.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Asignación Directa a Plantilla de Evaluación */}
              {saveToQuestionBank && (
                <div className="rounded-xl border border-blue-200/90 bg-blue-50/40 p-3 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="assignDirectly"
                      checked={assignDirectlyToTemplate}
                      onChange={(e) => setAssignDirectlyToTemplate(e.target.checked)}
                      className="size-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="assignDirectly" className="text-xs text-slate-800 cursor-pointer">
                      <strong className="block text-blue-950 font-bold">
                        Asignar a una Plantilla de Evaluación
                      </strong>
                      Vincular inmediatamente a una sección de examen al generar el ejercicio.
                    </label>
                  </div>

                  {assignDirectlyToTemplate && (
                    <div className="space-y-2.5 pt-2 border-t border-blue-200/60">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">
                          Seleccionar Plantilla de Evaluación *
                        </Label>
                        <select
                          value={targetTemplateId}
                          onChange={(e) => setTargetTemplateId(e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        >
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.section_count} secciones)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">
                          Modo de Asignación en la Plantilla
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTemplateSectionMode('new_section')}
                            className={`rounded-lg border p-1.5 text-center text-[11px] font-medium cursor-pointer ${
                              templateSectionMode === 'new_section'
                                ? 'border-blue-600 bg-blue-600 text-white font-bold'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            ➕ Nueva Sección Práctica
                          </button>
                          <button
                            type="button"
                            onClick={() => setTemplateSectionMode('existing_section')}
                            className={`rounded-lg border p-1.5 text-center text-[11px] font-medium cursor-pointer ${
                              templateSectionMode === 'existing_section'
                                ? 'border-blue-600 bg-blue-600 text-white font-bold'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            🔄 Sección Existente
                          </button>
                        </div>
                      </div>

                      {templateSectionMode === 'existing_section' && targetTemplateDetail && (
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-slate-700">
                            Sección de la Plantilla a Actualizar *
                          </Label>
                          <select
                            value={targetSectionId}
                            onChange={(e) => setTargetSectionId(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                          >
                            {targetTemplateDetail.sections.map((sec, idx) => (
                              <option key={sec.id} value={sec.id}>
                                Sección {idx + 1}: {sec.category_name} ({sec.question_count} reactivos)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-600">
                            Tiempo Límite (segundos)
                          </Label>
                          <Input
                            type="number"
                            min="60"
                            step="30"
                            value={sectionTimeLimit}
                            onChange={(e) => setSectionTimeLimit(e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-600">
                            Peso de la Sección (pts)
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={sectionWeight}
                            onChange={(e) => setSectionWeight(e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de Acción */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-sm cursor-pointer"
                  onClick={() => void handleSaveExercise()}
                  disabled={isSaving || !selectedBlueprint}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generando y guardando ejercicio...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 text-amber-300" />
                      Generar e Integrar a DSEPC
                    </>
                  )}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold gap-1.5"
                    onClick={() => void handleDownloadSample('candidate')}
                    disabled={isDownloadingCandidate || !selectedBlueprint}
                  >
                    {isDownloadingCandidate ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Download className="size-3 text-blue-600" />
                    )}
                    Muestra Candidato
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold gap-1.5 text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => void handleDownloadSample('solution')}
                    disabled={isDownloadingSolution || !selectedBlueprint}
                  >
                    {isDownloadingSolution ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <FileCheck className="size-3 text-emerald-600" />
                    )}
                    Muestra Solución
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumen del Ejercicio Guardado */}
          {savedSummary && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 space-y-3 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <span>Ejercicio Listo para Evaluaciones</span>
              </div>
              <p className="text-xs text-emerald-950 leading-relaxed">
                El ejercicio <strong>"{savedSummary.name}"</strong> fue creado con <strong>{savedSummary.row_count} filas</strong> y <strong>{savedSummary.criteria_count} criterios</strong> de calificación.
              </p>

              {savedSummary.assigned_to_template && savedSummary.template_name ? (
                <div className="rounded-lg bg-emerald-100/80 p-2.5 text-xs text-emerald-900 border border-emerald-300/80 flex items-center gap-2">
                  <Layers3 className="size-4 text-emerald-700 shrink-0" />
                  <span>
                    Asignado a la plantilla: <strong>{savedSummary.template_name}</strong>
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="/admin/preguntas"
                  className="rounded-lg bg-emerald-700 text-white font-semibold px-3 py-1.5 text-[11px] shadow-2xs hover:bg-emerald-800 transition"
                >
                  Ver en Banco de Preguntas →
                </a>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAssignModalOpen(true)
                    setErrorMessage('')
                  }}
                  className="rounded-lg border-emerald-300 bg-white text-emerald-800 font-semibold px-3 py-1.5 text-[11px] shadow-2xs hover:bg-emerald-50 transition"
                >
                  <Plus className="size-3.5 mr-1" />
                  {savedSummary.assigned_to_template ? 'Asignar a otra Plantilla' : 'Asignar a Plantilla'}
                </Button>

                <a
                  href="/admin/plantillas"
                  className="rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold px-3 py-1.5 text-[11px] shadow-2xs hover:bg-slate-50 transition"
                >
                  Ir a Plantillas →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Asignar a Plantilla de Evaluación */}
      {isAssignModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Layers3 className="size-4.5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Asignar Ejercicio a Plantilla
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {errorMessage ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-slate-600">
                  <strong className="block text-slate-900 mb-0.5">Ejercicio seleccionado:</strong>
                  {savedSummary?.name}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Plantilla de Evaluación *
                  </Label>
                  <select
                    value={modalTemplateId}
                    onChange={(e) => setModalTemplateId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.section_count} secciones)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Modo de Inserción
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalSectionMode('new_section')}
                      className={`rounded-lg border p-2 text-center text-xs font-medium cursor-pointer ${
                        modalSectionMode === 'new_section'
                          ? 'border-blue-600 bg-blue-600 text-white font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      ➕ Nueva Sección
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalSectionMode('existing_section')}
                      className={`rounded-lg border p-2 text-center text-xs font-medium cursor-pointer ${
                        modalSectionMode === 'existing_section'
                          ? 'border-blue-600 bg-blue-600 text-white font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      🔄 Sección Existente
                    </button>
                  </div>
                </div>

                {modalSectionMode === 'existing_section' && modalTemplateDetail && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Sección a Actualizar
                    </Label>
                    <select
                      value={modalSectionId}
                      onChange={(e) => setModalSectionId(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      {modalTemplateDetail.sections.map((sec, idx) => (
                        <option key={sec.id} value={sec.id}>
                          Sección {idx + 1}: {sec.category_name} ({sec.question_count} reactivos)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Tiempo Límite (seg)
                    </Label>
                    <Input
                      type="number"
                      min="60"
                      step="30"
                      value={modalTimeLimit}
                      onChange={(e) => setModalTimeLimit(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Peso Sección (pts)
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={modalWeight}
                      onChange={(e) => setModalWeight(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssignModalOpen(false)}
                    disabled={isAssigning}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleQuickAssignToTemplate()}
                    disabled={isAssigning}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {isAssigning ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1" />
                        Asignando...
                      </>
                    ) : (
                      'Confirmar Asignación'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
