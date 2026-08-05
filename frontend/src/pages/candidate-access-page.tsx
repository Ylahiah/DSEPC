import axios from 'axios'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  TimerReset,
  UserRound,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

function formatSeconds(totalSeconds: number) {
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
  const [progress, setProgress] = useState<CandidateSessionProgress | null>(null)
  const [completion, setCompletion] = useState<CandidateSessionCompletion | null>(null)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [serverMessage, setServerMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [timeRemainingLabel, setTimeRemainingLabel] = useState('')
  const [isSyncingNavigation, setIsSyncingNavigation] = useState(false)

  const questionStartedAtRef = useRef<number>(Date.now())
  const expiryRefreshRequestedRef = useRef(false)

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

  async function handleCompleteSession() {
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
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#eff6ff_45%,_#eef2ff_100%)] px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[1.75rem] border border-white/60 bg-[linear-gradient(135deg,_rgba(15,23,42,0.97),_rgba(30,41,59,0.94))] p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-300">
                Portal del candidato
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                Evaluacion operativa para capturistas
              </h1>
              <p className="max-w-3xl text-slate-300">
                Ahora el sistema registra tiempo real, omisiones y resultados base
                por categoria.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <HeroPill title="Paso 1" description="Validar codigo" />
              <HeroPill title="Paso 2" description="Capturar datos" />
              <HeroPill title="Paso 3" description="Resolver examen" />
            </div>
          </div>
        </section>

        {serverMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {serverMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {step === 'access' ? (
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
            <Card className="border-white/70 bg-white/85 backdrop-blur">
              <CardHeader>
                <CardTitle>Ingreso del candidato</CardTitle>
                <CardDescription>
                  Valida tu codigo de evaluacion para continuar con el proceso.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form className="space-y-4" onSubmit={handleValidateCode}>
                  <div className="space-y-2">
                    <Label htmlFor="eval-code-select">Codigo de evaluacion</Label>
                    <Select value={accessCode} onValueChange={setAccessCode}>
                      <SelectTrigger id="eval-code-select" className="w-full">
                        <SelectValue placeholder="Selecciona un codigo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAccessCodes.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full" size="lg" type="submit" disabled={isBusy}>
                    {isBusy ? 'Validando codigo...' : 'Validar acceso'}
                  </Button>
                </form>

                {accessFeedback ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {accessFeedback}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                [
                  'Cronometro oficial',
                  'El backend consolida el tiempo consumido para que la evaluacion sea auditable.',
                ],
                [
                  'Omisiones detectadas',
                  'Al cambiar de pregunta sin responder, el sistema puede registrar la omision.',
                ],
                [
                  'Resultados por categoria',
                  'La sesion ya calcula aciertos, errores y puntaje por cada categoria respondida.',
                ],
                [
                  'Cierre por tiempo',
                  'Si el reloj se agota, la sesion se cierra automaticamente con lo ya contestado.',
                ],
              ].map(([title, description]) => (
                <Card key={title} className="border-white/70 bg-white/70 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {step === 'details' ? (
          <Card className="border-white/70 bg-white/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Datos del candidato</CardTitle>
              <CardDescription>
                Plantilla detectada: <strong>{validatedTemplateName}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleStartSession}>
                <div className="space-y-2">
                  <Label htmlFor="first-name">Nombre(s)</Label>
                  <Input
                    id="first-name"
                    value={detailsForm.first_name}
                    onChange={(event) =>
                      setDetailsForm((current) => ({
                        ...current,
                        first_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Apellidos</Label>
                  <Input
                    id="last-name"
                    value={detailsForm.last_name}
                    onChange={(event) =>
                      setDetailsForm((current) => ({
                        ...current,
                        last_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electronico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={detailsForm.email}
                    onChange={(event) =>
                      setDetailsForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    value={detailsForm.phone}
                    onChange={(event) =>
                      setDetailsForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="employee-reference">Referencia / folio</Label>
                  <Input
                    id="employee-reference"
                    value={detailsForm.employee_reference}
                    onChange={(event) =>
                      setDetailsForm((current) => ({
                        ...current,
                        employee_reference: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <Button type="submit" disabled={isBusy}>
                    <UserRound className="size-4" />
                    {isBusy ? 'Preparando evaluacion...' : 'Iniciar evaluacion'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setStep('access')}>
                    Volver
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {step === 'exam' && session && currentSection && currentQuestion ? (
          <div className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
            <div className="space-y-6">
              <Card className="border-white/70 bg-white/90 backdrop-blur">
                <CardHeader>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>{session.template_name}</CardTitle>
                      <CardDescription>{currentSection.title}</CardDescription>
                    </div>
                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        remainingSeconds <= 300
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock3 className="size-4" />
                        Tiempo restante: <strong>{timeRemainingLabel || 'Calculando...'}</strong>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        Seccion {activeSectionIndex + 1} de {session.sections.length}
                      </span>
                      <span>
                        Pregunta {activeQuestionIndex + 1} de {currentSection.questions.length}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-5">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                        {currentQuestion.category_name}
                      </span>
                      <span>Dificultad: {currentQuestion.difficulty}</span>
                      <span>Tiempo invertido: {formatSeconds(currentQuestion.time_spent_seconds)}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                      {currentQuestion.statement}
                    </h2>
                  </div>

                  <div className="grid gap-3">
                    {currentQuestion.question_type === 'excel_practical' ? (
                      <InteractiveExcelQuestion
                        sessionId={session.id}
                        question={currentQuestion}
                        currentSectionIndex={activeSectionIndex}
                        currentQuestionIndex={activeQuestionIndex}
                        elapsedSeconds={getElapsedQuestionSeconds()}
                        onSuccess={handleExcelSuccess}
                        onError={handleExcelError}
                      />
                    ) : (
                      currentQuestion.options.map((option) => {
                        const isSelected =
                          currentQuestion.selected_answer === option.option_text

                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`rounded-2xl border px-5 py-4 text-left text-sm transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background hover:bg-accent/60'
                            }`}
                            onClick={() => void handleSelectAnswer(option.option_text)}
                          >
                            {option.option_text}
                          </button>
                        )
                      })
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void moveQuestion('prev')}
                      disabled={
                        isSyncingNavigation ||
                        (activeSectionIndex === 0 && activeQuestionIndex === 0)
                      }
                    >
                      <ArrowLeft className="size-4" />
                      Anterior
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void moveQuestion('next')}
                      disabled={
                        isSyncingNavigation ||
                        (activeSectionIndex === session.sections.length - 1 &&
                          activeQuestionIndex === currentSection.questions.length - 1)
                      }
                    >
                      Siguiente
                      <ArrowRight className="size-4" />
                    </Button>

                    <Button
                      type="button"
                      onClick={() => void handleCompleteSession()}
                      disabled={isBusy || isSyncingNavigation}
                    >
                      Finalizar evaluacion
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-white/70 bg-white/90 backdrop-blur">
                <CardHeader>
                  <CardTitle>Resumen del intento</CardTitle>
                  <CardDescription>
                    El sistema consolida tiempo, omisiones y avance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Candidato
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                      {session.candidate.first_name} {session.candidate.last_name}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <SummaryMetric label="Respondidas" value={`${answeredQuestions}`} />
                    <SummaryMetric label="Omitidas" value={`${omittedQuestions}`} />
                    <SummaryMetric label="Tiempo usado" value={formatSeconds(session.consumed_time_seconds)} />
                    <SummaryMetric label="Tiempo promedio" value={`${session.average_time_per_question_seconds}s`} />
                    <SummaryMetric label="Estado" value={progress?.status ?? session.status} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/70 bg-white/90 backdrop-blur">
                <CardHeader>
                  <CardTitle>Secciones</CardTitle>
                  <CardDescription>
                    Cada seccion ya acumula tiempo propio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {session.sections.map((section, sectionIndex) => (
                    <div
                      key={section.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        sectionIndex === activeSectionIndex
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-muted/20'
                      }`}
                    >
                      <p className="font-medium text-foreground">{section.title}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          {section.questions.filter((question) => question.is_answered).length} /{' '}
                          {section.questions.length} respondidas
                        </span>
                        <span>Tiempo: {formatSeconds(section.consumed_time_seconds)}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {step === 'completed' && completion ? (
          <Card className="border-white/70 bg-white/90 backdrop-blur">
            <CardHeader className="items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="size-8" />
              </div>
              <CardTitle>Evaluacion finalizada</CardTitle>
              <CardDescription>{completion.message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <CompletionMetric label="Respondidas" value={`${completion.answered_questions}`} />
                <CompletionMetric label="Omitidas" value={`${completion.omitted_questions}`} />
                <CompletionMetric
                  label="Resultado"
                  value={
                    completion.show_result_to_candidate && completion.total_score !== null
                      ? String(completion.total_score)
                      : 'Oculto'
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <SummaryMetric label="Correctas" value={`${completion.correct_questions}`} />
                <SummaryMetric label="Incorrectas" value={`${completion.incorrect_questions}`} />
                <SummaryMetric
                  label="Tiempo usado"
                  value={formatSeconds(completion.consumed_time_seconds)}
                />
                <SummaryMetric
                  label="Promedio por pregunta"
                  value={`${completion.average_time_per_question_seconds}s`}
                />
              </div>

              <Card className="border-border bg-muted/20">
                <CardHeader>
                  <CardTitle className="text-lg">Resultado por categoria</CardTitle>
                  <CardDescription>
                    Resumen base listo para alimentar dashboard y reportes posteriores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {completion.category_results.map((category) => (
                    <div
                      key={category.category_name}
                      className="rounded-2xl border border-border bg-background px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p className="font-medium text-foreground">{category.category_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {category.score_obtained} / {category.score_possible} puntos
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Correctas: {category.correct_questions}</span>
                        <span>Incorrectas: {category.incorrect_questions}</span>
                        <span>Omitidas: {category.omitted_questions}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex justify-center">
                <Button type="button" variant="outline" onClick={resetCandidateFlow}>
                  <TimerReset className="size-4" />
                  Iniciar otro acceso
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function HeroPill({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{title}</p>
      <p className="mt-2 text-sm font-medium">{description}</p>
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

function CompletionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-5 text-center">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}
