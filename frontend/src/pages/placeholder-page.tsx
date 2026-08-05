import type { LucideIcon } from 'lucide-react'
import { Construction } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface PlaceholderPageProps {
  title: string
  description: string
  icon?: LucideIcon
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon = Construction,
}: PlaceholderPageProps) {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <Card className="max-w-xl">
        <CardHeader className="items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <CardTitle className="mt-2">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Esta vista forma parte del esqueleto operativo del modulo 1 y queda lista
          para integrarse con funcionalidad real en los siguientes modulos.
        </CardContent>
      </Card>
    </div>
  )
}
