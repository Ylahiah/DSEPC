import axios from 'axios'
import {
  Check,
  ClipboardList,
  Copy,
  KeyRound,
  Link2,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
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

  return 'No fue posible completar la operación.'
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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null)

  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.is_active),
    [templates],
  )

  const filteredCodes = useMemo(() => {
    return accessCodes.filter((item) => {
      // Search match
      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !query ||
        item.code.toLowerCase().includes(query) ||
        (item.evaluation_template_name &&
          item.evaluation_template_name.toLowerCase().includes(query))

      // Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.is_active) ||
        (statusFilter === 'inactive' && !item.is_active)

      return matchesSearch && matchesStatus
    })
  }, [accessCodes, searchQuery, statusFilter])

  const stats = useMemo(() => {
    const total = accessCodes.length
    const active = accessCodes.filter((c) => c.is_active).length
    const inactive = total - active
    return { total, active, inactive }
  }, [accessCodes])

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

  function handleOpenCreateModal() {
    setEditingAccessCodeId(null)
    setForm(defaultFormState)
    setErrorMessage('')
    setIsModalOpen(true)
  }

  function handleOpenEditModal(accessCode: AccessCode) {
    setEditingAccessCodeId(accessCode.id)
    setForm({
      code: accessCode.code,
      evaluation_template_id: accessCode.evaluation_template_id
        ? String(accessCode.evaluation_template_id)
        : '',
      expires_at: formatDateTimeForInput(accessCode.expires_at),
      is_active: accessCode.is_active,
    })
    setErrorMessage('')
    setIsModalOpen(true)
  }

  function handleCloseModal() {
    setIsModalOpen(false)
    setEditingAccessCodeId(null)
    setForm(defaultFormState)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage('')
    setErrorMessage('')
    setIsSubmitting(true)

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
        setFeedbackMessage('Código de acceso actualizado correctamente.')
      } else {
        await createAccessCode(payload)
        setFeedbackMessage('Código de acceso creado correctamente.')
      }

      handleCloseModal()
      await loadData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleStatus(accessCode: AccessCode) {
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await setAccessCodeStatus(accessCode.id, !accessCode.is_active)
      setFeedbackMessage(
        `Código "${accessCode.code}" ${!accessCode.is_active ? 'activado' : 'desactivado'} correctamente.`,
      )
      await loadData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  const [codeToDelete, setCodeToDelete] = useState<AccessCode | null>(null)
  const [isDeletingCode, setIsDeletingCode] = useState(false)

  async function handleConfirmDelete() {
    if (!codeToDelete) return

    setIsDeletingCode(true)
    setFeedbackMessage('')
    setErrorMessage('')

    try {
      await deleteAccessCode(codeToDelete.id)
      setFeedbackMessage(`Código "${codeToDelete.code}" eliminado correctamente.`)
      setCodeToDelete(null)
      await loadData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsDeletingCode(false)
    }
  }

  function handleCopyCode(code: string, id: number) {
    void navigator.clipboard.writeText(code)
    setCopiedCodeId(id)
    setTimeout(() => {
      setCopiedCodeId((current) => (current === id ? null : current))
    }, 2000)
  }

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Gestión de Códigos de Acceso
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Crea, vincula y activa códigos para que cada candidato acceda a la plantilla asignada.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
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
            Nuevo Código
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Códigos
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <KeyRound className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{stats.total}</div>
          <p className="mt-1 text-[11px] text-slate-400">Registrados en la plataforma</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Códigos Activos
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <ClipboardList className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{stats.active}</div>
          <p className="mt-1 text-[11px] text-slate-400">Disponibles para evaluación</p>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Plantillas Vinculadas
            </span>
            <div className="flex size-8 items-center justify-center rounded-md bg-purple-50 text-purple-600">
              <Link2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {activeTemplates.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Plantillas en estado activo</p>
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
                Códigos Registrados
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Revisa el estado, vigencia y plantilla asignada a cada código de acceso.
              </CardDescription>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar código o plantilla..."
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
                  Todos ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  Activos ({stats.active})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'inactive'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Inactivos ({stats.inactive})
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
                  <th className="px-5 py-3">Código de Acceso</th>
                  <th className="px-5 py-3">Plantilla Asignada</th>
                  <th className="px-5 py-3">Vigencia</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCodes.map((accessCode) => (
                  <tr key={accessCode.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Código */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold tracking-wider px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-900">
                          {accessCode.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(accessCode.code, accessCode.id)}
                          title="Copiar código"
                          className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded hover:bg-slate-100"
                        >
                          {copiedCodeId === accessCode.id ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Plantilla Asignada */}
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900 text-xs">
                        {accessCode.evaluation_template_name || (
                          <span className="text-amber-600 italic">Sin plantilla asignada</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {accessCode.template_validation_message || 'Configuración pendiente.'}
                      </div>
                    </td>

                    {/* Vigencia */}
                    <td className="px-5 py-3.5">
                      {accessCode.expires_at ? (
                        <div className="text-xs text-slate-700">
                          {new Date(accessCode.expires_at).toLocaleString('es-MX', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </div>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          Sin vencimiento
                        </span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            accessCode.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              accessCode.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {accessCode.is_active ? 'Activo' : 'Inactivo'}
                        </span>

                        {accessCode.evaluation_template_id ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              accessCode.template_is_valid
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {accessCode.template_is_valid
                              ? 'Plantilla lista'
                              : 'Plantilla incompleta'}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(accessCode)}
                          className="h-8 px-2 text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50"
                          title="Editar código"
                        >
                          <PencilLine className="size-3.5" />
                          <span className="hidden sm:inline ml-1">Editar</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleToggleStatus(accessCode)}
                          className={`h-8 px-2 text-xs ${
                            accessCode.is_active
                              ? 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
                          }`}
                          title={accessCode.is_active ? 'Desactivar código' : 'Activar código'}
                        >
                          {accessCode.is_active ? (
                            <>
                              <ToggleRight className="size-4 text-emerald-600" />
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
                          onClick={() => setCodeToDelete(accessCode)}
                          className="h-8 px-2 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50"
                          title="Eliminar código"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredCodes.length && (
              <div className="p-12 text-center">
                <KeyRound className="mx-auto size-10 text-slate-300 stroke-1" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No se encontraron códigos con los filtros seleccionados'
                    : 'Aún no hay códigos de acceso registrados'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Intenta ajustar los términos de búsqueda o cambiar el filtro de estado.'
                    : 'Crea tu primer código para que los candidatos puedan acceder a sus evaluaciones.'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <div className="mt-4">
                    <Button size="sm" onClick={handleOpenCreateModal}>
                      <Plus className="size-4" />
                      Crear primer código
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Dialog via Portal for Create & Edit */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingAccessCodeId ? 'Editar Código de Acceso' : 'Nuevo Código de Acceso'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingAccessCodeId
                      ? 'Modifica los parámetros y plantilla asignada a este código.'
                      : 'Genera un nuevo código para habilitar el acceso a una evaluación.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {errorMessage ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                {/* Código input */}
                <div className="space-y-1.5">
                  <Label htmlFor="modal-code" className="text-xs font-semibold text-slate-700">
                    Código de Acceso <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="modal-code"
                    required
                    placeholder="Ej. EVAL-CAPT-2026"
                    value={form.code}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        code: e.target.value.toUpperCase(),
                      }))
                    }
                    className="font-mono uppercase tracking-wider text-sm"
                  />
                  <p className="text-[11px] text-slate-400">
                    Identificador único que el candidato ingresará en el portal.
                  </p>
                </div>

                {/* Plantilla select */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="modal-template"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Plantilla de Evaluación
                  </Label>
                  <select
                    id="modal-template"
                    value={form.evaluation_template_id}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        evaluation_template_id: e.target.value,
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1.5 text-xs text-foreground shadow-2xs outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">-- Sin plantilla asignada --</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} {!template.is_active ? '(Inactiva)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Determina las secciones y preguntas que resolverá el candidato.
                  </p>
                </div>

                {/* Expiración datetime */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="modal-expiration"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Vigencia / Fecha de Expiración
                  </Label>
                  <Input
                    id="modal-expiration"
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        expires_at: e.target.value,
                      }))
                    }
                    className="text-xs"
                  />
                  <p className="text-[11px] text-slate-400">
                    Opcional. Deja vacío si el código no tendrá fecha de vencimiento.
                  </p>
                </div>

                {/* Checkbox activo */}
                <div className="pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          is_active: e.target.checked,
                        }))
                      }
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-medium text-slate-700">
                      Código activo e inmediatamente disponible para su uso
                    </span>
                  </label>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : editingAccessCodeId ? (
                      <PencilLine className="size-3.5" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    {editingAccessCodeId ? 'Guardar Cambios' : 'Crear Código'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal de Confirmación para Eliminar Código */}
      <ConfirmDialog
        isOpen={Boolean(codeToDelete)}
        title="Eliminar Código de Acceso"
        description={`¿Estás seguro de que deseas eliminar el código "${codeToDelete?.code}"?\n\nLos candidatos que utilicen este código ya no podrán iniciar nuevas sesiones de evaluación.`}
        confirmText="Eliminar Código"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingCode}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeletingCode) setCodeToDelete(null)
        }}
      />
    </div>
  )
}
