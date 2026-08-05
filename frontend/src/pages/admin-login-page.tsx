import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRight,
  FileKey2,
  LockKeyhole,
  ShieldCheck,
  UserCircle2,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

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
import { useAuth } from '@/features/auth/auth-provider'

const loginSchema = z.object({
  username: z.string().min(3, 'Ingresa un usuario valido'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function AdminLoginPage() {
  const { isAuthenticated, signIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [errorMessage, setErrorMessage] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockErrorMessage, setUnlockErrorMessage] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: 'admin',
      password: 'Admin12345',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setErrorMessage('')

    try {
      await signIn(values)
      const destination = location.state?.from?.pathname ?? '/admin'
      navigate(destination, { replace: true })
    } catch {
      setErrorMessage('No fue posible iniciar sesion. Verifica tus credenciales.')
    }
  })

  async function handleUnlockPanel() {
    if (!user?.username) {
      setUnlockErrorMessage('No fue posible validar la sesion administrativa.')
      return
    }

    setUnlockErrorMessage('')
    setIsUnlocking(true)

    try {
      await signIn({
        username: user.username,
        password: unlockPassword,
      })
      const destination = location.state?.from?.pathname ?? '/admin'
      navigate(destination, { replace: true })
    } catch {
      setUnlockErrorMessage('Contrasena incorrecta. Confirma tus credenciales para abrir el panel.')
    } finally {
      setIsUnlocking(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.24),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.22),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_50%,_#f8fafc_100%)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur">
            Evaluacion estrategica para PENSIV
          </div>

          <div className="max-w-2xl space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Evalua y selecciona a los candidatos mas aptos para operar en PENSIV.
            </h1>
            <p className="max-w-xl text-lg text-slate-600">
              Esta plataforma centraliza el acceso administrativo y el portal del
              aspirante para medir precision, criterio operativo y desempeno en
              procesos clave relacionados con PENSIV.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Seleccion objetiva', 'Concentra evidencia para identificar candidatos optimos para PENSIV.'],
              ['Seguridad de acceso', 'Protege el ingreso administrativo y resguarda la informacion del proceso.'],
              ['Operacion profesional', 'Presenta una experiencia clara, formal y alineada con evaluaciones institucionales.'],
            ].map(([title, description]) => (
              <Card key={title} className="border-white/60 bg-white/70 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <Card className="border-white/60 bg-white/80 shadow-2xl backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <CardTitle>Acceso de administrador</CardTitle>
                  <CardDescription>
                    Ingresa para gestionar evaluaciones, revisar desempeno y
                    tomar decisiones sobre candidatos para PENSIV.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isAuthenticated ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Sesion activa como <strong>{user?.full_name}</strong>. Por seguridad,
                    confirma tu contrasena antes de abrir el panel administrativo.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unlock-password">Contrasena de administrador</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="unlock-password"
                        className="pl-10"
                        placeholder="********"
                        type="password"
                        value={unlockPassword}
                        onChange={(event) => setUnlockPassword(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleUnlockPanel()
                          }
                        }}
                      />
                    </div>
                  </div>

                  {unlockErrorMessage ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {unlockErrorMessage}
                    </div>
                  ) : null}

                  <Button
                    className="w-full"
                    size="lg"
                    type="button"
                    disabled={isUnlocking || unlockPassword.length < 8}
                    onClick={() => void handleUnlockPanel()}
                  >
                    {isUnlocking ? 'Validando acceso...' : 'Ir al panel administrativo'}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuario</Label>
                    <div className="relative">
                      <UserCircle2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="username"
                        className="pl-10"
                        placeholder="admin"
                        {...register('username')}
                      />
                    </div>
                    {errors.username ? (
                      <p className="text-sm text-destructive">{errors.username.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Contrasena</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="password"
                        className="pl-10"
                        placeholder="********"
                        type="password"
                        {...register('password')}
                      />
                    </div>
                    {errors.password ? (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    ) : null}
                  </div>

                  {errorMessage ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {errorMessage}
                    </div>
                  ) : null}

                  <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Ingresando...' : 'Entrar al panel'}
                    <ArrowRight className="size-4" />
                  </Button>

                  <p className="text-center text-xs text-slate-500">
                    Credenciales iniciales de desarrollo: <strong>admin / Admin12345</strong>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-white/75 shadow-xl backdrop-blur">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                  <UserRound className="size-5" />
                </div>
                <div>
                  <CardTitle>Acceso de candidato</CardTitle>
                  <CardDescription>
                    Entra al portal para validar tu codigo, registrar tus datos y
                    responder la evaluacion orientada a PENSIV.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                El portal del aspirante conserva reanudacion de sesion, temporizador,
                trazabilidad y control del intento para una evaluacion formal y auditable.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">Evaluacion enfocada</p>
                  <p className="mt-1 text-slate-600">
                    Flujo completo para validar codigo e iniciar la evaluacion del perfil.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">Acceso de prueba</p>
                  <p className="mt-1 text-slate-600">EVAL-2026-DEMO</p>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                type="button"
                variant="outline"
                onClick={() => navigate('/candidato')}
              >
                <FileKey2 className="size-4" />
                Entrar como candidato
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
