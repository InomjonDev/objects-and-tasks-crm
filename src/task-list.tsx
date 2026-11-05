import { useI18n } from "./i18n"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { statuses, type Status } from "./workflow"
import { useWorkspace } from "./workspace"
import type { Task } from "./supabase"

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n()

  return (
    <Badge variant="secondary" className={`status-${status} whitespace-nowrap`}>
      {t(statuses[status])}
    </Badge>
  )
}
export function TaskList({
  tasks,
  showProject = false,
}: {
  tasks: Task[]
  showProject?: boolean
}) {
  const { t } = useI18n()

  const { profiles, projects } = useWorkspace()
  if (!tasks.length)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">{t("Задач пока нет")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Здесь появятся доступные вам задачи.")}{" "}
        </p>
      </div>
    )
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-medium">{t("Задача")}</th>
            {showProject && (
              <th className="px-5 py-3 font-medium">{t("Объект")}</th>
            )}
            <th className="px-5 py-3 font-medium">{t("Исполнитель")}</th>
            <th className="px-5 py-3 font-medium">{t("Статус")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-muted/30">
              <td className="min-w-48 px-5 py-4">
                <Link
                  className="font-medium underline-offset-4 hover:underline"
                  to={`/tasks/${task.id}`}
                >
                  {task.title}
                </Link>
              </td>
              {showProject && (
                <td className="min-w-40 px-5 py-4 text-muted-foreground">
                  <Link
                    to={`/projects/${task.project_id}`}
                    className="hover:underline"
                  >
                    {
                      projects.find((project) => project.id === task.project_id)
                        ?.name
                    }
                  </Link>
                </td>
              )}
              <td className="px-5 py-4 text-muted-foreground">
                {profiles.find((profile) => profile.id === task.assignee_id)
                  ?.display_name ?? t("Исполнитель")}
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={task.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
