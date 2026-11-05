import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const configured = Boolean(url && key)
export const supabase = configured ? createClient<Database>(url, key) : null
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type Task = Database["public"]["Tables"]["tasks"]["Row"]
export type History = Database["public"]["Tables"]["task_history"]["Row"]

export function errorMessage(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : ""
  if (message === "Invalid login credentials")
    return "Неверный email или пароль."
  if (message === "Failed to fetch" || message.includes("NetworkError"))
    return "Нет связи с сервером. Проверьте подключение и повторите попытку."
  if (message.includes("check constraint"))
    return "Проверьте заполнение полей и допустимую длину текста."
  return message || "Не удалось выполнить действие. Повторите попытку."
}
