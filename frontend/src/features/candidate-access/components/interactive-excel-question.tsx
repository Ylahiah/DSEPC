import { Download, Loader2, UploadCloud, FileSpreadsheet, CheckCircle2, FileCheck, Info } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

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
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelectedFile(null)
    setIsDraggingOver(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [question.id])

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

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm')) {
        setSelectedFile(file)
      } else {
        onError('Por favor, arrastra un archivo Excel válido (.xlsx o .xlsm)')
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
    <div className="space-y-4">
      {/* Box de Instrucciones Oficiales */}
      {question.excel_exercise?.instructions && (
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs text-blue-950 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-blue-900 mb-1.5 uppercase tracking-wide text-[11px]">
            <Info className="size-4 text-blue-600 shrink-0" />
            <span>Instrucciones Específicas del Reactivo</span>
          </div>
          <p className="leading-relaxed text-slate-700 pl-6">
            {question.excel_exercise.instructions}
          </p>
        </div>
      )}

      {/* Zona de Trabajo en 2 Pasos */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Paso 1: Descargar Plantilla */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                1
              </span>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Descarga el Archivo Base
              </h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Obtén el libro de trabajo con la estructura y datos de partida para resolver los requerimientos.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void handleDownload()}
            disabled={isDownloading}
            variant="outline"
            className="w-full text-xs font-semibold border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            {isDownloading ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <Download className="mr-2 size-3.5 text-blue-600" />
            )}
            Descargar Plantilla (.xlsx)
          </Button>
        </div>

        {/* Paso 2: Subir Archivo Resuelto (con soporte Drag & Drop) */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-xl border p-5 shadow-2xs flex flex-col justify-between space-y-4 transition-all duration-200 ${
            isDraggingOver
              ? 'border-2 border-dashed border-blue-500 bg-blue-50/90 ring-4 ring-blue-500/20 scale-[1.01]'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                2
              </span>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Entrega tu Solución
              </h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isDraggingOver
                ? 'Suelta aquí tu archivo Excel para cargarlo automáticamente.'
                : 'Arrastra y suelta tu archivo resuelto aquí o selecciónalo de tu equipo.'}
            </p>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".xlsx,.xlsm"
              onChange={handleFileSelect}
            />

            {isDraggingOver ? (
              <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-400 bg-blue-100/60 rounded-lg text-blue-900 text-xs animate-pulse text-center space-y-1">
                <UploadCloud className="size-6 text-blue-600 animate-bounce" />
                <span className="font-bold">¡Suelta tu archivo Excel aquí!</span>
                <span className="text-[10px] text-blue-700">.xlsx o .xlsm</span>
              </div>
            ) : selectedFile ? (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-emerald-300 bg-emerald-50/80 text-emerald-900 text-xs shadow-2xs">
                <div className="flex items-center gap-2 truncate">
                  <FileCheck className="size-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold truncate">{selectedFile.name}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-6 px-2 text-[11px] text-emerald-800 hover:bg-emerald-100"
                >
                  Cambiar
                </Button>
              </div>
            ) : question.is_answered ? (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50/70 text-blue-900 text-xs shadow-2xs">
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span className="font-medium truncate">Solución previa registrada</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-6 px-2.5 text-[11px] text-blue-800 hover:bg-blue-100/70 border-blue-300"
                >
                  Reemplazar
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group flex flex-col sm:flex-row items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg bg-slate-50/60 hover:bg-blue-50/40 cursor-pointer transition text-center"
              >
                <UploadCloud className="size-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">
                  Arrastra aquí o <span className="underline">explora archivos</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Botón de Confirmación y Validación */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <FileSpreadsheet className="size-4 text-emerald-600" />
          <span>Formatos admitidos: .xlsx, .xlsm</span>
        </div>

        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || !selectedFile}
          className="text-xs font-semibold px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Validando entrega...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-1.5 size-3.5" />
              Guardar y Validar Ejercicio
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
