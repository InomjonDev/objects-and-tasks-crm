import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY
if (!url || !key || !publicKey)
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PUBLISHABLE_KEY in .env.admin"
  )
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const credentialsPath = ".local/demo-accounts.json"
mkdirSync(".local", { recursive: true, mode: 0o700 })
const demo = existsSync(credentialsPath)
  ? JSON.parse(readFileSync(credentialsPath, "utf8"))
  : { url, users: [], projects: [], tasks: [] }
if (demo.url !== url)
  throw new Error(
    "Existing demo credentials belong to another project. Move the file before provisioning another project."
  )
function save() {
  writeFileSync(credentialsPath, JSON.stringify(demo, null, 2), { mode: 0o600 })
}
function unwrap({ data, error }) {
  if (error) throw error
  return data
}
const people = [
  { role: "manager", name: "Анна Смирнова", login: "manager" },
  { role: "executor", name: "Иван Петров", login: "executor1" },
  { role: "executor", name: "Мария Соколова", login: "executor2" },
]
for (const person of people) {
  let user = demo.users.find((record) => record.login === person.login)
  if (!user) {
    const email = `${person.login}.${randomBytes(4).toString("hex")}@example.com`
    const password = `${randomBytes(18).toString("base64url")}!a9`
    const data = unwrap(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: person.name },
      })
    )
    user = { ...person, id: data.user.id, email, password }
    demo.users.push(user)
    save()
  }
  unwrap(
    await admin
      .from("profiles")
      .upsert({ id: user.id, display_name: person.name, role: person.role })
  )
}
const clients = []
for (const user of demo.users) {
  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  unwrap(
    await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    })
  )
  clients.push(client)
}
const manager = clients[0]
const sites = [
  ["ЖК «Солнечный»", "Ташкент, ул. Паркентская, 124"],
  ["Бизнес-центр «Вектор»", "Ташкент, проспект Амира Темура, 68"],
  ["Школа № 42", "Ташкент, ул. Фархадская, 17"],
]
for (const [index, [name, address]] of sites.entries()) {
  if (!demo.projects[index]) {
    demo.projects[index] = unwrap(
      await manager.rpc("save_project", {
        p_id: null,
        p_name: name,
        p_address: address,
      })
    )
    save()
  }
}
const jobs = [
  [
    "Проверить армирование перекрытия",
    "Сверить шаг арматуры с проектом. Проверить защитный слой бетона.",
    0,
    1,
    "new",
  ],
  [
    "Подготовить площадку к заливке",
    "Убрать строительный мусор и проверить опалубку перед бетонированием.",
    0,
    2,
    "in_progress",
  ],
  [
    "Проверить монтаж окон",
    "Проверить герметичность примыканий на втором этаже.",
    0,
    1,
    "in_review",
  ],
  [
    "Устранить замечания по кладке",
    "Проверить вертикальность перегородок и заполнение швов.",
    1,
    2,
    "needs_revision",
  ],
  [
    "Согласовать разводку электрики",
    "Сверить расположение розеток с утверждённым планом помещений.",
    1,
    1,
    "accepted",
  ],
  [
    "Принять поставку материалов",
    "Проверить количество и состояние упаковки по накладной.",
    1,
    2,
    "new",
  ],
  [
    "Подготовить стены к покраске",
    "Проверить ровность основания и нанести грунтовку.",
    2,
    1,
    "in_progress",
  ],
  [
    "Проверить освещение классов",
    "Проверить работу всех светильников на первом этаже.",
    2,
    2,
    "accepted",
  ],
]
for (const [
  index,
  [title, description, site, executor, target],
] of jobs.entries()) {
  let id = demo.tasks[index]
  if (!id)
    id = unwrap(
      await manager.rpc("save_task", {
        p_id: null,
        p_title: title,
        p_description: description,
        p_project_id: demo.projects[site],
        p_assignee_id: demo.users[executor].id,
      })
    )
  // Save immediately so a failed provisioning run never creates a duplicate task on retry.
  demo.tasks[index] = id
  save()
  let status = unwrap(
    await manager.from("tasks").select("status").eq("id", id).single()
  ).status
  if (status === target) continue
  const advance = async (client, next, comment = null) => {
    unwrap(
      await client.rpc("transition_task", {
        p_task_id: id,
        p_expected_status: status,
        p_next_status: next,
        p_comment: comment,
      })
    )
    status = next
  }
  if (status === "new" && target !== "new")
    await advance(clients[executor], "in_progress")
  if (
    status === "in_progress" &&
    ["in_review", "needs_revision", "accepted"].includes(target)
  )
    await advance(clients[executor], "in_review")
  if (status === "in_review" && target === "needs_revision")
    await advance(
      manager,
      "needs_revision",
      "Заполнить швы у дверного проёма и повторно проверить вертикальность."
    )
  if (status === "in_review" && target === "accepted")
    await advance(manager, "accepted", "Проверено на объекте. Замечаний нет.")
}
await Promise.all(
  clients.map((client) => client.auth.signOut({ scope: "local" }))
)
console.log(
  `Demo users and data are ready. Private credentials: ${credentialsPath}`
)
