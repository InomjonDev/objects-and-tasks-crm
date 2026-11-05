import { UserRound } from "lucide-react"
import { I18nProvider, LanguageSelect } from "./i18n"
import { PasswordInput } from "./components/password-input"
import { WorkspaceSkeleton } from "./components/workspace-skeleton"
import { ProfilePage } from "./profile"
import { useI18n } from "./i18n"
import { useState, type FormEvent } from "react"
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
} from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthProvider, useAuth } from "./auth"
import { WorkspaceProvider, useWorkspace } from "./workspace"
import { ErrorNotice } from "./editors"
import { configured, errorMessage, supabase } from "./supabase"
import {
  MyTasksPage,
  ProjectPage,
  ProjectsPage,
  TaskPage,
  Unavailable,
} from "./pages"

function Login() {
  const { t } = useI18n()

  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      const { error: failure } = await supabase!.auth.signInWithPassword({
        email: String(fields.get("email")).trim(),
        password: String(fields.get("password")),
      })
      if (failure) throw failure
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  if (session) return <Navigate to="/" replace />
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <LanguageSelect id="login-language" />
        </div>
        <div className="mt-8 rounded-xl border bg-card p-7 shadow-sm">
          <p className="eyebrow">{t("Рабочее пространство")}</p>
          <h1 className="text-2xl font-semibold">{t("Вход в систему")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("Объекты, задачи и результаты работы — в одном месте.")}{" "}
          </p>
          <form onSubmit={login} className="mt-6">
            <fieldset disabled={busy} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.ru"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("Пароль")}</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <ErrorNotice>{error}</ErrorNotice>
              <Button type="submit" className="w-full">
                {busy ? t("Входим…") : t("Войти")}
              </Button>
            </fieldset>
          </form>
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          {t("Доступ выдаёт администратор вашей команды.")}{" "}
        </p>
      </div>
    </main>
  )
}
function Brand() {
  const { t } = useI18n()

  return (
    <Link to="/" className="flex items-center gap-3 font-semibold">
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg text-primary-foreground"
      >
        О
      </span>
      <span>
        {t("Объекты и задачи")}{" "}
        <span className="block text-xs font-normal text-muted-foreground">
          {t("Строительная CRM")}{" "}
        </span>
      </span>
    </Link>
  )
}
function Protected() {
  const { t } = useI18n()

  const { session, profile, loading, error } = useAuth()
  const [logoutError, setLogoutError] = useState("")
  if (loading) return <WorkspaceSkeleton shell />
  if (!session) return <Navigate to="/login" replace />
  if (error || !profile)
    return (
      <main className="mx-auto max-w-lg space-y-5 p-8">
        <ErrorNotice>{error || t("Профиль не найден.")}</ErrorNotice>
        <ErrorNotice>{logoutError}</ErrorNotice>
        <Button
          onClick={() => {
            void supabase!.auth
              .signOut()
              .then(({ error: failure }) => {
                if (failure) setLogoutError(errorMessage(failure))
              })
              .catch((failure: unknown) =>
                setLogoutError(errorMessage(failure))
              )
          }}
        >
          {t("Выйти")}{" "}
        </Button>
      </main>
    )
  return (
    <WorkspaceProvider key={session.user.id}>
      <Layout />
    </WorkspaceProvider>
  )
}
function Layout() {
  const { t } = useI18n()

  const { profile } = useAuth()
  const { loading, error, refresh } = useWorkspace()
  const [logoutError, setLogoutError] = useState("")
  const [loggingOut, setLoggingOut] = useState(false)
  async function logout() {
    setLoggingOut(true)
    setLogoutError("")
    try {
      const { error: failure } = await supabase!.auth.signOut()
      if (failure) throw failure
    } catch (failure) {
      setLogoutError(errorMessage(failure))
    } finally {
      setLoggingOut(false)
    }
  }
  return (
    <div className="min-h-svh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-background focus:p-4"
      >
        {t("Перейти к содержимому")}{" "}
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Brand />
          <div className="flex max-w-full flex-wrap items-center gap-2 sm:gap-4">
            <LanguageSelect id="header-language" />
            <Link
              to="/profile"
              aria-label={t("Открыть профиль")}
              className="flex min-h-10 max-w-44 min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-right text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <UserRound aria-hidden="true" className="size-4" />
              <div>
                <p className="max-w-32 truncate font-medium">
                  {profile!.display_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile!.role === "manager"
                    ? t("Постановщик")
                    : t("Исполнитель")}
                </p>
              </div>
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled={loggingOut}
              onClick={() => void logout()}
            >
              {t("Выйти")}{" "}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <nav
          aria-label={t("Основная навигация")}
          className="mb-8 flex gap-6 border-b"
        >
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              `nav-link ${isActive ? "nav-active" : ""}`
            }
          >
            {t("Объекты")}{" "}
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `nav-link ${isActive ? "nav-active" : ""}`
            }
          >
            {t("Профиль")}
          </NavLink>
          {profile!.role === "executor" && (
            <NavLink
              to="/my-tasks"
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-active" : ""}`
              }
            >
              {t("Мои задачи")}{" "}
            </NavLink>
          )}
        </nav>
        <main id="main" className="pb-12">
          <ErrorNotice>{logoutError}</ErrorNotice>
          {loading ? (
            <WorkspaceSkeleton />
          ) : error ? (
            <div className="space-y-4">
              <ErrorNotice>{error}</ErrorNotice>
              <Button variant="outline" onClick={() => void refresh()}>
                {t("Повторить загрузку")}{" "}
              </Button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
function Home() {
  const { profile } = useAuth()
  return (
    <Navigate
      to={profile?.role === "executor" ? "/my-tasks" : "/projects"}
      replace
    />
  )
}
function ExecutorTasks() {
  const { profile } = useAuth()
  return profile?.role === "executor" ? (
    <MyTasksPage />
  ) : (
    <Navigate to="/projects" replace />
  )
}

function Application() {
  const { t } = useI18n()

  if (!configured)
    return (
      <main className="mx-auto max-w-lg space-y-3 p-8">
        <h1 className="text-2xl font-semibold">{t("Подключите Supabase")}</h1>
        <p className="text-muted-foreground">
          {t(
            "Укажите параметры подключения из README и перезапустите приложение."
          )}{" "}
        </p>
      </main>
    )
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route index element={<Home />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectPage />} />
            <Route path="tasks/:id" element={<TaskPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="my-tasks" element={<ExecutorTasks />} />
            <Route path="*" element={<Unavailable />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <Application />
    </I18nProvider>
  )
}
