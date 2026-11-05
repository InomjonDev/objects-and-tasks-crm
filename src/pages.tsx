import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react"
import { useI18n } from "./i18n"
import { useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useAuth } from "./auth"
import { useWorkspace } from "./workspace"
import { DeleteRecord, ErrorNotice, ProjectEditor, TaskEditor } from "./editors"
import { StatusBadge, TaskList } from "./task-list"
import {
  actionLabels,
  availableTransitions,
  statuses,
  type Status,
} from "./workflow"
import { errorMessage, supabase, type Task } from "./supabase"

export function ProjectsPage() {
  const { t } = useI18n()

  const { profile } = useAuth()
  const { projects, tasks } = useWorkspace()
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t("Стройки и команда")}</p>
          <h1>{t("Объекты")}</h1>
          <p className="text-muted-foreground">
            {profile?.role === "manager"
              ? t("Назначайте работу и следите за выполнением.")
              : t("Объекты, на которых вам назначены задачи.")}
          </p>
        </div>
        {profile?.role === "manager" && <ProjectEditor />}
      </header>
      {!projects.length ? (
        <div className="empty-panel">
          <h2>{t("Объектов пока нет")}</h2>
          <p>
            {profile?.role === "manager"
              ? t("Создайте первый объект, чтобы назначить задачи.")
              : t("Объекты появятся, когда вам назначат первую задачу.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const visibleTasks = tasks.filter(
              (task) => task.project_id === project.id
            )
            const completed = visibleTasks.filter(
              (task) => task.status === "accepted"
            ).length
            return (
              <Link
                to={`/projects/${project.id}`}
                key={project.id}
                className="group flex min-h-52 flex-col rounded-xl border bg-card p-6 transition-colors hover:border-primary/45 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="mb-5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  {t("Строительный объект")}{" "}
                </span>
                <h2 className="text-xl font-semibold break-words group-hover:text-primary">
                  {project.name}
                </h2>
                <p className="mt-2 text-sm break-words text-muted-foreground">
                  {project.address}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-7 text-sm">
                  <span>
                    {t("Задач:")} {visibleTasks.length} {t("· Принято:")}{" "}
                    {completed}
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
export function ProjectPage() {
  const { t } = useI18n()

  const { id } = useParams()
  const { profile } = useAuth()
  const { projects, tasks } = useWorkspace()
  const project = projects.find((item) => item.id === id)
  if (!project) return <Unavailable />
  const manager = profile?.role === "manager"
  return (
    <>
      <Link to="/projects" className="back-link">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("Все объекты")}
      </Link>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t("Объект")}</p>
          <h1>{project.name}</h1>
          <p className="text-muted-foreground">{project.address}</p>
        </div>
        {manager && (
          <div className="flex flex-wrap gap-2">
            <ProjectEditor project={project} />
            <DeleteRecord kind="project" id={project.id} after="/projects" />
          </div>
        )}
      </header>
      <section>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{t("Задачи объекта")}</h2>
          {manager && <TaskEditor projectId={project.id} />}
        </div>
        <TaskList
          tasks={tasks.filter((task) => task.project_id === project.id)}
        />
      </section>
    </>
  )
}
export function MyTasksPage() {
  const { t } = useI18n()

  const { profile } = useAuth()
  const { tasks } = useWorkspace()
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t("Личная работа")}</p>
          <h1>{t("Мои задачи")}</h1>
          <p className="text-muted-foreground">
            {t(
              "Возьмите задачу в работу и отправьте результат на проверку."
            )}{" "}
          </p>
        </div>
      </header>
      <TaskList
        tasks={tasks.filter((task) => task.assignee_id === profile?.id)}
        showProject
      />
    </>
  )
}
function TaskActions({ task }: { task: Task }) {
  const { t } = useI18n()

  const { profile } = useAuth()
  const { refresh } = useWorkspace()
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [revising, setRevising] = useState(false)
  const actions = availableTransitions(
    task.status,
    profile!.role,
    task.assignee_id === profile!.id
  )
  async function transition(next: Status) {
    setBusy(true)
    setError("")
    try {
      const { error: failure } = await supabase!.rpc("transition_task", {
        p_task_id: task.id,
        p_expected_status: task.status,
        p_next_status: next,
        p_comment: comment.trim() || null,
      })
      if (failure) throw failure
      setComment("")
      setRevising(false)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      await refresh()
      setBusy(false)
    }
  }
  function returnForRevision(event: FormEvent) {
    event.preventDefault()
    void transition("needs_revision")
  }
  if (!actions.length)
    return (
      <p className="text-sm text-muted-foreground">
        {task.status === "accepted"
          ? t("Работа принята. Задача завершена.")
          : task.status === "in_review"
            ? t("Ожидает проверки постановщика.")
            : t("Следующий шаг — за исполнителем.")}
      </p>
    )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {actions.map((next) => (
          <Button
            key={next}
            variant={next === "needs_revision" ? "outline" : "default"}
            disabled={busy}
            onClick={() => {
              if (next === "needs_revision") setRevising(true)
              else void transition(next)
            }}
          >
            {busy ? t("Сохраняем…") : t(actionLabels[next] ?? next)}
          </Button>
        ))}
      </div>
      {revising && (
        <form onSubmit={returnForRevision} className="space-y-3">
          <Label htmlFor="revision-comment">{t("Что нужно доработать?")}</Label>
          <Textarea
            id="revision-comment"
            required
            maxLength={2000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={busy}
            placeholder={t("Опишите, что нужно исправить")}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !comment.trim()}>
              {t("Подтвердить возврат")}{" "}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setRevising(false)}
            >
              {t("Отмена")}{" "}
            </Button>
          </div>
        </form>
      )}
      <ErrorNotice>{error}</ErrorNotice>
    </div>
  )
}
export function TaskPage() {
  const { t, locale } = useI18n()

  const { id } = useParams()
  const { profile } = useAuth()
  const { tasks, projects, profiles, history } = useWorkspace()
  const task = tasks.find((item) => item.id === id)
  if (!task) return <Unavailable />
  const name = (userId: string) =>
    profiles.find((person) => person.id === userId)?.display_name ??
    t("Пользователь")
  const entries = history.filter((entry) => entry.task_id === task.id)
  return (
    <>
      <Link to={`/projects/${task.project_id}`} className="back-link">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {projects.find((project) => project.id === task.project_id)?.name}
      </Link>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{t("Задача")}</p>
          <h1>{task.title}</h1>
          <div className="mt-3">
            <StatusBadge status={task.status} />
          </div>
        </div>
        {profile?.role === "manager" && (
          <div className="flex flex-wrap gap-2">
            <TaskEditor task={task} projectId={task.project_id} />
            <DeleteRecord
              kind="task"
              id={task.id}
              after={`/projects/${task.project_id}`}
            />
          </div>
        )}
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("О задаче")}</h2>
          <p className="mt-4 text-sm leading-7 break-words whitespace-pre-wrap">
            {task.description || t("Описание не добавлено.")}
          </p>
          <dl className="my-6 grid gap-4 border-y py-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("Исполнитель")}</dt>
              <dd className="mt-1 font-medium">{name(task.assignee_id)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Постановщик")}</dt>
              <dd className="mt-1 font-medium">{name(task.author_id)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("Создана")}</dt>
              <dd className="mt-1">{formatDate(task.created_at, locale)}</dd>
            </div>
          </dl>
          <TaskActions key={task.id} task={task} />
        </section>
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("История статусов")}</h2>
          <ol className="mt-6 space-y-6">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="relative border-l-2 border-primary/20 pl-5"
              >
                <span className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-primary" />
                <p className="text-sm font-medium">
                  {entry.from_status ? (
                    <>
                      {t(statuses[entry.from_status])}
                      <ArrowRight
                        aria-hidden="true"
                        className="mx-2 inline size-3.5"
                      />
                      <span className="sr-only"> — </span>
                      {t(statuses[entry.to_status])}
                    </>
                  ) : (
                    t("Задача создана")
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {name(entry.actor_id)} ·{" "}
                  {formatDate(entry.created_at, locale)}
                </p>
                {entry.comment && (
                  <p className="mt-3 rounded-lg bg-muted p-3 text-sm break-words whitespace-pre-wrap">
                    {entry.comment}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}
function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
export function Unavailable() {
  const { t } = useI18n()

  return (
    <div className="empty-panel">
      <h1>{t("Запись недоступна")}</h1>
      <p>{t("Она удалена или у вас нет доступа.")}</p>
      <Link to="/projects" className="back-link">
        {t("К объектам")}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  )
}
