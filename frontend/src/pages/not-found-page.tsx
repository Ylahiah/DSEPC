import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <p className="text-sm font-medium text-primary">404</p>
          <CardTitle>La pagina que buscas no existe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Revisa la ruta o vuelve al punto de entrada del sistema.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/"
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              Portal candidato
            </Link>
            <Link to="/admin/login" className={cn(buttonVariants())}>
              Acceso admin
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
