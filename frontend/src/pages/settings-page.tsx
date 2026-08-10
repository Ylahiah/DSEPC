import axios from 'axios'
import { ImagePlus, Save, Trash2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  getLogoUrl,
  getSystemSettings,
  updateSystemLogo,
  updateSystemSettings,
  type SystemSetting,
} from '@/features/settings/settings-service'

function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.detail
    if (typeof apiMessage === 'string') {
      return apiMessage
    }
  }
  return 'No fue posible completar la operacion.'
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  const [companyName, setCompanyName] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0f172a')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    try {
      setIsLoading(true)
      const data = await getSystemSettings()
      setSettings(data)
      setCompanyName(data.company_name)
      setWelcomeMessage(data.welcome_message)
      setPrimaryColor(data.primary_color)
      
      if (data.logo_filename) {
        // Append timestamp to prevent caching old images
        setLogoPreview(`${getLogoUrl()}?t=${Date.now()}`)
      } else {
        setLogoPreview(null)
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  function handleRemoveLogo() {
    setLogoFile(null)
    setLogoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedbackMessage('')
    setErrorMessage('')
    setIsSaving(true)

    try {
      // 1. Update text/color settings
      await updateSystemSettings({
        company_name: companyName,
        welcome_message: welcomeMessage,
        primary_color: primaryColor,
      })

      // 2. Upload or delete logo if it changed
      // If logoPreview is null but we had a filename, it means user removed it
      // If logoFile is not null, it means user uploaded a new one
      if (logoFile) {
        await updateSystemLogo(logoFile)
      } else if (!logoPreview && settings?.logo_filename) {
        await updateSystemLogo(null) // Delete logo
      }

      setFeedbackMessage('Configuracion guardada correctamente.')
      await loadSettings()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-slate-500">Cargando configuracion...</div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configuracion del Sistema</h1>
        <p className="text-slate-500">
          Personaliza la apariencia y textos del portal de evaluacion (Marca Blanca).
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      
      {feedbackMessage && (
        <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-700">
          {feedbackMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Apariencia y Marca</CardTitle>
          <CardDescription>
            Estos valores se reflejaran inmediatamente en el portal donde los candidatos ingresan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company-name">Nombre de la Empresa / Plataforma</Label>
                <Input
                  id="company-name"
                  placeholder="Mi Empresa S.A."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="welcome-message">Mensaje de Bienvenida (Candidatos)</Label>
                <Textarea
                  id="welcome-message"
                  placeholder="Plataforma de evaluacion de candidatos..."
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary-color">Color Primario (Hex)</Label>
                <div className="flex gap-3">
                  <Input
                    id="primary-color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-16 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={primaryColor.toUpperCase()}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                    className="flex-1 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Logotipo de la Empresa</Label>
                
                <div className="mt-2 flex items-center gap-6">
                  <div className="flex h-32 w-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <ImagePlus className="mb-2 size-8" />
                        <span className="text-xs">Sin logotipo</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Seleccionar imagen
                    </Button>
                    {logoPreview && (
                      <Button
                        type="button"
                        variant="destructive"
                        className="text-xs"
                        onClick={handleRemoveLogo}
                      >
                        <Trash2 className="mr-2 size-3" />
                        Quitar logotipo
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      Recomendado: Imagen PNG o JPG transparente, proporcion horizontal.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 size-4" />
                {isSaving ? 'Guardando...' : 'Guardar configuracion'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
