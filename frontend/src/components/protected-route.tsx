import { LoaderCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
          <LoaderCircle className="size-4 animate-spin" />
          Validando sesion...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <Outlet />
}
