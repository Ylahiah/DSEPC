import axios from 'axios'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Layers3,
  PencilLine,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Shuffle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  createEvaluationTemplate,
  deleteEvaluationTemplate,
  getEvaluationTemplate,
  getEvaluationTemplates,
  previewEvaluationTemplate,
  setEvaluationTemplateStatus,
  updateEvaluationTemplate,
  type EvaluationTemplateDetail,
  type EvaluationTemplateListItem,
  type EvaluationTemplatePayload,
  type EvaluationTemplatePreview,
} from '@/features/evaluation-templates/evaluation-template-service'
import {
  getCategories,
  getSubcategories,
  type Category,
  type Subcategory,
} from '@/features/question-bank/question-bank-service'

type TemplateSectionForm = {
  category_id: string
  subcategory_id: string
  difficulty: string
  question_type: string
  question_count: string
  time_limit_seconds: string
  weight_override: string
  sort_order: number
}

type TemplateFormState = {
  name: string
  description: string
  instructions: string
  passing_score_percentage: string
  show_result_to_candidate: boolean
  randomize_question_order: boolean
  sections: TemplateSectionForm[]
}

const defaultSection = (sortOrder: number): TemplateSectionForm => ({
  category_id: '',
  subcategory_id: '',
  difficulty: '',
  question_type: '',
  question_count: '5',
  time_limit_seconds: '300',
  weight_override: '',
  sort_order: sortOrder,
})

const defaultFormState: TemplateFormState = {
  name: '',
  description: '',
  instructions: '',
  passing_score_percentage: '80',
  show_result_to_candidate: false,
  randomize_question_order: true,
  sections: [defaultSection(1)],
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

  return 'No fue posible completar la operación.'
}

export function EvaluationTemplatesPage() {
  const [templates, setTemplates] = useState<EvaluationTemplateListItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  // Modals & Active Selections
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null)
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(defaultFormState)
  const [preview, setPreview] = useState<EvaluationTemplatePreview | null>(null)
  const [previewTemplateName, setPreviewTemplateName] = useState<string>('')
  const [previewTemplateId, setPreviewTemplateId] = useState<number | null>(null)

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'invalid' | 'active'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    void loadInitialData()
  }, [])

  async function loadInitialData() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [templatesData, categoriesData, subcategoriesData] = await Promise.all([
        getEvaluationTemplates(),
        getCategories(),
        getSubcategories(),
      ])
      setTemplates(templatesData)
      setCategories(categoriesData)
      setSubcategories(subcategoriesData)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !query ||
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'valid' && t.is_valid) ||
        (statusFilter === 'invalid' && !t.is_valid) ||
        (statusFilter === 'active' && t.is_active)

      return matchesSearch && matchesStatus
    })
  }, [templates, searchQuery, statusFilter])

  const stats = useMemo(() => {
    const total = templates.length
    const valid = templates.filter((t) => t.is_valid).length
    const invalid = total - valid
    const active = templates.filter((t) => t.is_active).length
    return { total, valid, invalid, active }
  }, [templates])

  function resetForm() {
    setEditingTemplateId(null)
    setTemplateForm(defaultFormState)
  }

  function handleOpenCreateModal() {
    resetForm()
    setErrorMessage('')
    setIsFormModalOpen(true)
  }

  async function handleOpenEditModal(templateId: number) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      const template = await getEvaluationTemplate(templateId)
      hydrateFormFromTemplate(template)
      setIsFormModalOpen(true)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  function hydrateFormFromTemplate(template: EvaluationTemplateDetail) {
    setEditingTemplateId(template.id)
    setTemplateForm({
      name: template.name,
      description: template.description ?? '',
      instructions: template.instructions ?? '',
      passing_score_percentage: String(template.passing_score_percentage),
      show_result_to_candidate: template.show_result_to_candidate,
      randomize_question_order: template.randomize_question_order,
      sections: template.sections.length
        ? template.sections.map((section, index) => ({
            category_id: String(section.category_id),
            subcategory_id: section.subcategory_id ? String(section.subcategory_id) : '',
            difficulty: section.difficulty ?? '',
            question_type: section.question_type ?? '',
            question_count: String(section.question_count),
            time_limit_seconds: String(section.time_limit_seconds),
            weight_override: section.weight_override ? String(section.weight_override) : '',
            sort_order: index + 1,
          }))
        : [defaultSection(1)],
    })
  }

  function handleCloseFormModal() {
    setIsFormModalOpen(false)
    resetForm()
  }

  async function handleOpenPreviewModal(template: EvaluationTemplateListItem) {
    setIsPreviewLoading(true)
    setPreviewTemplateName(template.name)
    setPreviewTemplateId(template.id)
    setPreview(null)
    setIsPreviewModalOpen(true)
    setErrorMessage('')

    try {
      const previewData = await previewEvaluationTemplate(template.id)
      setPreview(previewData)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsPreviewLoading(false)
    }
  }

  async function handleRefreshPreview() {
    if (!previewTemplateId) return
    setIsPreviewLoading(true)
    try {
      const previewData = await previewEvaluationTemplate(previewTemplateId)
      setPreview(previewData)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsPreviewLoading(false)
    }
  }

  function handleClosePreviewModal() {
    setIsPreviewModalOpen(false)
    setPreview(null)
    setPreviewTemplateId(null)
  }

  function updateSection(
    sectionIndex: number,
    field: keyof TemplateSectionForm,
    value: string | number,
  ) {
    setTemplateForm((current) => ({
      ...current,
      sections: current.sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              [field]: value,
              ...(field === 'category_id' ? { subcategory_id: '' } : {}),
            }
          : section,
      ),
    }))
  }

  function addSection() {
    setTemplateForm((current) => ({
      ...current,
      sections: [...current.sections, defaultSection(current.sections.length + 1)],
    }))
  }

  function removeSection(sectionIndex: number) {
    setTemplateForm((current) => {
      const nextSections = current.sections.filter((_, index) => index !== sectionIndex)
      return {
        ...current,
        sections: nextSections.length
          ? nextSections.map((section, index) => ({
              ...section,
              sort_order: index + 1,
            }))
          : [defaultSection(1)],
      }
    })
  }

  function buildPayload(): EvaluationTemplatePayload {
    return {
      name: templateForm.name.trim(),
      description: templateForm.description.trim() || null,
      instructions: templateForm.instructions.trim() || null,
      passing_score_percentage: Number(templateForm.passing_score_percentage) || 80,
      show_result_to_candidate: templateForm.show_result_to_candidate,
      randomize_question_order: templateForm.randomize_question_order,
      sections: templateForm.sections.map((section, index) => ({
        category_id: Number(section.category_id),
        subcategory_id: section.subcategory_id ? Number(section.subcategory_id) : null,
        difficulty: section.difficulty || null,
        question_type: section.question_type || null,
        question_count: Number(section.question_count),
        time_limit_seconds: Number(section.time_limit_seconds),
        weight_override: section.weight_override ? Number(section.weight_override) : null,
        sort_order: index + 1,
      })),
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage('')
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const payload = buildPayload()
      if (editingTemplateId) {
        await updateEvaluationTemplate(editingTemplateId, payload)
        setFeedbackMessage('Plantilla de evaluación actualizada correctamente.')
      } else {
        await createEvaluationTemplate(payload)
        setFeedbackMessage('Plantilla de evaluación creada correctamente.')
      }

      handleCloseFormModal()
      await loadInitialData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleStatus(template: EvaluationTemplateListItem) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await setEvaluationTemplateStatus(template.id, !template.is_active)
      setFeedbackMessage(
        `Plantilla "${template.name}" ${!template.is_active ? 'activada' : 'desactivada'} correctamente.`,
      )
      await loadInitialData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  const [templateToDelete, setTemplateToDelete] = useState<EvaluationTemplateListItem | null>(null)
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false)

  async function handleConfirmDeleteTemplate() {
    if (!templateToDelete) return

    setIsDeletingTemplate(true)
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await deleteEvaluationTemplate(templateToDelete.id)
      setFeedbackMessage(`Plantilla "${templateToDelete.name}" eliminada correctamente.`)
      setTemplateToDelete(null)
      await loadInitialData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDeletingTemplate(false)
    }
  }

  function getSubcategoriesForSection(categoryId: string) {
    return subcategories.filter(
      (subcategory) => String(subcategory.category_id) === categoryId,
    )
  }

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Plantillas de Evaluación
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Diseña la estructura de evaluación, configura secciones por categoría y valida la cobertura del banco de preguntas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadInitialData()}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreateModal}
          >
            <Plus className="size-4" />
            Nueva Plantilla
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Plantillas Totales
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Layers3 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{stats.total}</div>
          <p className="mt-1 text-[11px] text-slate-400">Diseñadas en el sistema</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Plantillas Válidas
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{stats.valid}</div>
          <p className="mt-1 text-[11px] text-slate-400">Con reactivos suficientes en banco</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Plantillas Activas
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-purple-50 text-purple-600">
              <ClipboardCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{stats.active}</div>
          <p className="mt-1 text-[11px] text-slate-400">Listas para ser asignadas</p>
        </div>
      </div>

      {/* Global Alerts */}
      {feedbackMessage ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-emerald-600" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage('')}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold"
          >
            Descartar
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 shadow-2xs">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-red-600 hover:text-red-800 text-xs font-semibold"
          >
            Descartar
          </button>
        </div>
      ) : null}

      {/* Full-width Data Grid Card */}
      <Card className="border-slate-200/80 shadow-2xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Plantillas Registradas
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Supervisa los parámetros de evaluación, cobertura de preguntas y disponibilidad.
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar plantilla..."
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
                  Todas ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('valid')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'valid'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  Válidas ({stats.valid})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('invalid')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'invalid'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-amber-700'
                  }`}
                >
                  Incompletas ({stats.invalid})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'active'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-purple-700'
                  }`}
                >
                  Activas ({stats.active})
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
                  <th className="px-5 py-3">Nombre & Descripción</th>
                  <th className="px-5 py-3">Estructura</th>
                  <th className="px-5 py-3">Parámetros</th>
                  <th className="px-5 py-3">Estado & Cobertura</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Nombre & Descripción */}
                    <td className="px-5 py-4 max-w-xs sm:max-w-sm">
                      <div className="font-semibold text-slate-900 text-sm">{template.name}</div>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                        {template.description || 'Sin descripción registrada.'}
                      </p>
                    </td>

                    {/* Estructura */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-slate-800">
                          {template.section_count} {template.section_count === 1 ? 'sección' : 'secciones'} · {template.total_question_count} reactivos
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          Tiempo total: {Math.floor(template.total_time_seconds / 60)} min ({template.total_time_seconds}s)
                        </span>
                      </div>
                    </td>

                    {/* Parámetros */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Mín. {template.passing_score_percentage}%
                        </span>
                        {template.randomize_question_order && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                            <Shuffle className="size-2.5" /> Aleatoria
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Estado & Cobertura */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              template.is_valid
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {template.is_valid ? (
                              <CheckCircle2 className="size-3 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="size-3 text-amber-600" />
                            )}
                            {template.is_valid ? 'Válida (completa)' : 'Incompleta'}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              template.is_active
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                template.is_active ? 'bg-purple-600' : 'bg-slate-400'
                              }`}
                            />
                            {template.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 line-clamp-1">
                          {template.validation_message}
                        </span>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleOpenPreviewModal(template)}
                          className="h-8 px-2 text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50"
                          title="Ver preview de armado"
                        >
                          <Eye className="size-3.5" />
                          <span className="hidden sm:inline ml-1">Preview</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleOpenEditModal(template.id)}
                          className="h-8 px-2 text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50"
                          title="Editar plantilla"
                        >
                          <PencilLine className="size-3.5" />
                          <span className="hidden sm:inline ml-1">Editar</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleToggleStatus(template)}
                          className={`h-8 px-2 text-xs ${
                            template.is_active
                              ? 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-purple-700 hover:text-purple-800 hover:bg-purple-50'
                          }`}
                          title={template.is_active ? 'Desactivar plantilla' : 'Activar plantilla'}
                        >
                          {template.is_active ? (
                            <>
                              <ToggleRight className="size-4 text-purple-600" />
                              <span className="hidden sm:inline ml-1">Desactivar</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="size-4 text-slate-400" />
                              <span className="hidden sm:inline ml-1">Activar</span>
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTemplateToDelete(template)}
                          className="h-8 px-2 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50"
                          title="Eliminar plantilla"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredTemplates.length && (
              <div className="p-12 text-center">
                <Layers3 className="mx-auto size-10 text-slate-300 stroke-1" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No se encontraron plantillas con los filtros seleccionados'
                    : 'Aún no hay plantillas de evaluación registradas'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Prueba modificando el texto de búsqueda o cambiando el filtro de estado.'
                    : 'Crea tu primera plantilla definiendo secciones por categoría para aplicarla a tus candidatos.'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <div className="mt-4">
                    <Button size="sm" onClick={handleOpenCreateModal}>
                      <Plus className="size-4" />
                      Crear primera plantilla
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: Template Builder (Create & Edit) */}
      {isFormModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingTemplateId ? 'Editar Plantilla de Evaluación' : 'Nueva Plantilla de Evaluación'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configura la estructura, puntaje mínimo y las secciones con reglas de selección.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseFormModal}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Body / Scrollable Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {errorMessage ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                {/* Bloque 1: Datos Generales */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Información General
                  </h4>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="tpl-name" className="text-xs font-semibold text-slate-700">
                        Nombre de la Plantilla <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="tpl-name"
                        required
                        placeholder="Ej. Evaluación de Captura y Almacén - 2026"
                        value={templateForm.name}
                        onChange={(e) =>
                          setTemplateForm((curr) => ({ ...curr, name: e.target.value }))
                        }
                        className="text-sm font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-score" className="text-xs font-semibold text-slate-700">
                        Puntaje Aprobatorio (%) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="tpl-score"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        required
                        placeholder="80"
                        value={templateForm.passing_score_percentage}
                        onChange={(e) =>
                          setTemplateForm((curr) => ({
                            ...curr,
                            passing_score_percentage: e.target.value,
                          }))
                        }
                        className="text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-desc" className="text-xs font-semibold text-slate-700">
                        Descripción interna (Opcional)
                      </Label>
                      <Textarea
                        id="tpl-desc"
                        rows={2}
                        placeholder="Objetivo y alcance de la evaluación para los administradores..."
                        value={templateForm.description}
                        onChange={(e) =>
                          setTemplateForm((curr) => ({ ...curr, description: e.target.value }))
                        }
                        className="text-xs resize-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tpl-inst" className="text-xs font-semibold text-slate-700">
                        Instrucciones para el Candidato (Opcional)
                      </Label>
                      <Textarea
                        id="tpl-inst"
                        rows={2}
                        placeholder="Indicaciones mostradas al candidato antes de comenzar..."
                        value={templateForm.instructions}
                        onChange={(e) =>
                          setTemplateForm((curr) => ({ ...curr, instructions: e.target.value }))
                        }
                        className="text-xs resize-none"
                      />
                    </div>
                  </div>

                  {/* Opciones de examen */}
                  <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={templateForm.show_result_to_candidate}
                        onChange={(e) =>
                          setTemplateForm((curr) => ({
                            ...curr,
                            show_result_to_candidate: e.target.checked,
                          }))
                        }
                        className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        Mostrar resultado al candidato al terminar
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={templateForm.randomize_question_order}
                        onChange={(e) =>
                          setTemplateForm((curr) => ({
                            ...curr,
                            randomize_question_order: e.target.checked,
                          }))
                        }
                        className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        Aleatorizar orden de preguntas
                      </span>
                    </label>
                  </div>
                </div>

                {/* Bloque 2: Secciones del Examen */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        2. Secciones y Reglas de Preguntas ({templateForm.sections.length})
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        El sistema extraerá reactivos aleatorios del banco cumpliendo cada regla sin repetir preguntas.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSection}
                      className="text-xs"
                    >
                      <Plus className="size-3.5" />
                      Agregar Sección
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {templateForm.sections.map((section, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200/90 bg-slate-50/40 p-4 relative"
                      >
                        <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white font-mono">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              Sección {idx + 1}
                            </span>
                          </div>

                          {templateForm.sections.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSection(idx)}
                              className="h-6 px-2 text-[11px] text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="size-3 mr-1" />
                              Quitar
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          {/* Categoría */}
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Categoría <span className="text-red-500">*</span>
                            </Label>
                            <select
                              required
                              value={section.category_id}
                              onChange={(e) => updateSection(idx, 'category_id', e.target.value)}
                              className="flex h-8 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs text-foreground shadow-2xs outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-- Seleccionar --</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Subcategoría */}
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Subcategoría (Opcional)
                            </Label>
                            <select
                              value={section.subcategory_id}
                              onChange={(e) =>
                                updateSection(idx, 'subcategory_id', e.target.value)
                              }
                              className="flex h-8 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs text-foreground shadow-2xs outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Todas las subcategorías</option>
                              {getSubcategoriesForSection(section.category_id).map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Tipo de Reactivo */}
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Tipo de Reactivo
                            </Label>
                            <select
                              value={section.question_type}
                              onChange={(e) => updateSection(idx, 'question_type', e.target.value)}
                              className="flex h-8 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs text-foreground shadow-2xs outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Todos los tipos (Teóricos y Prácticos)</option>
                              <option value="multiple_choice">📝 Opción Múltiple (Teórico)</option>
                              <option value="excel_practical">📊 Ejercicio Práctico Excel</option>
                            </select>
                          </div>

                          {/* Dificultad */}
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Dificultad
                            </Label>
                            <select
                              value={section.difficulty}
                              onChange={(e) => updateSection(idx, 'difficulty', e.target.value)}
                              className="flex h-8 w-full rounded-md border border-input bg-white px-2.5 py-1 text-xs text-foreground shadow-2xs outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Cualquier dificultad</option>
                              <option value="basic">Básica</option>
                              <option value="intermediate">Intermedia</option>
                              <option value="advanced">Avanzada</option>
                            </select>
                          </div>

                          {/* Cantidad de preguntas */}
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Reactivos Requeridos <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              required
                              value={section.question_count}
                              onChange={(e) =>
                                updateSection(idx, 'question_count', e.target.value)
                              }
                              className="h-8 text-xs font-mono"
                            />
                          </div>

                          {/* Tiempo límite (segundos) */}
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Tiempo Límite (segundos) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="number"
                              min="10"
                              step="5"
                              required
                              value={section.time_limit_seconds}
                              onChange={(e) =>
                                updateSection(idx, 'time_limit_seconds', e.target.value)
                              }
                              className="h-8 text-xs font-mono"
                            />
                          </div>

                          {/* Peso sobreescrito */}
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Peso por Pregunta (Opcional)
                            </Label>
                            <Input
                              type="number"
                              min="0.1"
                              step="0.1"
                              placeholder="Defecto: 1.0"
                              value={section.weight_override}
                              onChange={(e) =>
                                updateSection(idx, 'weight_override', e.target.value)
                              }
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer Inside Form */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCloseFormModal}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : editingTemplateId ? (
                      <PencilLine className="size-3.5" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    {editingTemplateId ? 'Guardar Cambios' : 'Crear Plantilla'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* MODAL 2: Preview de Armado & Cobertura */}
      {isPreviewModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Preview de Armado & Cobertura
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {previewTemplateName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Simulación de cobertura con reactivos activos disponibles actualmente en el banco.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClosePreviewModal}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {isPreviewLoading ? (
                  <div className="p-12 text-center">
                    <RefreshCw className="mx-auto size-8 animate-spin text-blue-600" />
                    <p className="mt-3 text-xs font-medium text-slate-600">
                      Calculando cobertura de preguntas y tiempos...
                    </p>
                  </div>
                ) : preview ? (
                  <>
                    {/* Status Banner */}
                    <div
                      className={`flex items-start gap-3 rounded-lg border p-4 text-xs ${
                        preview.is_valid
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {preview.is_valid ? (
                        <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="size-5 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <div className="font-bold text-sm">
                          {preview.is_valid
                            ? 'Plantilla lista para su activación'
                            : 'Atención: Reactivos insuficientes'}
                        </div>
                        <p className="mt-0.5 opacity-90">{preview.validation_message}</p>
                      </div>
                    </div>

                    {/* Summary Metric Chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Secciones
                        </span>
                        <div className="mt-1 text-lg font-bold font-mono text-slate-900">
                          {preview.total_sections}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Total Reactivos
                        </span>
                        <div className="mt-1 text-lg font-bold font-mono text-slate-900">
                          {preview.total_requested_questions}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Tiempo Total
                        </span>
                        <div className="mt-1 text-lg font-bold font-mono text-slate-900">
                          {Math.floor(preview.total_time_seconds / 60)}m ({preview.total_time_seconds}s)
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Puntaje Est.
                        </span>
                        <div className="mt-1 text-lg font-bold font-mono text-slate-900">
                          {preview.estimated_total_score} pts
                        </div>
                      </div>
                    </div>

                    {/* Section Breakdown List */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Desglose de Secciones & Disponibilidad
                      </h4>

                      <div className="space-y-2.5">
                        {preview.sections.map((sec, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg border p-3.5 transition-colors ${
                              sec.sufficient
                                ? 'border-slate-200 bg-white'
                                : 'border-amber-200 bg-amber-50/50'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs text-slate-900">
                                    Sección {idx + 1}: {sec.category_name}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      sec.sufficient
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    }`}
                                  >
                                    {sec.sufficient ? 'Suficiente' : 'Insuficiente'}
                                  </span>

                                  {sec.question_type && (
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        sec.question_type === 'excel_practical'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                                      }`}
                                    >
                                      {sec.question_type === 'excel_practical'
                                        ? '📊 Práctico Excel'
                                        : '📝 Opción Múltiple'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {sec.subcategory_name || 'Todas las subcategorías'} ·{' '}
                                  {sec.difficulty
                                    ? `Dificultad: ${sec.difficulty}`
                                    : 'Cualquier dificultad'}
                                </div>
                              </div>

                              <div className="text-right sm:self-center">
                                <div className="text-xs font-mono font-bold text-slate-800">
                                  {sec.requested_question_count} solicitadas /{' '}
                                  <span
                                    className={
                                      sec.sufficient ? 'text-emerald-700' : 'text-amber-700'
                                    }
                                  >
                                    {sec.available_question_count} disponibles
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {sec.time_limit_seconds}s · {sec.estimated_score} pts
                                </div>
                              </div>
                            </div>

                            {sec.warning ? (
                              <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-100/60 rounded p-2 border border-amber-200">
                                <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
                                <span>{sec.warning}</span>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No se pudo cargar la vista previa.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRefreshPreview()}
                  disabled={isPreviewLoading}
                  className="text-xs"
                >
                  <Radar className="size-3.5" />
                  Recalcular Cobertura
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleClosePreviewModal}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal de Confirmación para Eliminar Plantilla */}
      <ConfirmDialog
        isOpen={Boolean(templateToDelete)}
        title="Eliminar Plantilla de Evaluación"
        description={`¿Estás seguro de que deseas eliminar la plantilla "${templateToDelete?.name}"?\n\nEsta acción no se puede deshacer y los códigos vinculados quedarán sin plantilla asignada.`}
        confirmText="Eliminar Plantilla"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingTemplate}
        onConfirm={handleConfirmDeleteTemplate}
        onClose={() => {
          if (!isDeletingTemplate) setTemplateToDelete(null)
        }}
      />
    </div>
  )
}
