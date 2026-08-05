import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import { fetchCurrentUser, loginAdmin, type LoginPayload } from './auth-service'
import { authStorage, type AuthUser } from './auth-storage'

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  user: AuthUser | null
  signIn: (payload: LoginPayload) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(authStorage.getUser())
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const token = authStorage.getToken()

    if (!token) {
      setIsLoading(false)
      return
    }

    void fetchCurrentUser()
      .then((currentUser) => {
        authStorage.setUser(currentUser)
        setUser(currentUser)
      })
      .catch(() => {
        authStorage.clearSession()
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const signIn = useCallback(async (payload: LoginPayload) => {
    const response = await loginAdmin(payload)
    authStorage.setToken(response.access_token)
    authStorage.setUser(response.user)
    setUser(response.user)
  }, [])

  const signOut = useCallback(() => {
    authStorage.clearSession()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(user),
      isLoading,
      user,
      signIn,
      signOut,
    }),
    [isLoading, signIn, signOut, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider')
  }

  return context
}
