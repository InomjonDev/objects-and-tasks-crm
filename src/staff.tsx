import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Plus, RefreshCw, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PasswordInput } from "./components/password-input"
import { ErrorNotice } from "./editors"
import { useI18n } from "./i18n"
import { supabase, errorMessage } from "./supabase"
import { useWorkspace } from "./workspace"
import type { Database } from "./database.types"

type Staff = Database["public"]["Functions"]["list_staff"]["Returns"][number]
function StaffEditor({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const password = String(fields.get("password"))
    if (
      password.length < 10 ||
      new TextEncoder().encode(password).length > 72
    ) {
      setError("Проверьте имя, email, роль и длину пароля.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const { data, error: failure } = await supabase!.functions.invoke(
        "create-staff",
        {
          body: {
            name: String(fields.get("name")).trim(),
            email: String(fields.get("email")).trim(),
            role: String(fields.get("role")),
            password,
          },
        }
      )
      if (failure) {
        let code: string | undefined
        if (failure.context instanceof Response) {
          try {
            code = (await failure.context.json()).error
          } catch {
            /* Keep a generic message for non-JSON gateway errors. */
          }
        }
        throw new Error(
          code === "email_exists"
            ? "Этот email уже используется."
            : code === "invalid_input"
              ? "Проверьте имя, email, роль и длину пароля."
              : code === "forbidden"
                ? "Действие доступно только постановщику"
                : "Сервис временно недоступен. Повторите попытку."
        )
      }
      if (!data?.user?.id)
        throw new Error("Не удалось выполнить действие. Повторите попытку.")
      await onCreated()
      setOpen(false)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value)
          setError("")
        }
      }}
    >
      <DialogTrigger render={<Button className="min-h-10" />}>
        <Plus aria-hidden="true" className="size-4" />
        {t("Добавить сотрудника")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Новый сотрудник")}</DialogTitle>
          <DialogDescription>
            {t("Создайте аккаунт и передайте доступы сотруднику лично.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={create}>
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="staff-name">{t("Имя")}</Label>
              <Input
                id="staff-name"
                name="name"
                required
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-role">{t("Роль")}</Label>
              <NativeSelect
                id="staff-role"
                name="role"
                defaultValue="executor"
                className="w-full"
              >
                <NativeSelectOption value="executor">
                  {t("Исполнитель")}
                </NativeSelectOption>
                <NativeSelectOption value="manager">
                  {t("Постановщик")}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-password">
                {t("Пароль для первого входа")}
              </Label>
              <PasswordInput
                id="staff-password"
                name="password"
                required
                minLength={10}
                maxLength={72}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                {t("От 10 символов")}
              </p>
            </div>
            <ErrorNotice>{error}</ErrorNotice>
            <Button type="submit" className="min-h-10 w-full">
              {t(busy ? "Создаём…" : "Создать аккаунт")}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export function StaffSection() {
  const { refresh } = useWorkspace()
  const { t, locale } = useI18n()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [created, setCreated] = useState(false)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setError("")
    try {
      const { data, error: failure } = await supabase!.rpc("list_staff")
      if (failure) throw failure
      if (request === sequence.current) setStaff(data ?? [])
    } catch {
      if (request === sequence.current)
        setError("Не удалось загрузить сотрудников.")
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
      if (active) void load()
    })
    return () => {
      active = false
      invalidate()
    }
  }, [load, invalidate])
  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <UsersRound className="size-5" aria-hidden="true" />
            {t("Команда")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Сотрудники и доступ к рабочему пространству.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-10"
            disabled={loading}
            aria-label={t("Обновить")}
            onClick={() => void load()}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
          <StaffEditor
            onCreated={async () => {
              setCreated(true)
              await Promise.all([load(), refresh()])
            }}
          />
        </div>
      </div>
      {created && (
        <p
          role="status"
          className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm"
        >
          {t("Аккаунт создан. Передайте сотруднику email и пароль лично.")}
        </p>
      )}
      <ErrorNotice>{error}</ErrorNotice>
      {loading ? (
        <div
          role="status"
          aria-label={t("Загрузка сотрудников…")}
          aria-busy="true"
          className="space-y-4 rounded-xl border p-5"
        >
          <span className="sr-only">{t("Загрузка сотрудников…")}</span>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : !staff.length ? (
        <p className="empty-panel">{t("Сотрудников пока нет")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">{t("Сотрудник")}</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">{t("Роль")}</th>
                <th className="px-5 py-3 font-medium">
                  {t("Дата регистрации")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((person) => (
                <tr key={person.id}>
                  <td className="min-w-40 px-5 py-4 font-medium">
                    {person.display_name}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {person.email}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="secondary">
                      {t(
                        person.role === "manager"
                          ? "Постановщик"
                          : "Исполнитель"
                      )}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(person.created_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
