import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase, errorMessage, type Profile } from "./supabase"

const AuthContext = createContext<{
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string
}>({ session: null, profile: null, loading: true, error: "" })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState("")
  useEffect(() => {
    if (!supabase) return
    let active = true
    let sequence = 0
    const receive = (next: Session | null) => {
      const request = ++sequence
      setSession(next)
      setProfile(null)
      setError("")
      if (!next) {
        setLoading(false)
        return
      }
      setLoading(true)
      // Defer database calls outside the auth callback to avoid its session lock.
      void Promise.resolve()
        .then(async () => {
          const { data, error: failure } = await supabase!
            .from("profiles")
            .select("*")
            .eq("id", next.user.id)
            .single()
          if (!active || request !== sequence) return
          setProfile(data)
          setError(
            failure ? "Профиль не настроен. Обратитесь к администратору." : ""
          )
          setLoading(false)
        })
        .catch((failure: unknown) => {
          if (active && request === sequence) {
            setError(errorMessage(failure))
            setLoading(false)
          }
        })
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) receive(next)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  return (
    <AuthContext.Provider value={{ session, profile, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  return useContext(AuthContext)
}
