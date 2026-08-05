import { Download, Loader2, Save, UploadCloud, FileSpreadsheet } from 'lucide-react'
import React, { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  getExcelExerciseDownload,
  submitExcelAnswer,
  type CandidateExamQuestion,
} from '../candidate-access-service'

interface InteractiveExcelQuestionProps {
  sessionId: number
  question: CandidateExamQuestion
  currentSectionIndex: number
  currentQuestionIndex: number
  elapsedSeconds: number
  onSuccess: (progress: any, addedSeconds: number) => void
  onError: (message: string) => void
}

export function InteractiveExcelQuestion({
  sessionId,
  question,
  currentSectionIndex,
  currentQuestionIndex,
  elapsedSeconds,
  onSuccess,
  onError,
}: InteractiveExcelQuestionProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleDownload() {
    try {
      setIsDownloading(true)
      const blob = await getExcelExerciseDownload(sessionId, question.id)
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Ejercicio_Practico_${question.id}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Failed to download excel template', err)
      onError('No se pudo descargar el archivo del servidor.')
    } finally {
      setIsDownloading(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm')) {
        setSelectedFile(file)
      } else {
        onError('Por favor, selecciona un archivo Excel válido (.xlsx o .xlsm)')
        e.target.value = ''
      }
    }
  }

  async function handleSave() {
    if (!selectedFile) {
      onError('Debes seleccionar un archivo antes de enviarlo.')
      return
    }

    setIsSaving(true)

    try {
      const progress = await submitExcelAnswer(
        sessionId,
        question.id,
        selectedFile,
        elapsedSeconds,
        currentSectionIndex,
        currentQuestionIndex,
      )

      onSuccess(progress, elapsedSeconds)
    } catch (err: any) {
      console.error('Error saving workbook', err)
      const backendMessage = err.response?.data?.detail || 'Error al enviar el archivo de Excel.'
      onError(backendMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {question.excel_exercise?.instructions && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
          <strong>Instrucciones:</strong> {question.excel_exercise.instructions}
        </div>
      )}

      <div className="flex flex-col items-center justify-center space-y-6 rounded-2xl border border-border bg-background p-10 shadow-sm text-center">
        <FileSpreadsheet className="size-16 text-primary/80" />
        
        <div className="space-y-2 max-w-md">
          <h3 className="text-xl font-semibold">Resuelve el ejercicio en tu computadora</h3>
          <p className="text-sm text-muted-foreground">
            Descarga el archivo base, ábrelo con Microsoft Excel, crea la tabla dinámica solicitada en la hoja correspondiente y cuando hayas terminado, sube el archivo resuelto aquí.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center mt-4">
          <Button 
            onClick={() => void handleDownload()} 
            disabled={isDownloading}
            variant="outline"
            className="w-full sm:w-auto min-w-[200px]"
          >
            {isDownloading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Descargar Archivo Base
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="default"
            className="w-full sm:w-auto min-w-[200px]"
          >
            <UploadCloud className="mr-2 size-4" />
            {selectedFile ? 'Cambiar Archivo' : 'Subir Archivo Resuelto'}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xlsm"
            onChange={handleFileSelect}
          />
        </div>

        {selectedFile && (
          <div className="mt-4 flex items-center justify-center p-3 border rounded-lg bg-green-50 text-green-700 w-full max-w-md">
            <Save className="mr-2 size-4" />
            <span className="text-sm font-medium truncate">Archivo listo: {selectedFile.name}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => void handleSave()} disabled={isSaving || !selectedFile}>
          {isSaving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Guardar y Enviar Ejercicio
        </Button>
      </div>
    </div>
  )
}
