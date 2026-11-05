export const statuses = {
  new: "Новая",
  in_progress: "В работе",
  in_review: "На проверке",
  accepted: "Принята",
  needs_revision: "На доработке",
} as const

export type Status = keyof typeof statuses
export type Role = "manager" | "executor"

export function availableTransitions(
  status: Status,
  role: Role,
  assigned: boolean
): Status[] {
  if (role === "manager")
    return status === "in_review" ? ["accepted", "needs_revision"] : []
  if (!assigned) return []
  if (status === "new" || status === "needs_revision") return ["in_progress"]
  if (status === "in_progress") return ["in_review"]
  return []
}

export const actionLabels: Partial<Record<Status, string>> = {
  in_progress: "Взять в работу",
  in_review: "Отправить на проверку",
  accepted: "Принять задачу",
  needs_revision: "Вернуть на доработку",
}
