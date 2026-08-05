import axios from 'axios'
import {
  BookCopy,
  Trash2,
  Download,
  FileUp,
  Filter,
  FolderTree,
  type LucideIcon,
  PencilLine,
  Plus,
  RefreshCw,
  Shapes,
  ToggleLeft,
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
  createCategory,
  type Category,
  type CategoryPayload,
  deleteQuestion,
  deleteCategory,
  deleteSubcategory,
  createQuestion,
  createSubcategory,
  downloadQuestionImportTemplate,
  getCategories,
  getQuestion,
  getQuestions,
  getSubcategories,
  importQuestionsFromExcel,
  setCategoryStatus,
  setQuestionStatus,
  setSubcategoryStatus,
  type QuestionDetail,
  type QuestionFilters,
  type QuestionImportSummary,
  type QuestionListItem,
  type QuestionPayload,
  type Subcategory,
  type SubcategoryPayload,
  updateCategory,
  updateQuestion,
  updateSubcategory,
} from '@/features/question-bank/question-bank-service'
import {
  createExcelExercise,
  deleteExcelExercise,
  downloadExcelExerciseWorkbook,
  getExcelExercises,
  setExcelExerciseStatus,
  type ExcelExercise,
  type ExcelExercisePayload,
  updateExcelExercise,
} from '@/features/question-bank/excel-exercise-service'

type CategoryFormState = {
  code: string
  name: string
  description: string
  weight: string
}

type SubcategoryFormState = {
  category_id: string
  name: string
  description: string
}

type QuestionFormState = {
  category_id: string
  subcategory_id: string
  excel_exercise_id: string
  difficulty: string
  question_type: string
  statement: string
  correct_answer: string
  feedback: string
  max_time_seconds: string
  score: string
  options: string[]
}

type ExcelExerciseFormState = {
  name: string
  description: string
  instructions: string
  source_sheet_name: string
  task_sheet_name: string
  is_active: boolean
}

const defaultCategoryForm: CategoryFormState = {
  code: '',
  name: '',
  description: '',
  weight: '1',
}

const defaultSubcategoryForm: SubcategoryFormState = {
  category_id: '',
  name: '',
  description: '',
}

const defaultQuestionForm: QuestionFormState = {
  category_id: '',
  subcategory_id: '',
  excel_exercise_id: '',
  difficulty: 'basic',
  question_type: 'multiple_choice',
  statement: '',
  correct_answer: '',
  feedback: '',
  max_time_seconds: '60',
  score: '1',
  options: ['', '', '', ''],
}

const defaultExcelExerciseForm: ExcelExerciseFormState = {
  name: '',
  description: '',
  instructions: '',
  source_sheet_name: 'BaseDatos',
  task_sheet_name: 'RealizaEjercicio',
  is_active: true,
}

function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.detail
    if (typeof apiMessage === 'string') {
      return apiMessage
    } else if (apiMessage) {
      return JSON.stringify(apiMessage)
    }
  }

  return 'No fue posible completar la operacion.'
}

function formatRelativeStatus(value: boolean) {
  return value ? 'Activo' : 'Inactivo'
}

export function QuestionBankPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [questions, setQuestions] = useState<QuestionListItem[]>([])
  const [excelExercises, setExcelExercises] = useState<ExcelExercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<number | null>(null)
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [editingExcelExerciseId, setEditingExcelExerciseId] = useState<number | null>(null)

  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(defaultCategoryForm)
  const [subcategoryForm, setSubcategoryForm] = useState<SubcategoryFormState>(defaultSubcategoryForm)
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(defaultQuestionForm)
  const [excelExerciseForm, setExcelExerciseForm] =
    useState<ExcelExerciseFormState>(defaultExcelExerciseForm)
  const [questionFilters, setQuestionFilters] = useState<QuestionFilters>({})
  const [importFile, setImportFile] = useState<File | null>(null)
  const [excelExerciseFile, setExcelExerciseFile] = useState<File | null>(null)
  const [excelExerciseSolutionFile, setExcelExerciseSolutionFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(Date.now())
  const [isImporting, setIsImporting] = useState(false)
  const [isSubmittingExcelExercise, setIsSubmittingExcelExercise] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [importSummary, setImportSummary] = useState<QuestionImportSummary | null>(null)

  const filteredSubcategoriesForForm = useMemo(
    () =>
      subcategories.filter(
        (subcategory) =>
          String(subcategory.category_id) === questionForm.category_id,
      ),
    [questionForm.category_id, subcategories],
  )

  const filteredSubcategoriesForSearch = useMemo(
    () =>
      subcategories.filter(
        (subcategory) =>
          !questionFilters.category_id ||
          subcategory.category_id === questionFilters.category_id,
      ),
    [questionFilters.category_id, subcategories],
  )

  async function loadAllData(filters: QuestionFilters = questionFilters) {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [categoriesData, subcategoriesData, questionsData, excelExercisesData] = await Promise.all([
        getCategories(),
        getSubcategories(),
        getQuestions(filters),
        getExcelExercises(),
      ])
      setCategories(categoriesData)
      setSubcategories(subcategoriesData)
      setQuestions(questionsData)
      setExcelExercises(excelExercisesData)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAllData()
  }, [])

  function resetCategoryForm() {
    setEditingCategoryId(null)
    setCategoryForm(defaultCategoryForm)
  }

  function resetSubcategoryForm() {
    setEditingSubcategoryId(null)
    setSubcategoryForm(defaultSubcategoryForm)
  }

  function resetQuestionForm() {
    setEditingQuestionId(null)
    setQuestionForm(defaultQuestionForm)
  }

  function resetExcelExerciseForm() {
    setEditingExcelExerciseId(null)
    setExcelExerciseForm(defaultExcelExerciseForm)
    setExcelExerciseFile(null)
    setExcelExerciseSolutionFile(null)
    setFileInputKey(Date.now())
  }

  function updateQuestionOption(index: number, value: string) {
    setQuestionForm((current) => {
      const nextOptions = current.options.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      )
      const cleanedValues = nextOptions.map((option) => option.trim())
      const nextCorrectAnswer = cleanedValues.includes(current.correct_answer)
        ? current.correct_answer
        : ''

      return {
        ...current,
        options: nextOptions,
        correct_answer: nextCorrectAnswer,
      }
    })
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage('')
    setErrorMessage('')

    const payload: CategoryPayload = {
      code: categoryForm.code.trim().toUpperCase(),
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim() || null,
      weight: Number(categoryForm.weight),
    }

    try {
      if (editingCategoryId) {
        await updateCategory(editingCategoryId, payload)
        setFeedbackMessage('Categoria actualizada correctamente.')
      } else {
        await createCategory(payload)
        setFeedbackMessage('Categoria creada correctamente.')
      }

      resetCategoryForm()
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleSubcategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage('')
    setErrorMessage('')

    const payload: SubcategoryPayload = {
      category_id: Number(subcategoryForm.category_id),
      name: subcategoryForm.name.trim(),
      description: subcategoryForm.description.trim() || null,
    }

    try {
      if (editingSubcategoryId) {
        await updateSubcategory(editingSubcategoryId, payload)
        setFeedbackMessage('Subcategoria actualizada correctamente.')
      } else {
        await createSubcategory(payload)
        setFeedbackMessage('Subcategoria creada correctamente.')
      }

      resetSubcategoryForm()
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage('')
    setErrorMessage('')

    const sanitizedOptions = questionForm.options
      .map((option) => option.trim())
      .filter(Boolean)

    const payload: QuestionPayload = {
      category_id: Number(questionForm.category_id),
      subcategory_id: Number(questionForm.subcategory_id),
      excel_exercise_id: questionForm.excel_exercise_id ? Number(questionForm.excel_exercise_id) : null,
      difficulty: questionForm.difficulty,
      question_type: questionForm.question_type,
      statement: questionForm.statement.trim(),
      correct_answer: questionForm.correct_answer.trim(),
      feedback: questionForm.feedback.trim() || null,
      max_time_seconds: Number(questionForm.max_time_seconds),
      score: Number(questionForm.score),
      options: sanitizedOptions.map((optionText) => ({ option_text: optionText })),
    }

    try {
      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, payload)
        setFeedbackMessage('Pregunta actualizada correctamente.')
      } else {
        await createQuestion(payload)
        setFeedbackMessage('Pregunta creada correctamente.')
      }

      resetQuestionForm()
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleEditQuestion(questionId: number) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      const question = await getQuestion(questionId)
      hydrateQuestionForm(question)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  function hydrateQuestionForm(question: QuestionDetail) {
    setEditingQuestionId(question.id)
    setQuestionForm({
      category_id: String(question.category_id),
      subcategory_id: String(question.subcategory_id),
      excel_exercise_id: question.excel_exercise_id ? String(question.excel_exercise_id) : '',
      difficulty: question.difficulty,
      question_type: question.question_type,
      statement: question.statement,
      correct_answer: question.correct_answer,
      feedback: question.feedback ?? '',
      max_time_seconds: String(question.max_time_seconds),
      score: String(question.score),
      options: [
        ...question.options.map((option) => option.option_text),
        ...Array.from({ length: Math.max(0, 4 - question.options.length) }).map(() => ''),
      ],
    })
  }

  async function handleRefreshWithFilters() {
    setFeedbackMessage('')
    await loadAllData(questionFilters)
  }

  async function handleImportQuestions() {
    if (!importFile) {
      setErrorMessage('Selecciona primero un archivo Excel para importar.')
      return
    }

    setFeedbackMessage('')
    setErrorMessage('')
    setImportSummary(null)
    setIsImporting(true)

    try {
      const summary = await importQuestionsFromExcel(importFile)
      setImportSummary(summary)

      if (summary.errors.length) {
        setErrorMessage(
          'La importacion no pudo completarse porque hay filas con errores. Revisa el detalle abajo.',
        )
        return
      }

      setFeedbackMessage(
        `Importacion completada: ${summary.created_questions} preguntas, ${summary.created_categories} categorias nuevas y ${summary.created_subcategories} subcategorias nuevas.`,
      )
      setImportFile(null)
      await loadAllData(questionFilters)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsImporting(false)
    }
  }

  async function handleDownloadTemplate() {
    setFeedbackMessage('')
    setErrorMessage('')
    setIsDownloadingTemplate(true)

    try {
      await downloadQuestionImportTemplate()
      setFeedbackMessage('Plantilla Excel descargada correctamente.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  async function handleExcelExerciseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage('')
    setErrorMessage('')

    if (!editingExcelExerciseId && (!excelExerciseFile || !excelExerciseSolutionFile)) {
      setErrorMessage('Selecciona el archivo Base y el archivo Solución para registrar el ejercicio práctico.')
      return
    }

    const payload: ExcelExercisePayload = {
      name: excelExerciseForm.name.trim(),
      description: excelExerciseForm.description.trim() || null,
      instructions: excelExerciseForm.instructions.trim() || null,
      source_sheet_name: excelExerciseForm.source_sheet_name.trim(),
      task_sheet_name: excelExerciseForm.task_sheet_name.trim(),
      is_active: excelExerciseForm.is_active,
      workbook: excelExerciseFile,
      solution_workbook: excelExerciseSolutionFile,
    }

    setIsSubmittingExcelExercise(true)
    try {
      if (editingExcelExerciseId) {
        await updateExcelExercise(editingExcelExerciseId, payload)
        setFeedbackMessage('Ejercicio practico actualizado correctamente.')
      } else {
        await createExcelExercise(payload)
        setFeedbackMessage('Ejercicio practico registrado correctamente.')
      }

      resetExcelExerciseForm()
      await loadAllData(questionFilters)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSubmittingExcelExercise(false)
    }
  }

  function handleEditExcelExercise(exercise: ExcelExercise) {
    setEditingExcelExerciseId(exercise.id)
    setExcelExerciseForm({
      name: exercise.name,
      description: exercise.description ?? '',
      instructions: exercise.instructions ?? '',
      source_sheet_name: exercise.source_sheet_name,
      task_sheet_name: exercise.task_sheet_name,
      is_active: exercise.is_active,
    })
    setExcelExerciseFile(null)
    setExcelExerciseSolutionFile(null)
    setFeedbackMessage('')
    setErrorMessage('')
  }

  async function handleToggleExcelExercise(exercise: ExcelExercise) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await setExcelExerciseStatus(exercise.id, !exercise.is_active)
      setFeedbackMessage('Estado del ejercicio practico actualizado.')
      await loadAllData(questionFilters)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleDeleteExcelExercise(exercise: ExcelExercise) {
    const confirmed = window.confirm(
      `Se eliminara el ejercicio practico "${exercise.name}". Esta accion no se puede deshacer.`,
    )
    if (!confirmed) {
      return
    }

    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await deleteExcelExercise(exercise.id)
      if (editingExcelExerciseId === exercise.id) {
        resetExcelExerciseForm()
      }
      setFeedbackMessage('Ejercicio practico eliminado correctamente.')
      await loadAllData(questionFilters)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleDownloadExcelExercise(exercise: ExcelExercise) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await downloadExcelExerciseWorkbook(exercise.id, exercise.workbook_filename)
      setFeedbackMessage('Archivo del ejercicio descargado correctamente.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleToggleCategory(category: Category) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await setCategoryStatus(category.id, !category.is_active)
      setFeedbackMessage('Estado de categoria actualizado.')
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleDeleteCategory(category: Category) {
    const confirmed = window.confirm(
      `Se eliminara la categoria "${category.name}". Esta accion no se puede deshacer.`,
    )

    if (!confirmed) {
      return
    }

    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await deleteCategory(category.id)
      if (editingCategoryId === category.id) {
        resetCategoryForm()
      }
      setFeedbackMessage('Categoria eliminada correctamente.')
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleToggleSubcategory(subcategory: Subcategory) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await setSubcategoryStatus(subcategory.id, !subcategory.is_active)
      setFeedbackMessage('Estado de subcategoria actualizado.')
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleDeleteSubcategory(subcategory: Subcategory) {
    const confirmed = window.confirm(
      `Se eliminara la subcategoria "${subcategory.name}". Esta accion no se puede deshacer.`,
    )

    if (!confirmed) {
      return
    }

    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await deleteSubcategory(subcategory.id)
      if (editingSubcategoryId === subcategory.id) {
        resetSubcategoryForm()
      }
      setFeedbackMessage('Subcategoria eliminada correctamente.')
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleToggleQuestion(question: QuestionListItem) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await setQuestionStatus(question.id, !question.is_active)
      setFeedbackMessage('Estado de pregunta actualizado.')
      await loadAllData(questionFilters)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleDeleteQuestion(question: QuestionListItem) {
    const confirmed = window.confirm(
      `Se eliminara la pregunta seleccionada. Esta accion no se puede deshacer.\n\nPregunta: ${question.statement}`,
    )

    if (!confirmed) {
      return
    }

    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await deleteQuestion(question.id)
      if (editingQuestionId === question.id) {
        resetQuestionForm()
      }
      setFeedbackMessage('Pregunta eliminada correctamente.')
      await loadAllData(questionFilters)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border bg-[linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.94))] p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-300">
              Modulo 2
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Banco de preguntas y ponderaciones
            </h2>
            <p className="max-w-3xl text-slate-300">
              Administra categorias, subcategorias y preguntas con reglas de
              negocio listas para alimentar el motor de evaluaciones.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Categorias" value={String(categories.length)} icon={Shapes} />
            <MetricCard label="Subcategorias" value={String(subcategories.length)} icon={FolderTree} />
            <MetricCard label="Preguntas" value={String(questions.length)} icon={BookCopy} />
            <MetricCard label="Ejercicios Excel" value={String(excelExercises.length)} icon={Download} />
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

      <Card>
        <CardHeader>
          <CardTitle>Importacion masiva desde Excel</CardTitle>
          <CardDescription>
            Usa una plantilla para cargar preguntas de forma rapida con categoria,
            subcategoria, opciones, respuesta correcta, tiempo y retroalimentacion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                La plantilla acepta columnas como las de tu ejemplo: <strong>Categoria</strong>,
                <strong> Subcategoria</strong>, <strong>Dificultad</strong>,
                <strong> Tipo de pregunta</strong>, <strong>Tiempo maximo</strong>,
                <strong> Puntaje</strong>, <strong>Pregunta</strong>, varias columnas de
                <strong> Opcion</strong>, <strong>Respuesta correcta</strong> y
                <strong> Retroalimentacion</strong>.
              </div>

              <div className="space-y-2">
                <Label htmlFor="questions-import-file">Archivo Excel</Label>
                <Input
                  id="questions-import-file"
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(event) =>
                    setImportFile(event.target.files?.[0] ?? null)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Formatos soportados: .xlsx y .xlsm
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={isImporting || !importFile}
                  onClick={() => void handleImportQuestions()}
                >
                  <FileUp className="size-4" />
                  {isImporting ? 'Importando...' : 'Importar preguntas'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDownloadingTemplate}
                  onClick={() => void handleDownloadTemplate()}
                >
                  <Download className="size-4" />
                  {isDownloadingTemplate ? 'Descargando...' : 'Descargar plantilla'}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-background px-4 py-4 text-sm">
                <p className="font-medium text-foreground">Reglas de importacion</p>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  <li>Las categorias y subcategorias nuevas se crean automaticamente.</li>
                  <li>La importacion es todo o nada: si una fila falla, no se guarda ninguna.</li>
                  <li>La respuesta correcta puede venir como texto exacto o letra tipo A, B, C.</li>
                  <li>Se requieren al menos dos opciones por pregunta.</li>
                </ul>
              </div>

              {importSummary ? (
                <div className="rounded-2xl border border-border bg-background px-4 py-4 text-sm">
                  <p className="font-medium text-foreground">Resultado de la ultima importacion</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <SummaryMetric label="Categorias nuevas" value={String(importSummary.created_categories)} />
                    <SummaryMetric label="Subcategorias nuevas" value={String(importSummary.created_subcategories)} />
                    <SummaryMetric label="Preguntas creadas" value={String(importSummary.created_questions)} />
                  </div>

                  {importSummary.errors.length ? (
                    <div className="mt-4 space-y-2">
                      {importSummary.errors.map((item) => (
                        <div
                          key={`${item.row_number}-${item.message}`}
                          className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive"
                        >
                          Fila {item.row_number}: {item.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalogo de ejercicios practicos de Excel</CardTitle>
          <CardDescription>
            Registra varios ejercicios practicos reutilizables para el examen.
            No estas limitado a un solo archivo: puedes subir nuevas versiones o
            distintos casos operativos cuando cambie el ejercicio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                El sistema valida automaticamente que el archivo tenga la hoja base,
                la hoja de trabajo y al menos una tabla dinamica real. Tambien calcula
                el resumen esperado para poder reutilizar ese ejercicio cuando mas
                adelante lo liguemos a preguntas practicas del examen.
              </div>

              <form className="space-y-4" onSubmit={handleExcelExerciseSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="excel-exercise-name">Nombre del ejercicio</Label>
                  <Input
                    id="excel-exercise-name"
                    placeholder="Ejercicio 1 - Tabla dinamica por mes"
                    value={excelExerciseForm.name}
                    onChange={(event) =>
                      setExcelExerciseForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excel-exercise-description">Descripcion</Label>
                  <Textarea
                    id="excel-exercise-description"
                    placeholder="Caso practico para resumir folios, claves, piezas y clues."
                    value={excelExerciseForm.description}
                    onChange={(event) =>
                      setExcelExerciseForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excel-exercise-instructions">Instrucciones para el candidato</Label>
                  <Textarea
                    id="excel-exercise-instructions"
                    placeholder="Descarga el archivo, actualiza la tabla dinamica y vuelve a subirlo."
                    value={excelExerciseForm.instructions}
                    onChange={(event) =>
                      setExcelExerciseForm((current) => ({
                        ...current,
                        instructions: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="excel-exercise-source-sheet">Hoja base</Label>
                    <Input
                      id="excel-exercise-source-sheet"
                      value={excelExerciseForm.source_sheet_name}
                      onChange={(event) =>
                        setExcelExerciseForm((current) => ({
                          ...current,
                          source_sheet_name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="excel-exercise-task-sheet">Hoja del ejercicio</Label>
                    <Input
                      id="excel-exercise-task-sheet"
                      value={excelExerciseForm.task_sheet_name}
                      onChange={(event) =>
                        setExcelExerciseForm((current) => ({
                          ...current,
                          task_sheet_name: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excel-exercise-file">Archivo Base (para el candidato)</Label>
                  <Input
                    key={`base-${fileInputKey}`}
                    id="excel-exercise-file"
                    type="file"
                    accept=".xlsx,.xlsm"
                    onChange={(event) =>
                      setExcelExerciseFile(event.target.files?.[0] ?? null)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excel-exercise-solution-file">Archivo Solución (con respuestas correctas)</Label>
                  <Input
                    key={`solution-${fileInputKey}`}
                    id="excel-exercise-solution-file"
                    type="file"
                    accept=".xlsx,.xlsm"
                    onChange={(event) =>
                      setExcelExerciseSolutionFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    El sistema extraerá los valores de la hoja de ejercicio para evaluar automáticamente a los candidatos.
                    Si editas un ejercicio existente, subir nuevos archivos es opcional.
                  </p>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={excelExerciseForm.is_active}
                    onChange={(event) =>
                      setExcelExerciseForm((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                  />
                  Dejar este ejercicio disponible para futuras vinculaciones
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isSubmittingExcelExercise}>
                    <FileUp className="size-4" />
                    {isSubmittingExcelExercise
                      ? 'Guardando...'
                      : editingExcelExerciseId
                        ? 'Actualizar ejercicio'
                        : 'Registrar ejercicio'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetExcelExerciseForm}
                  >
                    Limpiar
                  </Button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              {excelExercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{exercise.name}</p>
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          {exercise.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          {exercise.target_cells_count} celda(s) objetivo
                        </span>
                      </div>
                      {exercise.description ? (
                        <p className="text-sm text-muted-foreground">{exercise.description}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Archivo: {exercise.workbook_filename} | Base: {exercise.source_sheet_name} | Hoja del ejercicio: {exercise.task_sheet_name}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => handleEditExcelExercise(exercise)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => void handleDownloadExcelExercise(exercise)}
                      >
                        <Download className="size-4" />
                        Descargar
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => void handleToggleExcelExercise(exercise)}
                      >
                        <ToggleLeft className="size-4" />
                        {exercise.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => void handleDeleteExcelExercise(exercise)}
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {!excelExercises.length ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                  Aun no hay ejercicios practicos de Excel registrados. Puedes subir
                  varios casos y sustituir sus archivos cuando cambie el ejercicio.
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gestion de categorias</CardTitle>
            <CardDescription>
              Define la base tematica y la ponderacion de cada bloque de evaluacion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCategorySubmit}>
              <div className="space-y-2">
                <Label htmlFor="category-code">Codigo</Label>
                <Input
                  id="category-code"
                  placeholder="MATH"
                  value={categoryForm.code}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-weight">Ponderacion</Label>
                <Input
                  id="category-weight"
                  min="0.1"
                  step="0.1"
                  type="number"
                  value={categoryForm.weight}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      weight: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="category-name">Nombre</Label>
                <Input
                  id="category-name"
                  placeholder="Comprension matematica"
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="category-description">Descripcion</Label>
                <Textarea
                  id="category-description"
                  placeholder="Describe el enfoque de la categoria."
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit">
                  {editingCategoryId ? (
                    <>
                      <PencilLine className="size-4" />
                      Guardar cambios
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Crear categoria
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetCategoryForm}>
                  Limpiar
                </Button>
              </div>
            </form>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Codigo</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Peso</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-t border-border/70">
                      <td className="px-4 py-3 font-medium">{category.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{category.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {category.subcategory_count} subcategorias, {category.question_count} preguntas
                        </div>
                      </td>
                      <td className="px-4 py-3">{category.weight}</td>
                      <td className="px-4 py-3">{formatRelativeStatus(category.is_active)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(category.id)
                              setCategoryForm({
                                code: category.code,
                                name: category.name,
                                description: category.description ?? '',
                                weight: String(category.weight),
                              })
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => void handleToggleCategory(category)}
                          >
                            <ToggleLeft className="size-4" />
                            {category.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => void handleDeleteCategory(category)}
                          >
                            <Trash2 className="size-4" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!categories.length ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Aun no hay categorias registradas.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gestion de subcategorias</CardTitle>
            <CardDescription>
              Organiza cada categoria con mayor detalle para segmentar mejor el examen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-4" onSubmit={handleSubcategorySubmit}>
              <div className="space-y-2">
                <Label htmlFor="subcategory-category">Categoria</Label>
                <select
                  id="subcategory-category"
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                  value={subcategoryForm.category_id}
                  onChange={(event) =>
                    setSubcategoryForm((current) => ({
                      ...current,
                      category_id: event.target.value,
                    }))
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
                <Label htmlFor="subcategory-name">Nombre</Label>
                <Input
                  id="subcategory-name"
                  placeholder="Operaciones basicas"
                  value={subcategoryForm.name}
                  onChange={(event) =>
                    setSubcategoryForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory-description">Descripcion</Label>
                <Textarea
                  id="subcategory-description"
                  placeholder="Describe el enfoque puntual de la subcategoria."
                  value={subcategoryForm.description}
                  onChange={(event) =>
                    setSubcategoryForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={!categories.length}>
                  {editingSubcategoryId ? 'Guardar cambios' : 'Crear subcategoria'}
                </Button>
                <Button type="button" variant="outline" onClick={resetSubcategoryForm}>
                  Limpiar
                </Button>
              </div>
            </form>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Subcategoria</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {subcategories.map((subcategory) => (
                    <tr key={subcategory.id} className="border-t border-border/70">
                      <td className="px-4 py-3">{subcategory.category_name}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{subcategory.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {subcategory.question_count} preguntas
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatRelativeStatus(subcategory.is_active)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => {
                              setEditingSubcategoryId(subcategory.id)
                              setSubcategoryForm({
                                category_id: String(subcategory.category_id),
                                name: subcategory.name,
                                description: subcategory.description ?? '',
                              })
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => void handleToggleSubcategory(subcategory)}
                          >
                            <ToggleLeft className="size-4" />
                            {subcategory.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => void handleDeleteSubcategory(subcategory)}
                          >
                            <Trash2 className="size-4" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!subcategories.length ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Aun no hay subcategorias registradas.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Formulario de pregunta</CardTitle>
            <CardDescription>
              Crea reactivos de opcion multiple con tiempo, puntaje y retroalimentacion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleQuestionSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="question-category">Categoria</Label>
                  <select
                    id="question-category"
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                    value={questionForm.category_id}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        category_id: event.target.value,
                        subcategory_id: '',
                      }))
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
                  <Label htmlFor="question-subcategory">Subcategoria</Label>
                  <select
                    id="question-subcategory"
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                    value={questionForm.subcategory_id}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        subcategory_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecciona una subcategoria</option>
                    {filteredSubcategoriesForForm.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-difficulty">Dificultad</Label>
                  <select
                    id="question-difficulty"
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                    value={questionForm.difficulty}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        difficulty: event.target.value,
                      }))
                    }
                  >
                    <option value="basic">Basica</option>
                    <option value="intermediate">Intermedia</option>
                    <option value="advanced">Avanzada</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-type">Tipo de pregunta</Label>
                  <select
                    id="question-type"
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                    value={questionForm.question_type}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        question_type: event.target.value,
                        options: event.target.value === 'excel_practical' ? [] : ['', '', '', ''],
                        correct_answer: event.target.value === 'excel_practical' ? 'Archivo validado' : '',
                      }))
                    }
                  >
                    <option value="multiple_choice">Opcion multiple</option>
                    <option value="excel_practical">Ejercicio practico de Excel</option>
                  </select>
                </div>
                {questionForm.question_type === 'excel_practical' && (
                  <div className="space-y-2">
                    <Label htmlFor="question-excel-exercise">Ejercicio Practico</Label>
                    <select
                      id="question-excel-exercise"
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                      value={questionForm.excel_exercise_id}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          excel_exercise_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecciona un ejercicio de Excel</option>
                      {excelExercises.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="question-time">Tiempo maximo (segundos)</Label>
                  <Input
                    id="question-time"
                    min="1"
                    type="number"
                    value={questionForm.max_time_seconds}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        max_time_seconds: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-score">Puntaje</Label>
                  <Input
                    id="question-score"
                    min="0.1"
                    step="0.1"
                    type="number"
                    value={questionForm.score}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        score: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="question-statement">Pregunta</Label>
                <Textarea
                  id="question-statement"
                  placeholder="Redacta el reactivo."
                  value={questionForm.statement}
                  onChange={(event) =>
                    setQuestionForm((current) => ({
                      ...current,
                      statement: event.target.value,
                    }))
                  }
                />
              </div>

              {questionForm.question_type !== 'excel_practical' && (
                <>
                  <div className="space-y-3">
                    <Label>Opciones</Label>
                    <div className="grid gap-3">
                      {questionForm.options.map((option, index) => (
                        <Input
                          key={index}
                          placeholder={`Opcion ${index + 1}`}
                          value={option}
                          onChange={(event) => updateQuestionOption(index, event.target.value)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="question-correct-answer">Respuesta correcta</Label>
                    <select
                      id="question-correct-answer"
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                      value={questionForm.correct_answer}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          correct_answer: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecciona la respuesta correcta</option>
                      {questionForm.options
                        .map((option) => option.trim())
                        .filter(Boolean)
                        .map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="question-feedback">Retroalimentacion</Label>
                <Textarea
                  id="question-feedback"
                  placeholder="Explica por que la respuesta correcta es valida."
                  value={questionForm.feedback}
                  onChange={(event) =>
                    setQuestionForm((current) => ({
                      ...current,
                      feedback: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={!categories.length || !subcategories.length}>
                  {editingQuestionId ? 'Guardar pregunta' : 'Crear pregunta'}
                </Button>
                <Button type="button" variant="outline" onClick={resetQuestionForm}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Listado de preguntas</CardTitle>
                <CardDescription>
                  Filtra, revisa y edita el inventario actual de reactivos.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => void handleRefreshWithFilters()}>
                <RefreshCw className="size-4" />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                  value={String(questionFilters.category_id ?? '')}
                  onChange={(event) =>
                    setQuestionFilters((current) => ({
                      ...current,
                      category_id: event.target.value ? Number(event.target.value) : undefined,
                      subcategory_id: undefined,
                    }))
                  }
                >
                  <option value="">Todas</option>
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
                  value={String(questionFilters.subcategory_id ?? '')}
                  onChange={(event) =>
                    setQuestionFilters((current) => ({
                      ...current,
                      subcategory_id: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  {filteredSubcategoriesForSearch.map((subcategory) => (
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
                  value={questionFilters.difficulty ?? ''}
                  onChange={(event) =>
                    setQuestionFilters((current) => ({
                      ...current,
                      difficulty: event.target.value || undefined,
                    }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="basic">Basica</option>
                  <option value="intermediate">Intermedia</option>
                  <option value="advanced">Avanzada</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                  value={
                    typeof questionFilters.is_active === 'boolean'
                      ? String(questionFilters.is_active)
                      : ''
                  }
                  onChange={(event) =>
                    setQuestionFilters((current) => ({
                      ...current,
                      is_active:
                        event.target.value === ''
                          ? undefined
                          : event.target.value === 'true',
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Buscar</Label>
                <Input
                  placeholder="Texto de la pregunta"
                  value={questionFilters.search ?? ''}
                  onChange={(event) =>
                    setQuestionFilters((current) => ({
                      ...current,
                      search: event.target.value || undefined,
                    }))
                  }
                />
              </div>
              <div className="md:col-span-2 xl:col-span-5">
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => void handleRefreshWithFilters()}>
                    <Filter className="size-4" />
                    Aplicar filtros
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setQuestionFilters({})
                      void loadAllData({})
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pregunta</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Dificultad</th>
                    <th className="px-4 py-3 font-medium">Tiempo</th>
                    <th className="px-4 py-3 font-medium">Puntaje</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question) => (
                    <tr key={question.id} className="border-t border-border/70 align-top">
                      <td className="max-w-md px-4 py-3">
                        <div className="font-medium text-foreground">{question.statement}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {question.option_count} opciones
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{question.category_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {question.subcategory_name}
                        </div>
                      </td>
                      <td className="px-4 py-3">{question.difficulty}</td>
                      <td className="px-4 py-3">{question.max_time_seconds}s</td>
                      <td className="px-4 py-3">{question.score}</td>
                      <td className="px-4 py-3">{formatRelativeStatus(question.is_active)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => void handleEditQuestion(question.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => void handleToggleQuestion(question)}
                          >
                            <ToggleLeft className="size-4" />
                            {question.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => void handleDeleteQuestion(question)}
                          >
                            <Trash2 className="size-4" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!questions.length ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  {isLoading
                    ? 'Cargando preguntas...'
                    : 'No hay preguntas registradas con los filtros actuales.'}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
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

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
