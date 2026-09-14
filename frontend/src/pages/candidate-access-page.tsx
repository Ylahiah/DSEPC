import axios from 'axios'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Compass,
  FileCheck,
  Info,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  TimerReset,
  User,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

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
import {
  completeCandidateSession,
  getCandidateSession,
  saveCandidateAnswer,
  startCandidateSession,
  trackCandidateHeartbeat,
  validateCandidateAccessCode,
  getActiveAccessCodes,
  type CandidateSession,
  type CandidateSessionCompletion,
  type CandidateSessionProgress,
} from '@/features/candidate-access/candidate-access-service'
import { getLogoUrl, getSystemSettings, type SystemSetting } from '@/features/settings/settings-service'
import { InteractiveExcelQuestion } from '@/features/candidate-access/components/interactive-excel-question'

const CANDIDATE_SESSION_STORAGE_KEY = 'dsepc.candidate.sessionId'

type CandidateStep = 'access' | 'details' | 'exam' | 'completed'

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

function formatSeconds(totalSeconds: number): string {
  const normalized = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(normalized / 60)
  const seconds = normalized % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function CandidateAccessPage() {
  const [step, setStep] = useState<CandidateStep>('access')
  const [accessCode, setAccessCode] = useState('')
  const [activeAccessCodes, setActiveAccessCodes] = useState<string[]>([])
  const [accessFeedback, setAccessFeedback] = useState('')
  const [validatedTemplateName, setValidatedTemplateName] = useState('')
  const [detailsForm, setDetailsForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    employee_reference: '',
  })
  const [session, setSession] = useState<CandidateSession | null>(null)
  const [, setProgress] = useState<CandidateSessionProgress | null>(null)
  const [completion, setCompletion] = useState<CandidateSessionCompletion | null>(null)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [serverMessage, setServerMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [timeRemainingLabel, setTimeRemainingLabel] = useState('')
  const [isSyncingNavigation, setIsSyncingNavigation] = useState(false)
  const [systemSettings, setSystemSettings] = useState<SystemSetting | null>(null)

  const questionStartedAtRef = useRef<number>(Date.now())
  const expiryRefreshRequestedRef = useRef(false)

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const settings = await getSystemSettings()
      setSystemSettings(settings)
      if (settings.primary_color) {
        document.documentElement.style.setProperty('--primary', settings.primary_color)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  useEffect(() => {
    if (step === 'access') {
      getActiveAccessCodes()
        .then((codes) => setActiveAccessCodes(codes))
        .catch(console.error)
    }

    const storedSessionId = localStorage.getItem(CANDIDATE_SESSION_STORAGE_KEY)

    if (!storedSessionId) {
      return
    }

    setIsBusy(true)
    void getCandidateSession(Number(storedSessionId))
      .then((storedSession) => {
        handleSessionLoaded(storedSession)
      })
      .catch(() => {
        localStorage.removeItem(CANDIDATE_SESSION_STORAGE_KEY)
      })
      .finally(() => {
        setIsBusy(false)
      })
  }, [])

  useEffect(() => {
    if (!session || step !== 'exam') {
      setTimeRemainingLabel('')
      expiryRefreshRequestedRef.current = false
      return
    }

    const timer = window.setInterval(() => {
      const remainingMs = new Date(session.expires_at).getTime() - Date.now()
      if (remainingMs <= 0) {
        setTimeRemainingLabel('0:00')
        if (!expiryRefreshRequestedRef.current) {
          expiryRefreshRequestedRef.current = true
          void getCandidateSession(session.id)
            .then((expiredSession) => {
              handleSessionLoaded(expiredSession)
            })
            .catch(() => {
              setErrorMessage('No fue posible sincronizar el cierre por tiempo.')
            })
        }
        return
      }

      const totalSeconds = Math.floor(remainingMs / 1000)
      setTimeRemainingLabel(formatSeconds(totalSeconds))
    }, 1000)

    return () => clearInterval(timer)
  }, [session, step])

  useEffect(() => {
    questionStartedAtRef.current = Date.now()
  }, [activeSectionIndex, activeQuestionIndex, session?.id])

  const totalQuestions = session
    ? session.sections.reduce((count, section) => count + section.questions.length, 0)
    : 0

  const answeredQuestions = session?.answered_questions_count ?? 0
  const omittedQuestions = session?.omitted_questions_count ?? 0
  const currentSection = session?.sections[activeSectionIndex] ?? null
  const currentQuestion = currentSection?.questions[activeQuestionIndex] ?? null
  const progressPercent = totalQuestions
    ? Math.round((answeredQuestions / totalQuestions) * 100)
    : 0
  const remainingSeconds = session
    ? Math.max(0, session.total_time_seconds - session.consumed_time_seconds)
    : 0

  function buildCompletionFromSession(loadedSession: CandidateSession) {
    const totalPossible = loadedSession.category_results.reduce(
      (count, cat) => count + cat.score_possible,
      0,
    )
    const totalObtained = loadedSession.category_results.reduce(
      (count, cat) => count + cat.score_obtained,
      0,
    )
    const scorePct =
      totalPossible > 0
        ? Math.round((totalObtained / totalPossible) * 1000) / 10
        : 0
    const passingPct = 80
    const isApto = scorePct >= passingPct

    return {
      session_id: loadedSession.id,
      status: loadedSession.status,
      answered_questions: loadedSession.answered_questions_count,
      total_questions: loadedSession.sections.reduce(
        (count, section) => count + section.questions.length,
        0,
      ),
      omitted_questions: loadedSession.omitted_questions_count,
      correct_questions: loadedSession.correct_questions_count,
      incorrect_questions: loadedSession.incorrect_questions_count,
      consumed_time_seconds: loadedSession.consumed_time_seconds,
      average_time_per_question_seconds:
        loadedSession.average_time_per_question_seconds,
      total_score: loadedSession.total_score,
      total_score_possible: totalPossible,
      score_percentage: scorePct,
      passing_score_percentage: passingPct,
      is_apto: isApto,
      candidate_name: `${loadedSession.candidate.first_name} ${loadedSession.candidate.last_name}`.trim(),
      template_name: loadedSession.template_name,
      show_result_to_candidate: loadedSession.show_result_to_candidate,
      message: loadedSession.completed_by_timeout
        ? 'La evaluacion se cerro automaticamente por tiempo agotado.'
        : loadedSession.show_result_to_candidate
          ? 'La evaluacion ya habia sido finalizada.'
          : 'La evaluacion ya habia sido finalizada correctamente.',
      category_results: loadedSession.category_results,
    } satisfies CandidateSessionCompletion
  }

  function handleSessionLoaded(loadedSession: CandidateSession) {
    setSession(loadedSession)
    setActiveSectionIndex(loadedSession.current_section_index)
    setActiveQuestionIndex(loadedSession.current_question_index)
    setValidatedTemplateName(loadedSession.template_name)
    setDetailsForm({
      first_name: loadedSession.candidate.first_name,
      last_name: loadedSession.candidate.last_name,
      email: loadedSession.candidate.email ?? '',
      phone: loadedSession.candidate.phone ?? '',
      employee_reference: loadedSession.candidate.employee_reference ?? '',
    })
    setProgress({
      session_id: loadedSession.id,
      status: loadedSession.status,
      answered_questions: loadedSession.answered_questions_count,
      total_questions: loadedSession.sections.reduce(
        (count, section) => count + section.questions.length,
        0,
      ),
      omitted_questions: loadedSession.omitted_questions_count,
      correct_questions: loadedSession.correct_questions_count,
      incorrect_questions: loadedSession.incorrect_questions_count,
      current_section_index: loadedSession.current_section_index,
      current_question_index: loadedSession.current_question_index,
      consumed_time_seconds: loadedSession.consumed_time_seconds,
      average_time_per_question_seconds:
        loadedSession.average_time_per_question_seconds,
      total_score: loadedSession.total_score,
    })

    if (loadedSession.status === 'completed' || loadedSession.status === 'expired') {
      setCompletion(buildCompletionFromSession(loadedSession))
      setStep('completed')
      localStorage.removeItem(CANDIDATE_SESSION_STORAGE_KEY)
      return
    }

    expiryRefreshRequestedRef.current = false
    setStep('exam')
  }

  function applyProgressToLocalState(
    nextProgress: CandidateSessionProgress,
    options: {
      questionId?: number
      addedSeconds?: number
      selectedAnswer?: string
      markOmitted?: boolean
    } = {},
  ) {
    setProgress(nextProgress)
    setSession((current) => {
      if (!current) {
        return current
      }

      const updatedSession = structuredClone(current)
      updatedSession.status = nextProgress.status
      updatedSession.current_section_index = nextProgress.current_section_index
      updatedSession.current_question_index = nextProgress.current_question_index
      updatedSession.consumed_time_seconds = nextProgress.consumed_time_seconds
      updatedSession.answered_questions_count = nextProgress.answered_questions
      updatedSession.omitted_questions_count = nextProgress.omitted_questions
      updatedSession.correct_questions_count = nextProgress.correct_questions
      updatedSession.incorrect_questions_count = nextProgress.incorrect_questions
      updatedSession.average_time_per_question_seconds =
        nextProgress.average_time_per_question_seconds
      updatedSession.total_score = nextProgress.total_score

      if (options.questionId !== undefined) {
        for (const section of updatedSession.sections) {
          const matchedQuestion = section.questions.find(
            (question) => question.id === options.questionId,
          )
          if (!matchedQuestion) {
            continue
          }

          matchedQuestion.time_spent_seconds += options.addedSeconds ?? 0
          if (options.selectedAnswer !== undefined) {
            matchedQuestion.selected_answer = options.selectedAnswer
            matchedQuestion.is_answered = true
            matchedQuestion.was_omitted = false
          }
          if (options.markOmitted && !matchedQuestion.is_answered) {
            matchedQuestion.was_omitted = true
          }
          section.consumed_time_seconds += options.addedSeconds ?? 0
        }
      }

      return updatedSession
    })
  }

  function getElapsedQuestionSeconds() {
    return Math.max(0, Math.floor((Date.now() - questionStartedAtRef.current) / 1000))
  }

  async function handleValidateCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    setErrorMessage('')
    setServerMessage('')

    try {
      const response = await validateCandidateAccessCode({ code: accessCode })
      setAccessFeedback(response.message)

      if (!response.valid) {
        return
      }

      setValidatedTemplateName(response.template_name ?? '')
      setStep('details')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleStartSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsBusy(true)
    setErrorMessage('')
    setServerMessage('')

    try {
      const startedSession = await startCandidateSession({
        access_code: accessCode,
        first_name: detailsForm.first_name,
        last_name: detailsForm.last_name,
        email: detailsForm.email || undefined,
        phone: detailsForm.phone || undefined,
        employee_reference: detailsForm.employee_reference || undefined,
      })

      localStorage.setItem(CANDIDATE_SESSION_STORAGE_KEY, String(startedSession.id))
      setServerMessage('Sesion iniciada. El tiempo y tus respuestas ya se registran.')
      handleSessionLoaded(startedSession)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSelectAnswer(optionText: string) {
    if (!session || !currentQuestion) {
      return
    }

    setErrorMessage('')
    setServerMessage('')
    const elapsedSeconds = getElapsedQuestionSeconds()

    try {
      const nextProgress = await saveCandidateAnswer(session.id, {
        question_id: currentQuestion.id,
        selected_answer: optionText,
        time_spent_seconds: elapsedSeconds,
        current_section_index: activeSectionIndex,
        current_question_index: activeQuestionIndex,
      })

      if (nextProgress.status === 'expired') {
        const expiredSession = await getCandidateSession(session.id)
        handleSessionLoaded(expiredSession)
        return
      }

      applyProgressToLocalState(nextProgress, {
        questionId: currentQuestion.id,
        addedSeconds: elapsedSeconds,
        selectedAnswer: optionText,
      })
      questionStartedAtRef.current = Date.now()
      setServerMessage('Respuesta guardada y tiempo actualizado.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleExcelSuccess(nextProgress: CandidateSessionProgress, addedSeconds: number) {
    if (!session || !currentQuestion) return

    if (nextProgress.status === 'expired') {
      const expiredSession = await getCandidateSession(session.id)
      handleSessionLoaded(expiredSession)
      return
    }

    applyProgressToLocalState(nextProgress, {
      questionId: currentQuestion.id,
      addedSeconds: addedSeconds,
      selectedAnswer: "Archivo guardado y validado",
    })
    questionStartedAtRef.current = Date.now()
    setServerMessage('Ejercicio de Excel validado y guardado.')
  }

  function handleExcelError(message: string) {
    setErrorMessage(message)
  }

  async function moveQuestion(direction: 'next' | 'prev') {
    if (!session || !currentSection || !currentQuestion) {
      return
    }

    let nextSectionIndex = activeSectionIndex
    let nextQuestionIndex = activeQuestionIndex

    if (direction === 'next') {
      if (activeQuestionIndex < currentSection.questions.length - 1) {
        nextQuestionIndex += 1
      } else if (activeSectionIndex < session.sections.length - 1) {
        nextSectionIndex += 1
        nextQuestionIndex = 0
      } else {
        return
      }
    } else if (activeQuestionIndex > 0) {
      nextQuestionIndex -= 1
    } else if (activeSectionIndex > 0) {
      nextSectionIndex -= 1
      nextQuestionIndex = session.sections[nextSectionIndex].questions.length - 1
    } else {
      return
    }

    setIsSyncingNavigation(true)
    setErrorMessage('')

    try {
      const elapsedSeconds = getElapsedQuestionSeconds()
      const nextProgress = await trackCandidateHeartbeat(session.id, {
        question_id: currentQuestion.id,
        time_spent_seconds: elapsedSeconds,
        current_section_index: nextSectionIndex,
        current_question_index: nextQuestionIndex,
        mark_question_omitted: !currentQuestion.is_answered,
      })

      if (nextProgress.status === 'expired') {
        const expiredSession = await getCandidateSession(session.id)
        handleSessionLoaded(expiredSession)
        return
      }

      applyProgressToLocalState(nextProgress, {
        questionId: currentQuestion.id,
        addedSeconds: elapsedSeconds,
        markOmitted: !currentQuestion.is_answered,
      })
      setActiveSectionIndex(nextSectionIndex)
      setActiveQuestionIndex(nextQuestionIndex)
      setServerMessage('Progreso sincronizado.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSyncingNavigation(false)
    }
  }

  const [isConfirmFinishOpen, setIsConfirmFinishOpen] = useState(false)

  function handleCompleteSession() {
    if (!session || !currentQuestion) {
      return
    }
    setIsConfirmFinishOpen(true)
  }

  async function executeCompleteSession() {
    if (!session || !currentQuestion) {
      return
    }

    setIsBusy(true)
    setErrorMessage('')
    setServerMessage('')

    try {
      const elapsedSeconds = getElapsedQuestionSeconds()
      if (elapsedSeconds > 0 || !currentQuestion.is_answered) {
        const syncProgress = await trackCandidateHeartbeat(session.id, {
          question_id: currentQuestion.id,
          time_spent_seconds: elapsedSeconds,
          current_section_index: activeSectionIndex,
          current_question_index: activeQuestionIndex,
          mark_question_omitted: !currentQuestion.is_answered,
        })

        if (syncProgress.status === 'expired') {
          const expiredSession = await getCandidateSession(session.id)
          handleSessionLoaded(expiredSession)
          return
        }

        applyProgressToLocalState(syncProgress, {
          questionId: currentQuestion.id,
          addedSeconds: elapsedSeconds,
          markOmitted: !currentQuestion.is_answered,
        })
      }

      const completionResponse = await completeCandidateSession(session.id)
      setCompletion(completionResponse)
      setStep('completed')
      setIsConfirmFinishOpen(false)
      localStorage.removeItem(CANDIDATE_SESSION_STORAGE_KEY)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }

  function resetCandidateFlow() {
    localStorage.removeItem(CANDIDATE_SESSION_STORAGE_KEY)
    setStep('access')
    setAccessFeedback('')
    setValidatedTemplateName('')
    setSession(null)
    setProgress(null)
    setCompletion(null)
    setServerMessage('')
    setErrorMessage('')
    setActiveSectionIndex(0)
    setActiveQuestionIndex(0)
    questionStartedAtRef.current = Date.now()
    setDetailsForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      employee_reference: '',
    })
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#eff6ff_45%,_#eef2ff_100%)] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Superior */}
        <div className="flex h-16 w-full items-center justify-between border-b border-slate-200/60 pb-4">
          <div className="flex items-center gap-3">
            {systemSettings?.logo_filename ? (
              <img src={`${getLogoUrl()}?t=${Date.now()}`} alt="Logo" className="h-9 object-contain" />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <CheckCircle2 className="size-5" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">
                {systemSettings?.company_name || 'DSEPC'}
              </h1>
              {step === 'exam' && session && (
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                  Evaluación: <span className="text-slate-600 font-semibold">{session.template_name}</span>
                </p>
              )}
            </div>
          </div>

          {step === 'exam' && session ? (
            <div className="flex items-center gap-3">
              {/* Cronómetro Central Flotante */}
              <div
                className={`flex items-center gap-2.5 rounded-full px-4 py-1.5 shadow-xs border transition-all ${
                  remainingSeconds <= 300
                    ? 'border-amber-400 bg-amber-500/10 text-amber-800 animate-pulse'
                    : 'border-slate-800 bg-slate-950 text-white'
                }`}
              >
                <Clock3
                  className={`size-4 ${
                    remainingSeconds <= 300 ? 'text-amber-600' : 'text-blue-400'
                  }`}
                />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 hidden md:inline">
                    Tiempo Restante:
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold tracking-wider">
                    {timeRemainingLabel || 'Calculando...'}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCompleteSession()}
                disabled={isBusy || isSyncingNavigation}
                className="hidden sm:inline-flex text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                <Check className="size-3.5 mr-1 text-emerald-600" />
                Finalizar Evaluación
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-xs font-medium text-slate-400">
                Portal de Evaluación
              </span>
              <a
                href="/"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <ShieldCheck className="size-3.5 text-blue-600" />
                Portal Admin
              </a>
            </div>
          )}
        </div>

        {/* Notificaciones del Sistema (sutiles y no intrusivas) */}
        {serverMessage && step !== 'exam' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-xs font-medium text-emerald-800 shadow-2xs flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>{serverMessage}</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-2.5 text-xs font-medium text-red-800 shadow-2xs flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {step === 'access' ? (
          <div className="mx-auto mt-6 sm:mt-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_1.1fr] items-stretch">
            {/* Left Card: Access Form */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                  <KeyRound className="size-3.5" />
                  <span>Paso 1 de 2 • Validación de Acceso</span>
                </div>

                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Bienvenido Candidato
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                    {systemSettings?.welcome_message ||
                      'Ingresa tu código de evaluación alfanumérico proporcionado por el reclutador para comenzar tu sesión.'}
                  </p>
                </div>

                <form className="space-y-4 pt-2" onSubmit={handleValidateCode}>
                  <div className="space-y-1.5">
                    <Label htmlFor="access-code" className="text-xs font-semibold text-slate-700">
                      Código de Evaluación <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        id="access-code"
                        required
                        placeholder="Ej. EVAL-2026-DEMO"
                        value={accessCode}
                        onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                        className="pl-9 text-xs sm:text-sm font-mono uppercase tracking-wider"
                      />
                    </div>
                  </div>

                  {activeAccessCodes.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-medium text-slate-400">
                        Códigos disponibles para prueba:
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {activeAccessCodes.map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => setAccessCode(code)}
                            className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                              accessCode === code
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {accessFeedback ? (
                    <p className="text-xs font-medium text-blue-700 bg-blue-50/80 p-2.5 rounded-lg border border-blue-200/60">
                      {accessFeedback}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isBusy || !accessCode.trim()}
                    className="w-full text-xs font-semibold py-2.5 shadow-xs"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        Validando credenciales...
                      </>
                    ) : (
                      <>
                        Validar y Continuar
                        <ArrowRight className="size-3.5 ml-1.5" />
                      </>
                    )}
                  </Button>
                </form>
              </div>

              <div className="pt-6 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="size-4 text-slate-400" />
                <span>Ambiente de evaluación seguro y controlado.</span>
              </div>
            </div>

            {/* Right Card: Executive Instructions */}
            <div className="rounded-2xl border border-slate-800 bg-[#0b1329] p-6 sm:p-8 shadow-md flex flex-col justify-between text-slate-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-5 relative z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/90 text-blue-300 border border-slate-700">
                  <Compass className="size-3.5 text-blue-400" />
                  <span>Normas e Instrucciones</span>
                </div>

                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white">
                    Pautas para tu Evaluación
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Revisa las siguientes pautas antes de iniciar para asegurar un proceso óptimo:
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                      <BookOpen className="size-4 shrink-0" />
                      <span>Lectura Detallada</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Lee atentamente cada reactivo y sus opciones antes de confirmar tu respuesta.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                      <Clock3 className="size-4 shrink-0" />
                      <span>Control del Tiempo</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Cada sección tiene un temporizador regresivo que avanzará automáticamente al agotarse.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
                      <Compass className="size-4 shrink-0" />
                      <span>Avance Progresivo</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      La prueba es secuencial. Al pasar a la siguiente pregunta o sección no podrás volver atrás.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <ShieldCheck className="size-4 shrink-0" />
                      <span>Enfoque e Integridad</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Mantén esta ventana activa y con el navegador en primer plano durante toda la prueba.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400 relative z-10">
                <Lock className="size-3.5 text-slate-500" />
                <span>Sesión cifrada y evaluada bajo estándares institucionales.</span>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'details' ? (
          <div className="mx-auto mt-6 sm:mt-10 w-full max-w-2xl">
            <Card className="border-slate-200/80 shadow-xs">
              <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 w-fit mb-2">
                  <CheckCircle2 className="size-3.5" />
                  <span>Paso 2 de 2 • Ficha de Identificación</span>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  Datos del Candidato
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  Evaluación detectada:{' '}
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 ml-1">
                    {validatedTemplateName}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form className="space-y-4" onSubmit={handleStartSession}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="first-name" className="text-xs font-semibold text-slate-700">
                        Nombre(s) <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input
                          id="first-name"
                          required
                          placeholder="Ej. Carlos Eduardo"
                          value={detailsForm.first_name}
                          onChange={(event) =>
                            setDetailsForm((current) => ({
                              ...current,
                              first_name: event.target.value,
                            }))
                          }
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="last-name" className="text-xs font-semibold text-slate-700">
                        Apellidos <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input
                          id="last-name"
                          required
                          placeholder="Ej. Martínez Ruiz"
                          value={detailsForm.last_name}
                          onChange={(event) =>
                            setDetailsForm((current) => ({
                              ...current,
                              last_name: event.target.value,
                            }))
                          }
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                        Correo Electrónico (Opcional)
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="candidato@correo.com"
                          value={detailsForm.email}
                          onChange={(event) =>
                            setDetailsForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
                        Teléfono de Contacto (Opcional)
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input
                          id="phone"
                          placeholder="Ej. 55 1234 5678"
                          value={detailsForm.phone}
                          onChange={(event) =>
                            setDetailsForm((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="employee-reference" className="text-xs font-semibold text-slate-700">
                      Referencia / Folio Interno (Opcional)
                    </Label>
                    <Input
                      id="employee-reference"
                      placeholder="Ej. VACANTE-2026-01"
                      value={detailsForm.employee_reference}
                      onChange={(event) =>
                        setDetailsForm((current) => ({
                          ...current,
                          employee_reference: event.target.value,
                        }))
                      }
                      className="text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStep('access')}
                      className="text-xs text-slate-600"
                    >
                      <ArrowLeft className="size-3.5 mr-1" />
                      Volver
                    </Button>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={isBusy || !detailsForm.first_name.trim() || !detailsForm.last_name.trim()}
                      className="text-xs font-semibold px-5 shadow-xs"
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                          Preparando evaluación...
                        </>
                      ) : (
                        <>
                          Comenzar Evaluación
                          <ArrowRight className="size-3.5 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {step === 'exam' && session && currentSection && currentQuestion ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            {/* Columna Principal: Reactivo Actual */}
            <div className="space-y-4">
              <Card className="border-slate-200/80 shadow-xs overflow-hidden">
                {/* Cabecera de la Sección y Stepper de Progreso */}
                <div className="bg-slate-50/70 border-b border-slate-100 p-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/70">
                          <Layers className="size-3.5 text-blue-600" />
                          {currentSection.title}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-medium text-slate-500">
                          Módulo {activeSectionIndex + 1} de {session.sections.length}
                        </span>
                      </div>
                    </div>

                    {/* Stepper numérico de reactivos de la sección */}
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                      {currentSection.questions.map((q, qIdx) => {
                        const isCurrent = qIdx === activeQuestionIndex
                        const isAnswered = q.is_answered
                        return (
                          <div
                            key={q.id}
                            className={`flex size-6 items-center justify-center rounded-md text-[11px] font-bold font-mono transition-all ${
                              isCurrent
                                ? 'bg-blue-600 text-white ring-2 ring-blue-600/30 shadow-2xs'
                                : isAnswered
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/80'
                                : 'bg-slate-200/70 text-slate-600'
                            }`}
                            title={`Reactivo ${qIdx + 1}${isAnswered ? ' (Respondido)' : ''}`}
                          >
                            {isAnswered && !isCurrent ? (
                              <Check className="size-3.5 stroke-[3]" />
                            ) : (
                              qIdx + 1
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Barra de Progreso Lineal General */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium">
                        Reactivo <strong className="text-slate-900">{activeQuestionIndex + 1}</strong> de{' '}
                        {currentSection.questions.length} en este módulo
                      </span>
                      <span className="font-mono font-semibold text-slate-700">
                        {progressPercent}% global completado
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  {/* Ficha del Reactivo: Badges y Enunciado */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 border border-slate-200">
                        {currentQuestion.category_name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 font-semibold text-[11px] border capitalize ${
                          currentQuestion.difficulty === 'basic'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : currentQuestion.difficulty === 'intermediate'
                            ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                            : 'bg-purple-50 text-purple-700 border-purple-200/80'
                        }`}
                      >
                        <Zap className="size-3" />
                        {currentQuestion.difficulty === 'basic'
                          ? 'Básico'
                          : currentQuestion.difficulty === 'intermediate'
                          ? 'Intermedio'
                          : 'Avanzado'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        Tiempo en reactivo: {formatSeconds(currentQuestion.time_spent_seconds)}
                      </span>
                    </div>

                    {/* Enunciado con acento visual */}
                    <div className="rounded-xl border-l-4 border-l-blue-600 bg-slate-50/90 p-4 border-y border-r border-slate-200/70 shadow-2xs">
                      <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-relaxed">
                        {currentQuestion.statement}
                      </h2>
                    </div>
                  </div>

                  {/* Opciones de Respuesta / Ejercicio Práctico */}
                  <div className="space-y-2.5 pt-1">
                    {currentQuestion.question_type === 'excel_practical' ? (
                      <InteractiveExcelQuestion
                        key={currentQuestion.id}
                        sessionId={session.id}
                        question={currentQuestion}
                        currentSectionIndex={activeSectionIndex}
                        currentQuestionIndex={activeQuestionIndex}
                        elapsedSeconds={getElapsedQuestionSeconds()}
                        onSuccess={handleExcelSuccess}
                        onError={handleExcelError}
                      />
                    ) : (
                      <div className="grid gap-2.5">
                        {currentQuestion.options.map((option, idx) => {
                          const isSelected =
                            currentQuestion.selected_answer === option.option_text
                          const optionLetter = String.fromCharCode(65 + idx)

                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`flex w-full items-center gap-3.5 rounded-xl border p-4 text-left text-xs sm:text-sm transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50/90 text-blue-950 font-semibold ring-2 ring-blue-600/30 shadow-2xs'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 text-slate-800'
                              }`}
                              onClick={() => void handleSelectAnswer(option.option_text)}
                            >
                              <span
                                className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono transition-colors ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {optionLetter}
                              </span>
                              <span className="flex-1 leading-relaxed">{option.option_text}</span>
                              <div
                                className={`size-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="size-2.5 stroke-[3]" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Barra de Navegación Inferior */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 mt-4">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void moveQuestion('prev')}
                        disabled={
                          isSyncingNavigation ||
                          (activeSectionIndex === 0 && activeQuestionIndex === 0)
                        }
                        className="text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <ArrowLeft className="size-3.5 mr-1" />
                        Anterior
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void moveQuestion('next')}
                        disabled={
                          isSyncingNavigation ||
                          (activeSectionIndex === session.sections.length - 1 &&
                            activeQuestionIndex === currentSection.questions.length - 1)
                        }
                        className="text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        Siguiente Reactivo
                        <ArrowRight className="size-3.5 ml-1" />
                      </Button>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleCompleteSession()}
                      disabled={isBusy || isSyncingNavigation}
                      className="text-xs font-semibold px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      <CheckCircle2 className="size-3.5 mr-1.5" />
                      Finalizar Evaluación
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Columna Lateral: Telemetría del Candidato y Progreso */}
            <div className="space-y-4">
              {/* Ficha del Sustentante */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xs">
                      {session.candidate.first_name?.[0]?.toUpperCase()}
                      {session.candidate.last_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Candidato en Evaluación
                      </p>
                      <p className="font-bold text-slate-900 text-sm truncate">
                        {session.candidate.first_name} {session.candidate.last_name}
                      </p>
                      {session.candidate.email && (
                        <p className="text-xs text-slate-500 truncate">{session.candidate.email}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Métricas en Tiempo Real */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Telemetría del Intento
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2.5">
                  <div className="grid gap-2 grid-cols-2">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                      <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold uppercase">
                        <CheckCircle2 className="size-3.5" />
                        <span>Respondidas</span>
                      </div>
                      <p className="mt-1.5 text-lg font-extrabold text-emerald-950">
                        {answeredQuestions}{' '}
                        <span className="text-xs font-normal text-emerald-700">/{totalQuestions}</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase">
                        <TimerReset className="size-3.5" />
                        <span>Omitidas</span>
                      </div>
                      <p className="mt-1.5 text-lg font-extrabold text-slate-900">
                        {omittedQuestions}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase">
                        <Clock3 className="size-3.5" />
                        <span>Tiempo Total</span>
                      </div>
                      <p className="mt-1.5 text-lg font-extrabold text-slate-900 font-mono">
                        {formatSeconds(session.consumed_time_seconds)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase">
                        <Zap className="size-3.5 text-amber-500" />
                        <span>Promedio</span>
                      </div>
                      <p className="mt-1.5 text-lg font-extrabold text-slate-900 font-mono">
                        {session.average_time_per_question_seconds}s
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estructura Modular por Secciones */}
              <Card className="border-slate-200/80 shadow-xs">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Módulos de la Evaluación
                    </CardTitle>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {session.sections.length} secciones
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2">
                  {session.sections.map((section, sectionIndex) => {
                    const isCurrent = sectionIndex === activeSectionIndex
                    const answeredCount = section.questions.filter((q) => q.is_answered).length
                    const isAllAnswered = answeredCount === section.questions.length && section.questions.length > 0

                    return (
                      <div
                        key={section.id}
                        className={`rounded-xl border p-3 transition-all ${
                          isCurrent
                            ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/30 shadow-2xs'
                            : isAllAnswered
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : 'border-slate-200/80 bg-slate-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            {isAllAnswered ? (
                              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                            ) : isCurrent ? (
                              <div className="size-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                            ) : (
                              <div className="size-2 rounded-full bg-slate-300 shrink-0" />
                            )}
                            <p
                              className={`text-xs font-semibold truncate ${
                                isCurrent ? 'text-blue-950' : 'text-slate-800'
                              }`}
                            >
                              {section.title}
                            </p>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-600 text-white shrink-0">
                              Activa
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>
                            {answeredCount}/{section.questions.length} respondidas
                          </span>
                          <span>{formatSeconds(section.consumed_time_seconds)}</span>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Garantía de Seguridad Institucional */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 flex items-center gap-2.5 text-xs text-slate-500 shadow-2xs">
                <ShieldCheck className="size-4 text-blue-600 shrink-0" />
                <span className="text-[11px] leading-tight">
                  Tus respuestas y tiempo se sincronizan de forma continua y segura.
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'completed' && completion ? (() => {
          const candidateName = completion.candidate_name || `${detailsForm.first_name} ${detailsForm.last_name}`.trim() || 'Candidato'
          const templateName = completion.template_name || validatedTemplateName || 'Evaluación Técnica'

          return (
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Header Hero Institucional de Recepción */}
              <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-white shadow-2xl">
                <div className="absolute -right-10 -top-10 size-60 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center text-center sm:items-start sm:text-left sm:flex-row sm:gap-6">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 shadow-lg ring-4 ring-emerald-500/10">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <div className="mt-4 sm:mt-0 flex-1 space-y-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold tracking-wide text-emerald-300 border border-emerald-500/30 backdrop-blur">
                      <ShieldCheck className="size-3.5" />
                      RECEPCIÓN CONFIRMADA
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                      ¡Evaluación Finalizada con Éxito!
                    </h2>
                    <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
                      Gracias por tu participación, <strong className="text-white">{detailsForm.first_name || candidateName}</strong>. Tus respuestas y ejercicios han sido procesados y guardados satisfactoriamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Callout Informativo: Proceso de Auditoría y Dictamen */}
              <div className="rounded-2xl border border-blue-200/90 bg-blue-50/70 p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs mt-0.5">
                    <Info className="size-5" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <h4 className="font-bold text-blue-950 text-sm">
                      Proceso de Auditoría y Dictamen en Curso
                    </h4>
                    <p className="text-blue-900/80 leading-relaxed">
                      Tus respuestas y archivos entregados han sido remitidos a la Mesa de Control. El equipo de Reclutamiento y Selección llevará a cabo la validación técnica correspondiente y se pondrá en contacto contigo para comunicarte el dictamen oficial y los siguientes pasos del proceso.
                    </p>
                  </div>
                </div>
              </div>

              {/* Comprobante de Entrega */}
              <Card className="border-slate-200/80 bg-white shadow-lg">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <FileCheck className="size-4 text-blue-600" />
                        Comprobante de Entrega de Prueba
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Perfil Evaluado: <strong className="text-slate-700">{templateName}</strong> • Folio de Sesión: <strong className="font-mono text-slate-800">#{completion.session_id}</strong>
                      </CardDescription>
                    </div>
                    <span className="inline-flex items-center gap-1 self-start sm:self-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                      <Lock className="size-3 text-slate-500" />
                      Sesión Cerrada
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 pt-5">
                  {/* Grid de Métricas Objetivas de Entrega */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                        <Layers className="size-3.5 text-blue-600" />
                        <span>Reactivos Procesados</span>
                      </div>
                      <p className="mt-1.5 text-xl font-bold text-slate-900">
                        {completion.answered_questions}
                        <span className="text-sm font-normal text-slate-500">
                          /{completion.total_questions}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {completion.omitted_questions} omitida(s)
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                        <Clock3 className="size-3.5 text-blue-600" />
                        <span>Tiempo Invertido</span>
                      </div>
                      <p className="mt-1.5 text-xl font-bold text-slate-900 font-mono">
                        {formatSeconds(completion.consumed_time_seconds)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Promedio: {completion.average_time_per_question_seconds}s por pregunta
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                        <ShieldCheck className="size-3.5 text-emerald-600" />
                        <span>Integridad de Datos</span>
                      </div>
                      <p className="mt-1.5 text-base font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="size-4" /> Almacenado
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Registro seguro en servidor
                      </p>
                    </div>
                  </div>

                  {/* Módulos Concluidos */}
                  {completion.category_results && completion.category_results.length > 0 && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Módulos Concluidos en la Prueba ({completion.category_results.length})
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {completion.category_results.map((category) => (
                          <div
                            key={category.category_name}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-2xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-slate-800 truncate">
                                {category.category_name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium shrink-0">
                              {category.total_questions} reactivo(s)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Acciones de Salida */}
                  <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto font-semibold gap-2 text-slate-700 hover:bg-slate-100"
                      onClick={resetCandidateFlow}
                    >
                      <LogOut className="size-4" />
                      Salir del Portal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })() : null}
      </div>

      {/* Modal de Confirmación para Finalizar Evaluación */}
      <ConfirmDialog
        isOpen={isConfirmFinishOpen}
        title="Finalizar Evaluación"
        description="¿Estás seguro de que deseas enviar y concluir tu evaluación?\n\nUna vez confirmada la entrega, se calificarán tus reactivos y no podrás modificar tus respuestas."
        confirmText="Sí, Finalizar Evaluación"
        cancelText="Continuar Evaluando"
        variant="info"
        isLoading={isBusy}
        onConfirm={executeCompleteSession}
        onClose={() => {
          if (!isBusy) setIsConfirmFinishOpen(false)
        }}
      />
    </div>
  )
}
