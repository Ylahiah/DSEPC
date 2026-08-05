import {
  BarChart3,
  BookCopy,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-provider'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/preguntas', label: 'Banco de preguntas', icon: BookCopy },
  { to: '/admin/evaluaciones', label: 'Plantillas', icon: ClipboardList },
  { to: '/admin/codigos', label: 'Codigos', icon: KeyRound },
  { to: '/admin/candidatos', label: 'Candidatos', icon: Users },
  { to: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
]

export function AppShell() {
  const { signOut, user } = useAuth()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(79,70,229,0.14),_transparent_28%),var(--background)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-72 flex-col rounded-3xl border border-border/70 bg-sidebar px-5 py-6 text-sidebar-foreground shadow-xl lg:flex">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sidebar-foreground/60">
                DSEPC
              </p>
              <h1 className="text-lg font-semibold">Mesa de Control</h1>
            </div>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
            <p className="text-sm font-medium">{user?.full_name}</p>
            <p className="mt-1 text-xs text-sidebar-foreground/60">{user?.email}</p>
            <Button className="mt-4 w-full" variant="outline" onClick={signOut}>
              <LogOut className="size-4" />
              Cerrar sesion
            </Button>
          </div>
        </aside>

        <main className="flex-1 rounded-[2rem] border border-border/70 bg-background/80 p-4 shadow-2xl backdrop-blur md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
