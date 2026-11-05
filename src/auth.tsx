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
  refreshProfile: () => Promise<void>
}>({
  session: null,
  profile: null,
  loading: true,
  error: "",
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState("")
  useEffect(() => {
    if (!supabase) return
    let active = true
    let sequence = 0
    let identity: string | null | undefined
    const receive = (next: Session | null) => {
      setSession(next)
      const nextIdentity = next?.user.id ?? null
      if (nextIdentity === identity) return
      identity = nextIdentity
      const request = ++sequence
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
  async function refreshProfile() {
    if (!session) return
    const { data, error: failure } = await supabase!
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
    if (failure) throw failure
    setProfile((current) => (current?.id === data.id ? data : current))
  }
  return (
    <AuthContext.Provider
      value={{ session, profile, loading, error, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  return useContext(AuthContext)
}
