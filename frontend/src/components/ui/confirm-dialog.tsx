import { AlertTriangle, Info, RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onClose])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const iconConfig = {
    danger: {
      bg: 'bg-rose-100 text-rose-600 border border-rose-200',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white',
      icon: AlertTriangle,
    },
    warning: {
      bg: 'bg-amber-100 text-amber-600 border border-amber-200',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white',
      icon: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-100 text-blue-600 border border-blue-200',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white',
      icon: Info,
    },
  }[variant]

  const IconComponent = iconConfig.icon

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3.5 pt-1">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconConfig.bg}`}
          >
            <IconComponent className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
            {description ? (
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void onConfirm()}
            disabled={isLoading}
            className={`text-xs font-semibold ${iconConfig.btn}`}
          >
            {isLoading ? <RefreshCw className="size-3.5 animate-spin mr-1.5" /> : null}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
