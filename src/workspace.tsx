import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  supabase,
  errorMessage,
  type Project,
  type Task,
  type Profile,
  type History,
} from "./supabase"

type Records = {
  projects: Project[]
  tasks: Task[]
  profiles: Profile[]
  history: History[]
}
const empty: Records = { projects: [], tasks: [], profiles: [], history: [] }
const WorkspaceContext = createContext<
  Records & { loading: boolean; error: string; refresh: () => Promise<void> }
>({ ...empty, loading: true, error: "", refresh: async () => {} })

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    try {
      // shortcut: load visible demo records together, paginate when the dataset grows beyond 1000 rows.
      const responses = await Promise.all([
        supabase!
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase!
          .from("tasks")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase!.from("profiles").select("*").order("display_name"),
        supabase!.from("task_history").select("*").order("created_at"),
      ])
      const failed = responses.find((result) => result.error)?.error
      if (failed) throw failed
      if (request === sequence.current) {
        setError("")
        setRecords({
          projects: responses[0].data ?? [],
          tasks: responses[1].data ?? [],
          profiles: responses[2].data ?? [],
          history: responses[3].data ?? [],
        })
      }
    } catch (failure) {
      if (request === sequence.current) setError(errorMessage(failure))
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [])
  const invalidate = useCallback(() => {
    sequence.current++
  }, [])
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) void refresh()
    })
    return () => {
      active = false
      invalidate()
    }
  }, [refresh, invalidate])
  return (
    <WorkspaceContext.Provider value={{ ...records, loading, error, refresh }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
export function useWorkspace() {
  return useContext(WorkspaceContext)
}
