import axios from 'axios'
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Layers3,
  PencilLine,
  Plus,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

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
  question_count: string
  time_limit_seconds: string
  weight_override: string
  sort_order: number
}

type TemplateFormState = {
  name: string
  description: string
  instructions: string
  show_result_to_candidate: boolean
  randomize_question_order: boolean
  sections: TemplateSectionForm[]
}

const defaultSection = (sortOrder: number): TemplateSectionForm => ({
  category_id: '',
  subcategory_id: '',
  difficulty: '',
  question_count: '1',
  time_limit_seconds: '60',
  weight_override: '',
  sort_order: sortOrder,
})

const defaultFormState: TemplateFormState = {
  name: '',
  description: '',
  instructions: '',
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

  return 'No fue posible completar la operacion.'
}

export function EvaluationTemplatesPage() {
  const [templates, setTemplates] = useState<EvaluationTemplateListItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null)
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(defaultFormState)
  const [preview, setPreview] = useState<EvaluationTemplatePreview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  )

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

  function resetForm() {
    setEditingTemplateId(null)
    setTemplateForm(defaultFormState)
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
      show_result_to_candidate: templateForm.show_result_to_candidate,
      randomize_question_order: templateForm.randomize_question_order,
      sections: templateForm.sections.map((section, index) => ({
        category_id: Number(section.category_id),
        subcategory_id: section.subcategory_id ? Number(section.subcategory_id) : null,
        difficulty: section.difficulty || null,
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

    try {
      const payload = buildPayload()
      const template = editingTemplateId
        ? await updateEvaluationTemplate(editingTemplateId, payload)
        : await createEvaluationTemplate(payload)

      setFeedbackMessage(
        editingTemplateId
          ? 'Plantilla actualizada correctamente.'
          : 'Plantilla creada correctamente.',
      )

      setSelectedTemplateId(template.id)
      await loadInitialData()
      await handlePreview(template.id)
      resetForm()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleEditTemplate(templateId: number) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      const template = await getEvaluationTemplate(templateId)
      hydrateFormFromTemplate(template)
      setSelectedTemplateId(templateId)
      await handlePreview(templateId)
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
      show_result_to_candidate: template.show_result_to_candidate,
      randomize_question_order: template.randomize_question_order,
      sections: template.sections.map((section, index) => ({
        category_id: String(section.category_id),
        subcategory_id: section.subcategory_id ? String(section.subcategory_id) : '',
        difficulty: section.difficulty ?? '',
        question_count: String(section.question_count),
        time_limit_seconds: String(section.time_limit_seconds),
        weight_override: section.weight_override ? String(section.weight_override) : '',
        sort_order: index + 1,
      })),
    })
  }

  async function handlePreview(templateId: number) {
    setIsPreviewLoading(true)
    setErrorMessage('')

    try {
      const previewData = await previewEvaluationTemplate(templateId)
      setPreview(previewData)
      setSelectedTemplateId(templateId)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsPreviewLoading(false)
    }
  }

  async function handleToggleStatus(template: EvaluationTemplateListItem) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await setEvaluationTemplateStatus(template.id, !template.is_active)
      setFeedbackMessage('Estado de plantilla actualizado.')
      await loadInitialData()
      await handlePreview(template.id)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleDeleteTemplate(template: EvaluationTemplateListItem) {
    const confirmed = window.confirm(
      `Se eliminara la plantilla "${template.name}". Esta accion no se puede deshacer.`,
    )

    if (!confirmed) {
      return
    }

    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await deleteEvaluationTemplate(template.id)
      if (editingTemplateId === template.id) {
        resetForm()
      }
      if (selectedTemplateId === template.id) {
        setSelectedTemplateId(null)
        setPreview(null)
      }
      setFeedbackMessage('Plantilla eliminada correctamente.')
      await loadInitialData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  function getSubcategoriesForSection(categoryId: string) {
    return subcategories.filter(
      (subcategory) => String(subcategory.category_id) === categoryId,
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border bg-[linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.94))] p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-300">
              Modulo 3
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Plantillas de evaluacion y preview del examen
            </h2>
            <p className="max-w-3xl text-slate-300">
              Configura reglas por categoria y deja validado si el banco puede
              sostener una evaluacion real antes de activarla.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="Plantillas" value={String(templates.length)} icon={Layers3} />
            <HeroMetric
              label="Validas"
              value={String(templates.filter((template) => template.is_valid).length)}
              icon={CheckCircle2}
            />
            <HeroMetric
              label="Activas"
              value={String(templates.filter((template) => template.is_active).length)}
              icon={ClipboardCheck}
            />
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Configurador de plantilla</CardTitle>
            <CardDescription>
              Define la estructura general y agrega secciones con reglas de seleccion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="template-name">Nombre</Label>
                  <Input
                    id="template-name"
                    placeholder="Evaluacion capturista - perfil base"
                    value={templateForm.name}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="template-description">Descripcion</Label>
                  <Textarea
                    id="template-description"
                    placeholder="Objetivo y alcance de la evaluacion."
                    value={templateForm.description}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="template-instructions">Instrucciones</Label>
                  <Textarea
                    id="template-instructions"
                    placeholder="Indicaciones que veran los candidatos antes del examen."
                    value={templateForm.instructions}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        instructions: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 text-sm">
                  <input
                    checked={templateForm.show_result_to_candidate}
                    type="checkbox"
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        show_result_to_candidate: event.target.checked,
                      }))
                    }
                  />
                  Mostrar resultado al candidato
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    checked={templateForm.randomize_question_order}
                    type="checkbox"
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        randomize_question_order: event.target.checked,
                      }))
                    }
                  />
                  Aleatorizar orden de preguntas
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Secciones</h3>
                    <p className="text-sm text-muted-foreground">
                      Cada seccion consume preguntas unicas segun el orden configurado.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={addSection}>
                    <Plus className="size-4" />
                    Agregar seccion
                  </Button>
                </div>

                <div className="space-y-4">
                  {templateForm.sections.map((section, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-border bg-background/70 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">Seccion {index + 1}</p>
                          <p className="text-xs text-muted-foreground">
                            Orden de asignacion: {index + 1}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeSection(index)}
                        >
                          <Trash2 className="size-4" />
                          Quitar
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Categoria</Label>
                          <select
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                            value={section.category_id}
                            onChange={(event) =>
                              updateSection(index, 'category_id', event.target.value)
                            }
                          >
                            <option value="">Selecciona una categoria</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Subcategoria</Label>
                          <select
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                            value={section.subcategory_id}
                            onChange={(event) =>
                              updateSection(index, 'subcategory_id', event.target.value)
                            }
                          >
                            <option value="">Todas las subcategorias</option>
                            {getSubcategoriesForSection(section.category_id).map((subcategory) => (
                              <option key={subcategory.id} value={subcategory.id}>
                                {subcategory.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Dificultad</Label>
                          <select
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                            value={section.difficulty}
                            onChange={(event) =>
                              updateSection(index, 'difficulty', event.target.value)
                            }
                          >
                            <option value="">Todas</option>
                            <option value="basic">Basica</option>
                            <option value="intermediate">Intermedia</option>
                            <option value="advanced">Avanzada</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Preguntas requeridas</Label>
                          <Input
                            min="1"
                            type="number"
                            value={section.question_count}
                            onChange={(event) =>
                              updateSection(index, 'question_count', event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tiempo de la seccion (segundos)</Label>
                          <Input
                            min="1"
                            type="number"
                            value={section.time_limit_seconds}
                            onChange={(event) =>
                              updateSection(index, 'time_limit_seconds', event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Peso sobreescrito</Label>
                          <Input
                            min="0.1"
                            step="0.1"
                            type="number"
                            value={section.weight_override}
                            onChange={(event) =>
                              updateSection(index, 'weight_override', event.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!categories.length || !subcategories.length}>
                  {editingTemplateId ? (
                    <>
                      <PencilLine className="size-4" />
                      Guardar plantilla
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Crear plantilla
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Limpiar
                </Button>
                <Button type="button" variant="outline" onClick={() => void loadInitialData()}>
                  <RefreshCw className="size-4" />
                  Recargar datos
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plantillas registradas</CardTitle>
              <CardDescription>
                Activa solo evaluaciones que el banco pueda sostener sin inconsistencias.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-2xl border border-border bg-background/80 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{template.name}</h3>
                          <StatusBadge
                            label={template.is_valid ? 'Valida' : 'Invalida'}
                            tone={template.is_valid ? 'success' : 'warning'}
                          />
                          <StatusBadge
                            label={template.is_active ? 'Activa' : 'Inactiva'}
                            tone={template.is_active ? 'info' : 'neutral'}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {template.description || 'Sin descripcion registrada.'}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>{template.section_count} secciones</span>
                          <span>{template.total_question_count} preguntas solicitadas</span>
                          <span>{template.total_time_seconds}s totales</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {template.validation_message}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => void handleEditTemplate(template.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => void handlePreview(template.id)}
                        >
                          <Eye className="size-4" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => void handleToggleStatus(template)}
                        >
                          <ToggleLeft className="size-4" />
                          {template.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => void handleDeleteTemplate(template)}
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {!templates.length ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    {isLoading
                      ? 'Cargando plantillas...'
                      : 'Aun no hay plantillas registradas.'}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Preview de armado</CardTitle>
                  <CardDescription>
                    Vista previa real basada en preguntas activas y sin reutilizacion entre secciones.
                  </CardDescription>
                </div>
                {selectedTemplate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => void handlePreview(selectedTemplate.id)}
                  >
                    <Radar className="size-4" />
                    Recalcular
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <PreviewMetric
                      label="Secciones"
                      value={String(preview.total_sections)}
                      icon={Layers3}
                    />
                    <PreviewMetric
                      label="Preguntas"
                      value={String(preview.total_requested_questions)}
                      icon={ClipboardCheck}
                    />
                    <PreviewMetric
                      label="Tiempo"
                      value={`${preview.total_time_seconds}s`}
                      icon={Sparkles}
                    />
                    <PreviewMetric
                      label="Puntaje estimado"
                      value={String(preview.estimated_total_score)}
                      icon={Eye}
                    />
                  </div>

                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      preview.is_valid
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {preview.validation_message}
                  </div>

                  <div className="space-y-3">
                    {preview.sections.map((section, index) => (
                      <div
                        key={`${section.section_id ?? index}-${section.category_id}-${index}`}
                        className="rounded-2xl border border-border bg-background/70 p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">
                                Seccion {index + 1}: {section.category_name}
                              </p>
                              <StatusBadge
                                label={section.sufficient ? 'Suficiente' : 'Insuficiente'}
                                tone={section.sufficient ? 'success' : 'warning'}
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {section.subcategory_name || 'Todas las subcategorias'} |{' '}
                              {section.difficulty || 'Todas las dificultades'}
                            </p>
                          </div>

                          <div className="text-sm text-muted-foreground">
                            {section.requested_question_count} requeridas /{' '}
                            {section.available_question_count} disponibles
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Tiempo: {section.time_limit_seconds}s</span>
                          <span>Puntaje estimado: {section.estimated_score}</span>
                        </div>

                        {section.warning ? (
                          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                            {section.warning}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                  {isPreviewLoading
                    ? 'Calculando preview...'
                    : 'Selecciona una plantilla y ejecuta preview para ver disponibilidad, tiempo y puntaje estimado.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function HeroMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Layers3
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
          <Icon className="size-5 text-sky-300" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  )
}

function PreviewMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Layers3
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone: 'success' | 'warning' | 'info' | 'neutral'
}) {
  const toneClasses = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {label}
    </span>
  )
}
