import axios from 'axios'
import {
  ClipboardList,
  KeyRound,
  Link2,
  PencilLine,
  Plus,
  RefreshCw,
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
import {
  createAccessCode,
  deleteAccessCode,
  getAccessCodes,
  setAccessCodeStatus,
  updateAccessCode,
  type AccessCode,
  type AccessCodePayload,
} from '@/features/access-codes/access-code-service'
import {
  getEvaluationTemplates,
  type EvaluationTemplateListItem,
} from '@/features/evaluation-templates/evaluation-template-service'

type AccessCodeFormState = {
  code: string
  evaluation_template_id: string
  expires_at: string
  is_active: boolean
}

const defaultFormState: AccessCodeFormState = {
  code: '',
  evaluation_template_id: '',
  expires_at: '',
  is_active: true,
}

function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.detail
    if (typeof apiMessage === 'string') {
      return apiMessage
    }
  }

  return 'No fue posible completar la operacion.'
}

function formatDateTimeForInput(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function AccessCodesPage() {
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([])
  const [templates, setTemplates] = useState<EvaluationTemplateListItem[]>([])
  const [editingAccessCodeId, setEditingAccessCodeId] = useState<number | null>(null)
  const [form, setForm] = useState<AccessCodeFormState>(defaultFormState)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.is_active),
    [templates],
  )

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [codesData, templatesData] = await Promise.all([
        getAccessCodes(),
        getEvaluationTemplates(),
      ])
      setAccessCodes(codesData)
      setTemplates(templatesData)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function resetForm() {
    setEditingAccessCodeId(null)
    setForm(defaultFormState)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage('')
    setErrorMessage('')

    const payload: AccessCodePayload = {
      code: form.code.trim().toUpperCase(),
      evaluation_template_id: form.evaluation_template_id
        ? Number(form.evaluation_template_id)
        : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: form.is_active,
    }

    try {
      if (editingAccessCodeId) {
        await updateAccessCode(editingAccessCodeId, payload)
        setFeedbackMessage('Codigo de evaluacion actualizado correctamente.')
      } else {
        await createAccessCode(payload)
        setFeedbackMessage('Codigo de evaluacion creado correctamente.')
      }

      resetForm()
      await loadData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  async function handleToggleStatus(accessCode: AccessCode) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await setAccessCodeStatus(accessCode.id, !accessCode.is_active)
      setFeedbackMessage('Estado del codigo actualizado.')
      await loadData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  function handleEdit(accessCode: AccessCode) {
    setEditingAccessCodeId(accessCode.id)
    setForm({
      code: accessCode.code,
      evaluation_template_id: accessCode.evaluation_template_id
        ? String(accessCode.evaluation_template_id)
        : '',
      expires_at: formatDateTimeForInput(accessCode.expires_at),
      is_active: accessCode.is_active,
    })
  }

  async function handleDelete(accessCode: AccessCode) {
    const confirmed = window.confirm(
      `Se eliminara el codigo "${accessCode.code}". Esta accion no se puede deshacer.`,
    )

    if (!confirmed) {
      return
    }

    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await deleteAccessCode(accessCode.id)
      if (editingAccessCodeId === accessCode.id) {
        resetForm()
      }
      setFeedbackMessage('Codigo eliminado correctamente.')
      await loadData()
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
              Modulo practico
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Gestion de codigos de evaluacion
            </h2>
            <p className="max-w-3xl text-slate-300">
              Crea, vincula y activa codigos para que cada candidato entre a la
              plantilla correcta sin ajustes manuales.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="Codigos" value={String(accessCodes.length)} icon={KeyRound} />
            <HeroMetric
              label="Activos"
              value={String(accessCodes.filter((code) => code.is_active).length)}
              icon={ClipboardList}
            />
            <HeroMetric
              label="Plantillas activas"
              value={String(activeTemplates.length)}
              icon={Link2}
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

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Formulario de codigo</CardTitle>
            <CardDescription>
              Asigna cada codigo a una plantilla para controlar el acceso del candidato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="access-code">Codigo</Label>
                <Input
                  id="access-code"
                  placeholder="EVAL-CAPT-001"
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-template">Plantilla</Label>
                <select
                  id="access-template"
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm outline-none"
                  value={form.evaluation_template_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      evaluation_template_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Sin plantilla</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-expiration">Vigencia</Label>
                <Input
                  id="access-expiration"
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expires_at: event.target.value,
                    }))
                  }
                />
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  checked={form.is_active}
                  type="checkbox"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                />
                Codigo activo
              </label>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">
                  {editingAccessCodeId ? (
                    <>
                      <PencilLine className="size-4" />
                      Guardar cambios
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Crear codigo
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Limpiar
                </Button>
                <Button type="button" variant="outline" onClick={() => void loadData()}>
                  <RefreshCw className="size-4" />
                  Recargar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Codigos registrados</CardTitle>
            <CardDescription>
              Revisa rapido si cada codigo apunta a una plantilla lista para aplicarse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Codigo</th>
                    <th className="px-4 py-3 font-medium">Plantilla</th>
                    <th className="px-4 py-3 font-medium">Vigencia</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {accessCodes.map((accessCode) => (
                    <tr key={accessCode.id} className="border-t border-border/70 align-top">
                      <td className="px-4 py-3 font-medium">{accessCode.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {accessCode.evaluation_template_name || 'Sin plantilla asignada'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {accessCode.template_validation_message || 'Pendiente de configuracion.'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {accessCode.expires_at
                          ? new Date(accessCode.expires_at).toLocaleString()
                          : 'Sin vencimiento'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <StatusBadge
                            label={accessCode.is_active ? 'Activo' : 'Inactivo'}
                            tone={accessCode.is_active ? 'info' : 'neutral'}
                          />
                          <div>
                            <StatusBadge
                              label={
                                accessCode.template_is_valid
                                  ? 'Plantilla lista'
                                  : 'Plantilla pendiente'
                              }
                              tone={accessCode.template_is_valid ? 'success' : 'warning'}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => handleEdit(accessCode)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => void handleToggleStatus(accessCode)}
                          >
                            <ToggleLeft className="size-4" />
                            {accessCode.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => void handleDelete(accessCode)}
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
              {!accessCodes.length ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  {isLoading ? 'Cargando codigos...' : 'Aun no hay codigos registrados.'}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
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
  icon: typeof KeyRound
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
