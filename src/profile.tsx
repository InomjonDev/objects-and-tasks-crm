import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  ArrowUpRight,
  CheckCircle2,
  HardHat,
  ListTodo,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "./auth"
import { useWorkspace } from "./workspace"
import { LanguageSelect, useI18n } from "./i18n"
import { ErrorNotice, ProjectEditor, TaskEditor } from "./editors"
import { supabase, errorMessage } from "./supabase"
import { StaffSection } from "./staff"

export function ProfilePage() {
  const { profile, session, refreshProfile } = useAuth()
  const { tasks, projects, refresh } = useWorkspace()
  const { t, locale } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const manager = profile!.role === "manager"
  const assigned = tasks.filter((task) => task.assignee_id === profile!.id)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get("name")).trim()
    setBusy(true)
    setError("")
    setSaved(false)
    try {
      const { error: failure } = await supabase!.rpc("update_profile", {
        p_display_name: name,
      })
      if (failure) throw failure
      await Promise.all([refreshProfile(), refresh()])
      setSaved(true)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t("Настройки аккаунта")}</p>
          <h1>{t("Профиль")}</h1>
          <p className="text-muted-foreground">
            {t("Личная информация и настройки рабочего пространства.")}
          </p>
        </div>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-xl border bg-card p-6 sm:p-8">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted">
            <UserRound className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-semibold break-words">
            {profile!.display_name}
          </h2>
          <p className="mt-2 text-sm break-all text-muted-foreground">
            {session!.user.email}
          </p>
          <Badge variant="secondary" className="mt-4 gap-1.5">
            {manager ? (
              <ShieldCheck className="size-3.5" aria-hidden="true" />
            ) : (
              <HardHat className="size-3.5" aria-hidden="true" />
            )}
            {t(manager ? "Постановщик" : "Исполнитель")}
          </Badge>
          <dl className="mt-7 grid gap-4 border-t pt-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("Дата регистрации")}</dt>
              <dd>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                }).format(new Date(session!.user.created_at))}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <ListTodo className="size-4" aria-hidden="true" />
                {t(manager ? "Создано вами" : "Назначено")}
              </dt>
              <dd className="font-medium tabular-nums">
                {manager
                  ? tasks.filter((task) => task.author_id === profile!.id)
                      .length
                  : assigned.length}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t("Принято")}
              </dt>
              <dd className="font-medium tabular-nums">
                {
                  (manager ? tasks : assigned).filter(
                    (task) => task.status === "accepted"
                  ).length
                }
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border bg-card p-6 sm:p-8">
          <h2 className="mb-6 text-lg font-semibold">{t("Личные данные")}</h2>
          <form onSubmit={save}>
            <fieldset disabled={busy} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-name">{t("Имя")}</Label>
                <Input
                  id="profile-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={profile!.display_name}
                  autoComplete="name"
                  onChange={() => setSaved(false)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={session!.user.email ?? ""}
                  readOnly
                  className="text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  {t("Email и роль назначает администратор.")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-language">{t("Язык")}</Label>
                <LanguageSelect id="profile-language" />
              </div>
              <ErrorNotice>{error}</ErrorNotice>
              {saved && (
                <p role="status" className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t("Изменения сохранены.")}
                </p>
              )}
              <Button type="submit" className="min-h-10">
                {t(busy ? "Сохраняем…" : "Сохранить изменения")}
              </Button>
            </fieldset>
          </form>
        </section>
      </div>
      <section className="my-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Plus className="size-4" aria-hidden="true" />
          {t("Быстрые действия")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {manager ? (
            <>
              <ProjectEditor />
              {projects.length > 0 && <TaskEditor projectId={projects[0].id} />}
            </>
          ) : (
            <Button variant="outline" render={<Link to="/my-tasks" />}>
              {t("Мои задачи")}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </section>
      {manager && <StaffSection />}
    </>
  )
}
