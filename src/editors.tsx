import { useState, type FormEvent, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { supabase, errorMessage, type Project, type Task } from "./supabase"
import { useWorkspace } from "./workspace"

export function ErrorNotice({ children }: { children: ReactNode }) {
  return children ? (
    <p
      role="alert"
      className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
    >
      {children}
    </p>
  ) : null
}

export function ProjectEditor({ project }: { project?: Project }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const { refresh } = useWorkspace()
  const navigate = useNavigate()
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      const { data, error: failure } = await supabase!.rpc("save_project", {
        p_id: project?.id ?? null,
        p_name: String(fields.get("name")).trim(),
        p_address: String(fields.get("address")).trim(),
      })
      if (failure) throw failure
      await refresh()
      setOpen(false)
      if (!project) navigate(`/projects/${data}`)
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
      <DialogTrigger
        render={<Button variant={project ? "outline" : "default"} />}
      >
        {project ? "Редактировать объект" : "Создать объект"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project ? "Редактировать объект" : "Новый объект"}
          </DialogTitle>
          <DialogDescription>
            Название стройки и адрес для вашей команды.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="project-name">Название</Label>
              <Input
                id="project-name"
                name="name"
                required
                maxLength={200}
                defaultValue={project?.name}
                placeholder="ЖК «Солнечный»"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-address">Адрес</Label>
              <Input
                id="project-address"
                name="address"
                required
                maxLength={500}
                defaultValue={project?.address}
                placeholder="ул. Строителей, 12"
              />
            </div>
            <ErrorNotice>{error}</ErrorNotice>
            <Button type="submit" className="w-full">
              {busy ? "Сохраняем…" : "Сохранить объект"}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TaskEditor({
  task,
  projectId,
}: {
  task?: Task
  projectId: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const { projects, profiles, refresh } = useWorkspace()
  const navigate = useNavigate()
  const executors = profiles.filter((profile) => profile.role === "executor")
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      const { data, error: failure } = await supabase!.rpc("save_task", {
        p_id: task?.id ?? null,
        p_title: String(fields.get("title")).trim(),
        p_description: String(fields.get("description")),
        p_project_id: String(fields.get("project")),
        p_assignee_id: String(fields.get("assignee")),
      })
      if (failure) throw failure
      await refresh()
      setOpen(false)
      if (!task) navigate(`/tasks/${data}`)
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
      <DialogTrigger render={<Button variant={task ? "outline" : "default"} />}>
        {task ? "Редактировать задачу" : "Создать задачу"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {task ? "Редактировать задачу" : "Новая задача"}
          </DialogTitle>
          <DialogDescription>
            Укажите работу, объект и ответственного исполнителя.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save}>
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Название</Label>
              <Input
                id="task-title"
                name="title"
                required
                maxLength={200}
                defaultValue={task?.title}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Описание</Label>
              <Textarea
                id="task-description"
                name="description"
                maxLength={10000}
                defaultValue={task?.description}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-project">Объект</Label>
              <NativeSelect
                id="task-project"
                name="project"
                defaultValue={task?.project_id ?? projectId}
                required
                className="w-full"
              >
                {projects.map((project) => (
                  <NativeSelectOption value={project.id} key={project.id}>
                    {project.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Исполнитель</Label>
              <NativeSelect
                id="task-assignee"
                name="assignee"
                defaultValue={task?.assignee_id ?? ""}
                required
                className="w-full"
              >
                <NativeSelectOption value="" disabled>
                  Выберите исполнителя
                </NativeSelectOption>
                {executors.map((profile) => (
                  <NativeSelectOption key={profile.id} value={profile.id}>
                    {profile.display_name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {!executors.length && (
              <p className="text-sm text-muted-foreground">
                Администратор должен добавить исполнителей.
              </p>
            )}
            <ErrorNotice>{error}</ErrorNotice>
            <Button
              type="submit"
              disabled={!executors.length}
              className="w-full"
            >
              {busy ? "Сохраняем…" : "Сохранить задачу"}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteRecord({
  kind,
  id,
  after,
}: {
  kind: "project" | "task"
  id: string
  after: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const { refresh } = useWorkspace()
  const navigate = useNavigate()
  const label = kind === "project" ? "Удалить объект" : "Удалить задачу"
  async function remove() {
    setBusy(true)
    setError("")
    try {
      const { error: failure } = await supabase!.rpc(
        kind === "project" ? "delete_project" : "delete_task",
        { p_id: id }
      )
      if (failure) throw failure
      await refresh()
      setOpen(false)
      navigate(after)
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
      <DialogTrigger
        render={<Button variant="ghost" className="text-destructive" />}
      >
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}?</DialogTitle>
          <DialogDescription>
            {kind === "project"
              ? "Объект и все его задачи исчезнут из списков. История сохранится в базе."
              : "Задача исчезнет из списков. История сохранится в базе."}{" "}
            Восстановление через интерфейс недоступно.
          </DialogDescription>
        </DialogHeader>
        <ErrorNotice>{error}</ErrorNotice>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Отмена
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? "Удаляем…" : label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
