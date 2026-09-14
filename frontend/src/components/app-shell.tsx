import {
  BarChart3,
  BookCopy,
  ChevronRight,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-provider'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/generador-ejercicios', label: 'Generador Excel', icon: Sparkles },
  { to: '/admin/preguntas', label: 'Banco de preguntas', icon: BookCopy },
  { to: '/admin/evaluaciones', label: 'Plantillas', icon: ClipboardList },
  { to: '/admin/codigos', label: 'Códigos de acceso', icon: KeyRound },
  { to: '/admin/candidatos', label: 'Padrón de candidatos', icon: Users },
  { to: '/admin/reportes', label: 'Reportes y dictamen', icon: BarChart3 },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export function AppShell() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('dsepc.sidebar.collapsed') === 'true'
  })

  function toggleSidebar() {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('dsepc.sidebar.collapsed', String(next))
      return next
    })
  }

  // Get active breadcrumb title
  const currentNavItem = navItems.find((item) => {
    if (item.exact) return location.pathname === item.to
    return location.pathname.startsWith(item.to)
  })

  const pageTitle = currentNavItem ? currentNavItem.label : 'Mesa de Control'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Docked Left Sidebar */}
      <aside
        className={cn(
          'flex h-full flex-col border-r border-slate-800 bg-[#0b1329] text-slate-300 transition-all duration-200 z-30 select-none shrink-0',
          isCollapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center gap-3 border-b border-slate-800 px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <ShieldCheck className="size-4" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <span className="text-sm font-bold tracking-tight text-white">DSEPC</span>
              <p className="truncate text-[11px] text-slate-400">Mesa de Control</p>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {!isCollapsed && (
            <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Administración
            </div>
          )}
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              title={isCollapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-blue-600/15 font-semibold text-blue-400 border-l-2 border-blue-500'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
                  isCollapsed && 'justify-center px-2 py-2.5',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Footer Profile */}
        <div className="border-t border-slate-800 p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-md bg-slate-800/60 p-2 text-xs',
              isCollapsed && 'justify-center p-2',
            )}
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200 font-bold text-xs">
              <User className="size-3.5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white leading-tight">
                  {user?.full_name || 'Administrador'}
                </p>
                <p className="truncate text-[11px] text-slate-400 leading-tight">
                  {user?.email || 'admin@pensiv.com'}
                </p>
              </div>
            )}
            {!isCollapsed && (
              <button
                type="button"
                onClick={signOut}
                title="Cerrar sesión"
                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <LogOut className="size-3.5" />
              </button>
            )}
          </div>
          {isCollapsed && (
            <button
              type="button"
              onClick={signOut}
              title="Cerrar sesión"
              className="mt-2 flex w-full justify-center rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main App Content Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Executive Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="size-8 text-slate-500 hover:text-slate-900"
              title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-400">Admin</span>
              <ChevronRight className="size-3 text-slate-400" />
              <span className="font-semibold text-slate-900">{pageTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Servidor Activo
            </div>

            <Link
              to="/candidato"
              className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <UserCheck className="size-3.5 text-blue-600" />
              Portal Candidato
            </Link>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
          <div className="mx-auto w-full max-w-[1720px] space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
