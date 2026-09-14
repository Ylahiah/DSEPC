import axios from 'axios'
import {
  BookCopy,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  FolderTree,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Shapes,
  ToggleLeft,
  Trash2,
  Upload,
  X,
  XCircle,
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

type TabType = 'questions' | 'excel' | 'taxonomy' | 'import'

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

  return 'No fue posible completar la operación.'
}

export function QuestionBankPage() {
  const [activeTab, setActiveTab] = useState<TabType>('questions')
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [questions, setQuestions] = useState<QuestionListItem[]>([])
  const [excelExercises, setExcelExercises] = useState<ExcelExercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Modal Open States
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false)
  const [isExcelExerciseModalOpen, setIsExcelExerciseModalOpen] = useState(false)

  // Editing IDs
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<number | null>(null)
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [editingExcelExerciseId, setEditingExcelExerciseId] = useState<number | null>(null)

  // Form States
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(defaultCategoryForm)
  const [subcategoryForm, setSubcategoryForm] = useState<SubcategoryFormState>(defaultSubcategoryForm)
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(defaultQuestionForm)
  const [excelExerciseForm, setExcelExerciseForm] = useState<ExcelExerciseFormState>(defaultExcelExerciseForm)

  // Filter & Search States
  const [questionSearch, setQuestionSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')

  // Excel Files
  const [importFile, setImportFile] = useState<File | null>(null)
  const [excelExerciseFile, setExcelExerciseFile] = useState<File | null>(null)
  const [excelExerciseSolutionFile, setExcelExerciseSolutionFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(Date.now())
  const [isImporting, setIsImporting] = useState(false)
  const [isSubmittingExcelExercise, setIsSubmittingExcelExercise] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [importSummary, setImportSummary] = useState<QuestionImportSummary | null>(null)

  // Subcategories dependent on question form category
  const filteredSubcategoriesForForm = useMemo(
    () =>
      subcategories.filter(
        (subcategory) => String(subcategory.category_id) === questionForm.category_id,
      ),
    [questionForm.category_id, subcategories],
  )

  // Filtered Questions in Live Search
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterCategory && String(q.category_id) !== filterCategory) return false
      if (filterDifficulty && q.difficulty !== filterDifficulty) return false
      if (questionSearch.trim()) {
        const query = questionSearch.toLowerCase()
        const matchStatement = q.statement.toLowerCase().includes(query)
        const matchCat = q.category_name.toLowerCase().includes(query)
        const matchSub = q.subcategory_name?.toLowerCase().includes(query)
        if (!matchStatement && !matchCat && !matchSub) return false
      }
      return true
    })
  }, [questions, filterCategory, filterDifficulty, questionSearch])

  async function loadAllData() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [categoriesData, subcategoriesData, questionsData, excelExercisesData] = await Promise.all([
        getCategories(),
        getSubcategories(),
        getQuestions({}),
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

  // Reset Handlers
  function resetCategoryForm() {
    setEditingCategoryId(null)
    setCategoryForm(defaultCategoryForm)
    setIsCategoryModalOpen(false)
  }

  function resetSubcategoryForm() {
    setEditingSubcategoryId(null)
    setSubcategoryForm(defaultSubcategoryForm)
    setIsSubcategoryModalOpen(false)
  }

  function resetQuestionForm() {
    setEditingQuestionId(null)
    setQuestionForm(defaultQuestionForm)
    setIsQuestionModalOpen(false)
  }

  function resetExcelExerciseForm() {
    setEditingExcelExerciseId(null)
    setExcelExerciseForm(defaultExcelExerciseForm)
    setExcelExerciseFile(null)
    setExcelExerciseSolutionFile(null)
    setFileInputKey(Date.now())
    setIsExcelExerciseModalOpen(false)
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

  // Submit Handlers
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
        setFeedbackMessage('Categoría actualizada correctamente.')
      } else {
        await createCategory(payload)
        setFeedbackMessage('Categoría creada correctamente.')
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
        setFeedbackMessage('Subcategoría actualizada correctamente.')
      } else {
        await createSubcategory(payload)
        setFeedbackMessage('Subcategoría creada correctamente.')
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
      setIsQuestionModalOpen(true)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
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
        setFeedbackMessage('Ejercicio práctico actualizado correctamente.')
      } else {
        await createExcelExercise(payload)
        setFeedbackMessage('Ejercicio práctico registrado correctamente.')
      }

      resetExcelExerciseForm()
      await loadAllData()
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
    setIsExcelExerciseModalOpen(true)
  }

  function handleEditCategory(category: Category) {
    setEditingCategoryId(category.id)
    setCategoryForm({
      code: category.code,
      name: category.name,
      description: category.description ?? '',
      weight: String(category.weight),
    })
    setIsCategoryModalOpen(true)
  }

  function handleEditSubcategory(subcategory: Subcategory) {
    setEditingSubcategoryId(subcategory.id)
    setSubcategoryForm({
      category_id: String(subcategory.category_id),
      name: subcategory.name,
      description: subcategory.description ?? '',
    })
    setIsSubcategoryModalOpen(true)
  }

  async function handleToggleQuestion(question: QuestionListItem) {
    try {
      await setQuestionStatus(question.id, !question.is_active)
      setFeedbackMessage('Estado de pregunta actualizado.')
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  const [itemToDelete, setItemToDelete] = useState<{
    type: 'question' | 'category' | 'subcategory' | 'excel'
    id: number
    title: string
  } | null>(null)
  const [isDeletingItem, setIsDeletingItem] = useState(false)

  async function handleConfirmDeleteItem() {
    if (!itemToDelete) return

    setIsDeletingItem(true)
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      if (itemToDelete.type === 'question') {
        await deleteQuestion(itemToDelete.id)
        setFeedbackMessage('Pregunta eliminada correctamente.')
      } else if (itemToDelete.type === 'category') {
        await deleteCategory(itemToDelete.id)
        setFeedbackMessage('Categoría eliminada correctamente.')
      } else if (itemToDelete.type === 'subcategory') {
        await deleteSubcategory(itemToDelete.id)
        setFeedbackMessage('Subcategoría eliminada correctamente.')
      } else if (itemToDelete.type === 'excel') {
        await deleteExcelExercise(itemToDelete.id)
        setFeedbackMessage('Ejercicio práctico eliminado correctamente.')
      }
      setItemToDelete(null)
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDeletingItem(false)
    }
  }

  function handleDeleteQuestion(question: QuestionListItem) {
    setItemToDelete({
      type: 'question',
      id: question.id,
      title: question.statement,
    })
  }

  async function handleToggleCategory(category: Category) {
    try {
      await setCategoryStatus(category.id, !category.is_active)
      setFeedbackMessage('Estado de categoría actualizado.')
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  function handleDeleteCategory(category: Category) {
    setItemToDelete({
      type: 'category',
      id: category.id,
      title: category.name,
    })
  }

  async function handleToggleSubcategory(subcategory: Subcategory) {
    try {
      await setSubcategoryStatus(subcategory.id, !subcategory.is_active)
      setFeedbackMessage('Estado de subcategoría actualizado.')
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  function handleDeleteSubcategory(subcategory: Subcategory) {
    setItemToDelete({
      type: 'subcategory',
      id: subcategory.id,
      title: subcategory.name,
    })
  }

  async function handleToggleExcelExercise(exercise: ExcelExercise) {
    try {
      await setExcelExerciseStatus(exercise.id, !exercise.is_active)
      setFeedbackMessage('Estado del ejercicio actualizado.')
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  function handleDeleteExcelExercise(exercise: ExcelExercise) {
    setItemToDelete({
      type: 'excel',
      id: exercise.id,
      title: exercise.name,
    })
  }

  async function handleDownloadExcelExercise(exercise: ExcelExercise) {
    try {
      await downloadExcelExerciseWorkbook(exercise.id, exercise.workbook_filename)
      setFeedbackMessage('Archivo descargado correctamente.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
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
        setErrorMessage('La importación tuvo observaciones en algunas filas.')
        return
      }

      setFeedbackMessage(
        `Importación completada: ${summary.created_questions} preguntas creadas.`,
      )
      setImportFile(null)
      await loadAllData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsImporting(false)
    }
  }

  async function handleDownloadTemplate() {
    setIsDownloadingTemplate(true)
    try {
      await downloadQuestionImportTemplate()
      setFeedbackMessage('Plantilla Excel descargada.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Banco de Preguntas y Contenidos
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Administración modular de reactivos teóricos, ejercicios prácticos y taxonomía.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadAllData()}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {feedbackMessage ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{feedbackMessage}</span>
          </div>
          <button type="button" onClick={() => setFeedbackMessage('')} className="text-emerald-600 hover:text-emerald-900">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <XCircle className="size-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage('')} className="text-rose-600 hover:text-rose-900">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* KPI Cards / Direct Tab Switchers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`rounded-lg border p-4 text-left shadow-2xs transition-all cursor-pointer ${
            activeTab === 'questions'
              ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Preguntas Teóricas</span>
            <div className={`flex size-8 items-center justify-center rounded-md ${activeTab === 'questions' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <BookCopy className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{questions.length}</div>
          <p className="mt-1 text-[11px] text-slate-400">Banco de preguntas activas</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`rounded-lg border p-4 text-left shadow-2xs transition-all cursor-pointer ${
            activeTab === 'excel'
              ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ejercicios Excel</span>
            <div className={`flex size-8 items-center justify-center rounded-md ${activeTab === 'excel' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              <FileSpreadsheet className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{excelExercises.length}</div>
          <p className="mt-1 text-[11px] text-slate-400">Prácticos interactivos</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('taxonomy')}
          className={`rounded-lg border p-4 text-left shadow-2xs transition-all cursor-pointer ${
            activeTab === 'taxonomy'
              ? 'border-purple-600 bg-purple-50/40 ring-1 ring-purple-600'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Taxonomía</span>
            <div className={`flex size-8 items-center justify-center rounded-md ${activeTab === 'taxonomy' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600'}`}>
              <Shapes className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {categories.length} <span className="text-sm font-normal text-slate-500">/ {subcategories.length} sub</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Categorías y subcategorías</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`rounded-lg border p-4 text-left shadow-2xs transition-all cursor-pointer ${
            activeTab === 'import'
              ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-600'
              : 'border-slate-200/80 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Importación Masiva</span>
            <div className={`flex size-8 items-center justify-center rounded-md ${activeTab === 'import' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <Upload className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">Excel .xlsx</div>
          <p className="mt-1 text-[11px] text-slate-400">Carga rápida por plantilla</p>
        </button>
      </div>

      {/* Segmented Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-2 py-1 rounded-lg border">
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'questions'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookCopy className="size-3.5" />
          Preguntas del Banco ({questions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'excel'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="size-3.5" />
          Ejercicios Excel ({excelExercises.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('taxonomy')}
          className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'taxonomy'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FolderTree className="size-3.5" />
          Categorías ({categories.length}) y Subcategorías ({subcategories.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
            activeTab === 'import'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileUp className="size-3.5" />
          Importación Masiva
        </button>
      </div>

      {/* TAB 1: PREGUNTAS DEL BANCO */}
      {activeTab === 'questions' && (
        <Card>
          <CardHeader className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Catálogo de Reactivos</CardTitle>
                <CardDescription className="text-xs">
                  {filteredQuestions.length} de {questions.length} preguntas en el banco
                </CardDescription>
              </div>

              {/* Search, Filter & Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Buscar reactivo..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="pl-8 text-xs h-8.5"
                  />
                  {questionSearch && (
                    <button
                      type="button"
                      onClick={() => setQuestionSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-8.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-blue-600"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="h-8.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-blue-600"
                >
                  <option value="">Dificultad (Todas)</option>
                  <option value="basic">Básica</option>
                  <option value="intermediate">Intermedia</option>
                  <option value="advanced">Avanzada</option>
                </select>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditingQuestionId(null)
                    setQuestionForm(defaultQuestionForm)
                    setIsQuestionModalOpen(true)
                  }}
                  className="h-8.5"
                >
                  <Plus className="size-3.5" />
                  Nueva Pregunta
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-y border-slate-200 bg-slate-100/90 text-slate-600 backdrop-blur">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Enunciado / Pregunta</th>
                    <th className="px-4 py-2.5 font-semibold">Categoría & Subcategoría</th>
                    <th className="px-4 py-2.5 font-semibold">Dificultad</th>
                    <th className="px-4 py-2.5 font-semibold">Tiempo / Pts</th>
                    <th className="px-4 py-2.5 font-semibold">Estado</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuestions.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 max-w-md">
                        <div className="font-medium text-slate-900 leading-snug">{q.statement}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          Tipo: {q.question_type === 'excel_practical' ? '📊 Ejercicio Excel' : '📝 Opción Múltiple'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{q.category_name}</div>
                        <div className="text-[11px] text-slate-400">{q.subcategory_name || 'General'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            q.difficulty === 'basic'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : q.difficulty === 'intermediate'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-purple-200 bg-purple-50 text-purple-700'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {q.max_time_seconds}s • {q.score} pts
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            q.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {q.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleEditQuestion(q.id)}
                            className="h-7 px-2 text-xs"
                            title="Editar reactivo"
                          >
                            <PencilLine className="size-3 text-slate-500" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleQuestion(q)}
                            className="h-7 px-2 text-xs text-slate-600"
                            title={q.is_active ? 'Desactivar' : 'Activar'}
                          >
                            <ToggleLeft className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteQuestion(q)}
                            className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Eliminar reactivo"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredQuestions.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        {isLoading ? 'Cargando preguntas...' : 'No se encontraron preguntas con los filtros aplicados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: EJERCICIOS PRÁCTICOS DE EXCEL */}
      {activeTab === 'excel' && (
        <Card>
          <CardHeader className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Ejercicios Prácticos de Excel</CardTitle>
                <CardDescription className="text-xs">
                  Libros .xlsx con tablas dinámicas y validación automática de celdas
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingExcelExerciseId(null)
                  setExcelExerciseForm(defaultExcelExerciseForm)
                  setExcelExerciseFile(null)
                  setExcelExerciseSolutionFile(null)
                  setIsExcelExerciseModalOpen(true)
                }}
              >
                <Plus className="size-3.5" />
                Nuevo Ejercicio Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              {excelExercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{exercise.name}</span>
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.2 text-[10px] font-semibold ${
                            exercise.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {exercise.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {exercise.description && (
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{exercise.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5 text-[11px] text-slate-600 space-y-1 font-mono">
                    <div>Archivo: <strong className="text-slate-800">{exercise.workbook_filename}</strong></div>
                    <div>Hojas: <strong className="text-slate-800">{exercise.source_sheet_name}</strong> (Base) • <strong className="text-slate-800">{exercise.task_sheet_name}</strong> (Trabajo)</div>
                    <div>Validación: <strong className="text-blue-700">{exercise.target_cells_count} celdas objetivo</strong></div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => void handleDownloadExcelExercise(exercise)}
                      className="h-7 text-xs px-2"
                    >
                      <Download className="size-3" />
                      Descargar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => handleEditExcelExercise(exercise)}
                      className="h-7 text-xs px-2"
                    >
                      <PencilLine className="size-3" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => void handleToggleExcelExercise(exercise)}
                      className="h-7 text-xs px-2"
                    >
                      <ToggleLeft className="size-3" />
                      {exercise.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => void handleDeleteExcelExercise(exercise)}
                      className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {!excelExercises.length && (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-xs text-slate-500">
                Aún no hay ejercicios prácticos de Excel registrados. Haz clic en <strong>Nuevo Ejercicio Excel</strong> para cargar un caso.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: TAXONOMÍA (CATEGORÍAS Y SUBCATEGORÍAS) */}
      {activeTab === 'taxonomy' && (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Categorías */}
          <Card>
            <CardHeader className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shapes className="size-4 text-blue-600" />
                    Categorías Principales
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Áreas temáticas y ponderaciones de evaluación
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditingCategoryId(null)
                    setCategoryForm(defaultCategoryForm)
                    setIsCategoryModalOpen(true)
                  }}
                >
                  <Plus className="size-3.5" />
                  Nueva Categoría
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full text-left text-xs">
                <thead className="border-y border-slate-200 bg-slate-100/90 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Código</th>
                    <th className="px-4 py-2 font-semibold">Nombre</th>
                    <th className="px-4 py-2 font-semibold">Ponderación</th>
                    <th className="px-4 py-2 font-semibold">Estado</th>
                    <th className="px-4 py-2 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">{c.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {c.subcategory_count} subcategorías • {c.question_count} reactivos
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{c.weight}x</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            c.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCategory(c)}
                            className="h-7 px-2 text-xs"
                          >
                            <PencilLine className="size-3 text-slate-500" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleCategory(c)}
                            className="h-7 px-2 text-xs"
                          >
                            <ToggleLeft className="size-3 text-slate-500" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteCategory(c)}
                            className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Subcategorías */}
          <Card>
            <CardHeader className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderTree className="size-4 text-purple-600" />
                    Subcategorías
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Especialidades técnicas asociadas a categorías
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditingSubcategoryId(null)
                    setSubcategoryForm(defaultSubcategoryForm)
                    setIsSubcategoryModalOpen(true)
                  }}
                >
                  <Plus className="size-3.5" />
                  Nueva Subcategoría
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full text-left text-xs">
                <thead className="border-y border-slate-200 bg-slate-100/90 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Subcategoría</th>
                    <th className="px-4 py-2 font-semibold">Categoría Padre</th>
                    <th className="px-4 py-2 font-semibold">Estado</th>
                    <th className="px-4 py-2 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {subcategories.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{sub.name}</div>
                        <div className="text-[11px] text-slate-400">{sub.question_count} reactivos</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{sub.category_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            sub.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sub.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSubcategory(sub)}
                            className="h-7 px-2 text-xs"
                          >
                            <PencilLine className="size-3 text-slate-500" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleSubcategory(sub)}
                            className="h-7 px-2 text-xs"
                          >
                            <ToggleLeft className="size-3 text-slate-500" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteSubcategory(sub)}
                            className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: IMPORTACIÓN MASIVA */}
      {activeTab === 'import' && (
        <Card>
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="size-4 text-amber-600" />
              Importación Masiva desde Excel
            </CardTitle>
            <CardDescription className="text-xs">
              Carga rápida por archivo con generación automática de categorías y subcategorías
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-200/80 bg-slate-50/60 p-5">
                <div className="space-y-2">
                  <Label htmlFor="questions-import-file">Seleccionar archivo Excel (.xlsx / .xlsm)</Label>
                  <Input
                    id="questions-import-file"
                    type="file"
                    accept=".xlsx,.xlsm"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    type="button"
                    disabled={isImporting || !importFile}
                    onClick={() => void handleImportQuestions()}
                  >
                    <FileUp className="size-3.5" />
                    {isImporting ? 'Importando reactivos...' : 'Procesar e Importar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDownloadingTemplate}
                    onClick={() => void handleDownloadTemplate()}
                  >
                    <Download className="size-3.5" />
                    {isDownloadingTemplate ? 'Descargando...' : 'Descargar Plantilla Oficial'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200/80 bg-white p-5 text-xs">
                <p className="font-bold text-slate-900">Estructura requerida de la plantilla:</p>
                <ul className="space-y-1.5 text-slate-600 list-disc list-inside leading-relaxed">
                  <li><strong>Categoria</strong> y <strong>Subcategoria</strong> (creadas automáticamente si no existen).</li>
                  <li><strong>Dificultad</strong>: <code>basic</code>, <code>intermediate</code> o <code>advanced</code>.</li>
                  <li><strong>Tiempo maximo</strong> (en segundos) y <strong>Puntaje</strong>.</li>
                  <li>Columnas de opciones (<strong>Opcion 1</strong> a <strong>Opcion 4</strong>).</li>
                  <li><strong>Respuesta correcta</strong> (coincidencia con texto o letra).</li>
                </ul>
              </div>
            </div>

            {importSummary && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 text-xs">
                <p className="font-semibold text-slate-900">Resumen de la última importación:</p>
                <div className="grid gap-3 sm:grid-cols-3 font-mono">
                  <div className="rounded border bg-slate-50 p-2.5">
                    <span className="text-slate-500 block text-[10px]">PREGUNTAS CREADAS</span>
                    <strong className="text-lg text-emerald-700">{importSummary.created_questions}</strong>
                  </div>
                  <div className="rounded border bg-slate-50 p-2.5">
                    <span className="text-slate-500 block text-[10px]">CATEGORÍAS NUEVAS</span>
                    <strong className="text-lg text-blue-700">{importSummary.created_categories}</strong>
                  </div>
                  <div className="rounded border bg-slate-50 p-2.5">
                    <span className="text-slate-500 block text-[10px]">SUBCATEGORÍAS NUEVAS</span>
                    <strong className="text-lg text-purple-700">{importSummary.created_subcategories}</strong>
                  </div>
                </div>

                {importSummary.errors.length ? (
                  <div className="space-y-1.5 pt-2">
                    <p className="font-semibold text-rose-700">Errores detectados:</p>
                    {importSummary.errors.map((item) => (
                      <div key={`${item.row_number}-${item.message}`} className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-800">
                        Fila {item.row_number}: {item.message}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL: CREAR / EDITAR PREGUNTA */}
      {isQuestionModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto"
              onClick={() => setIsQuestionModalOpen(false)}
            >
              <div
                className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 my-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingQuestionId ? 'Editar Pregunta' : 'Nueva Pregunta'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsQuestionModalOpen(false)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <form className="space-y-4 text-xs" onSubmit={handleQuestionSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="modal-q-statement">Enunciado o Pregunta</Label>
                    <Textarea
                      id="modal-q-statement"
                      rows={2}
                      placeholder="¿Cuál es la función en Excel para sumar rangos con condición?"
                      value={questionForm.statement}
                      onChange={(e) => setQuestionForm((curr) => ({ ...curr, statement: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="modal-q-category">Categoría</Label>
                      <select
                        id="modal-q-category"
                        value={questionForm.category_id}
                        onChange={(e) => setQuestionForm((curr) => ({ ...curr, category_id: e.target.value, subcategory_id: '' }))}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        required
                      >
                        <option value="">Selecciona una categoría...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={String(c.id)}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="modal-q-subcategory">Subcategoría</Label>
                      <select
                        id="modal-q-subcategory"
                        value={questionForm.subcategory_id}
                        onChange={(e) => setQuestionForm((curr) => ({ ...curr, subcategory_id: e.target.value }))}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        required
                      >
                        <option value="">Selecciona subcategoría...</option>
                        {filteredSubcategoriesForForm.map((s) => (
                          <option key={s.id} value={String(s.id)}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="modal-q-type">Tipo de Pregunta</Label>
                      <select
                        id="modal-q-type"
                        value={questionForm.question_type}
                        onChange={(e) => setQuestionForm((curr) => ({ ...curr, question_type: e.target.value }))}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="multiple_choice">Opción Múltiple</option>
                        <option value="excel_practical">Ejercicio Excel</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="modal-q-diff">Dificultad</Label>
                      <select
                        id="modal-q-diff"
                        value={questionForm.difficulty}
                        onChange={(e) => setQuestionForm((curr) => ({ ...curr, difficulty: e.target.value }))}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="basic">Básica</option>
                        <option value="intermediate">Intermedia</option>
                        <option value="advanced">Avanzada</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="modal-q-time">Tiempo Límite (segundos)</Label>
                      <Input
                        id="modal-q-time"
                        type="number"
                        min="10"
                        value={questionForm.max_time_seconds}
                        onChange={(e) => setQuestionForm((curr) => ({ ...curr, max_time_seconds: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {questionForm.question_type === 'excel_practical' && (
                    <div className="space-y-1.5 rounded-md border border-blue-200 bg-blue-50/50 p-3">
                      <Label htmlFor="modal-q-excel-link">Ejercicio Excel Vinculado</Label>
                      <select
                        id="modal-q-excel-link"
                        value={questionForm.excel_exercise_id}
                        onChange={(e) => setQuestionForm((curr) => ({ ...curr, excel_exercise_id: e.target.value }))}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="">Selecciona ejercicio práctico...</option>
                        {excelExercises.map((ex) => (
                          <option key={ex.id} value={String(ex.id)}>{ex.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {questionForm.question_type === 'multiple_choice' && (
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <Label>Opciones de Respuesta y Selección de la Correcta</Label>
                      <div className="grid gap-2">
                        {questionForm.options.map((option, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="modal_correct_ans"
                              checked={questionForm.correct_answer === option && option.trim().length > 0}
                              onChange={() => setQuestionForm((curr) => ({ ...curr, correct_answer: option.trim() }))}
                              disabled={!option.trim()}
                              title="Marcar como respuesta correcta"
                              className="accent-blue-600"
                            />
                            <Input
                              placeholder={`Opción ${idx + 1}`}
                              value={option}
                              onChange={(e) => updateQuestionOption(idx, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-q-feedback">Retroalimentación / Justificación</Label>
                    <Input
                      id="modal-q-feedback"
                      placeholder="Explicación de por qué esta respuesta es la correcta..."
                      value={questionForm.feedback}
                      onChange={(e) => setQuestionForm((curr) => ({ ...curr, feedback: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsQuestionModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm">
                      {editingQuestionId ? 'Actualizar Reactivo' : 'Guardar Reactivo'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* MODAL: CATEGORÍA */}
      {isCategoryModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingCategoryId ? 'Editar Categoría' : 'Nueva Categoría'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <form className="space-y-3 text-xs" onSubmit={handleCategorySubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="modal-cat-code">Código Identificador</Label>
                    <Input
                      id="modal-cat-code"
                      placeholder="EXCEL"
                      value={categoryForm.code}
                      onChange={(e) => setCategoryForm((curr) => ({ ...curr, code: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-cat-name">Nombre de la Categoría</Label>
                    <Input
                      id="modal-cat-name"
                      placeholder="Habilidades en Excel"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm((curr) => ({ ...curr, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-cat-weight">Ponderación (Multiplicador)</Label>
                    <Input
                      id="modal-cat-weight"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={categoryForm.weight}
                      onChange={(e) => setCategoryForm((curr) => ({ ...curr, weight: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-cat-desc">Descripción (Opcional)</Label>
                    <Textarea
                      id="modal-cat-desc"
                      rows={2}
                      placeholder="Área de evaluación para tablas dinámicas y fórmulas..."
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm((curr) => ({ ...curr, description: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCategoryModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm">
                      {editingCategoryId ? 'Actualizar Categoría' : 'Guardar Categoría'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* MODAL: SUBCATEGORÍA */}
      {isSubcategoryModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
              onClick={() => setIsSubcategoryModalOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingSubcategoryId ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsSubcategoryModalOpen(false)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <form className="space-y-3 text-xs" onSubmit={handleSubcategorySubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="modal-sub-cat">Categoría Padre</Label>
                    <select
                      id="modal-sub-cat"
                      value={subcategoryForm.category_id}
                      onChange={(e) => setSubcategoryForm((curr) => ({ ...curr, category_id: e.target.value }))}
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      required
                    >
                      <option value="">Selecciona categoría padre...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-sub-name">Nombre de la Subcategoría</Label>
                    <Input
                      id="modal-sub-name"
                      placeholder="Tablas Dinámicas y Filtros"
                      value={subcategoryForm.name}
                      onChange={(e) => setSubcategoryForm((curr) => ({ ...curr, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-sub-desc">Descripción (Opcional)</Label>
                    <Textarea
                      id="modal-sub-desc"
                      rows={2}
                      placeholder="Reactivos orientados a agrupaciones..."
                      value={subcategoryForm.description}
                      onChange={(e) => setSubcategoryForm((curr) => ({ ...curr, description: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsSubcategoryModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm">
                      {editingSubcategoryId ? 'Actualizar Subcategoría' : 'Guardar Subcategoría'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* MODAL: EJERCICIO PRÁCTICO EXCEL */}
      {isExcelExerciseModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto"
              onClick={() => setIsExcelExerciseModalOpen(false)}
            >
              <div
                className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 my-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingExcelExerciseId ? 'Editar Ejercicio Excel' : 'Cargar Nuevo Ejercicio Excel'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsExcelExerciseModalOpen(false)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <form className="space-y-3 text-xs" onSubmit={handleExcelExerciseSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="modal-ex-name">Nombre del Ejercicio</Label>
                    <Input
                      id="modal-ex-name"
                      placeholder="Ejercicio 1 - Tablas dinámicas y resumen mensual"
                      value={excelExerciseForm.name}
                      onChange={(e) => setExcelExerciseForm((curr) => ({ ...curr, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-ex-instructions">Instrucciones para el Candidato</Label>
                    <Textarea
                      id="modal-ex-instructions"
                      rows={2}
                      placeholder="Descarga el archivo, analiza la base y genera la tabla dinámica solicitada..."
                      value={excelExerciseForm.instructions}
                      onChange={(e) => setExcelExerciseForm((curr) => ({ ...curr, instructions: e.target.value }))}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="modal-ex-source">Nombre de Hoja Base</Label>
                      <Input
                        id="modal-ex-source"
                        value={excelExerciseForm.source_sheet_name}
                        onChange={(e) => setExcelExerciseForm((curr) => ({ ...curr, source_sheet_name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="modal-ex-task">Nombre de Hoja de Trabajo</Label>
                      <Input
                        id="modal-ex-task"
                        value={excelExerciseForm.task_sheet_name}
                        onChange={(e) => setExcelExerciseForm((curr) => ({ ...curr, task_sheet_name: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-ex-base-file">Archivo Base (.xlsx para el candidato)</Label>
                    <Input
                      key={`base-${fileInputKey}`}
                      id="modal-ex-base-file"
                      type="file"
                      accept=".xlsx,.xlsm"
                      onChange={(e) => setExcelExerciseFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="modal-ex-sol-file">Archivo Solución (.xlsx con valores correctos)</Label>
                    <Input
                      key={`solution-${fileInputKey}`}
                      id="modal-ex-sol-file"
                      type="file"
                      accept=".xlsx,.xlsm"
                      onChange={(e) => setExcelExerciseSolutionFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsExcelExerciseModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" disabled={isSubmittingExcelExercise}>
                      {isSubmittingExcelExercise ? 'Guardando...' : editingExcelExerciseId ? 'Actualizar Ejercicio' : 'Registrar Ejercicio'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Modal de Confirmación para Eliminaciones del Banco */}
      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        title={
          itemToDelete?.type === 'question'
            ? 'Eliminar Pregunta'
            : itemToDelete?.type === 'category'
              ? 'Eliminar Categoría'
              : itemToDelete?.type === 'subcategory'
                ? 'Eliminar Subcategoría'
                : 'Eliminar Ejercicio Práctico'
        }
        description={
          itemToDelete?.type === 'question'
            ? `¿Estás seguro de que deseas eliminar la pregunta:\n"${itemToDelete?.title.slice(0, 100)}..."?\n\nEsta acción eliminará sus opciones y referencias asociadas.`
            : itemToDelete?.type === 'category'
              ? `¿Estás seguro de que deseas eliminar la categoría "${itemToDelete?.title}"?\n\nSolo se puede eliminar si no tiene preguntas asociadas.`
              : itemToDelete?.type === 'subcategory'
                ? `¿Estás seguro de que deseas eliminar la subcategoría "${itemToDelete?.title}"?\n\nSolo se puede eliminar si no tiene preguntas asociadas.`
                : `¿Estás seguro de que deseas eliminar el ejercicio práctico "${itemToDelete?.title}"?\n\nEsta acción no se puede deshacer.`
        }
        confirmText="Eliminar Elemento"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingItem}
        onConfirm={handleConfirmDeleteItem}
        onClose={() => {
          if (!isDeletingItem) setItemToDelete(null)
        }}
      />
    </div>
  )
}
