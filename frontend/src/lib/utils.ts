import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { isAxiosError } from 'axios'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error) && error.response) {
    const detail = error.response.data?.detail
    if (typeof detail === 'string') {
      return detail
    } else if (detail) {
      return JSON.stringify(detail)
    }
  }
  return 'No fue posible completar la operacion.'
}
