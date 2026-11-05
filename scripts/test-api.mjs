import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const demo = JSON.parse(readFileSync(".local/demo-accounts.json", "utf8"))
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY
assert.equal(url, demo.url, "Test credentials must match the target project")
assert.ok(key, "SUPABASE_PUBLISHABLE_KEY is required")
const makeClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
const users = []
for (const user of demo.users) {
  const client = makeClient()
  assert.equal(
    (
      await client.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      })
    ).error,
    null
  )
  users.push(client)
}
const [manager, executor, other] = users
let checks = 0
const ok = (result) => {
  assert.equal(result.error, null, result.error?.message)
  checks++
  return result.data
}
const denied = (result) => {
  assert.ok(result.error, "The API accepted a forbidden operation")
  checks++
}
const project = ok(
  await manager.rpc("save_project", {
    p_id: null,
    p_name: "Проверка API",
    p_address: "Тестовые данные",
  })
)
let task
try {
  task = ok(
    await manager.rpc("save_task", {
      p_id: null,
      p_title: "Проверка доступа",
      p_description: "",
      p_project_id: project,
      p_assignee_id: demo.users[1].id,
    })
  )
  const secondTask = ok(
    await manager.rpc("save_task", {
      p_id: null,
      p_title: "Чужая задача",
      p_description: "",
      p_project_id: project,
      p_assignee_id: demo.users[2].id,
    })
  )
  const anonymous = makeClient()
  denied(await anonymous.from("tasks").select("*"))
  denied(await manager.schema("private").rpc("is_manager"))
  denied(
    await anonymous.rpc("save_project", {
      p_id: null,
      p_name: "Forbidden",
      p_address: "Forbidden",
    })
  )
  denied(
    await anonymous.auth.signUp({
      email: `blocked.${Date.now()}@example.com`,
      password: "BlockedSignup123!",
    })
  )
  assert.deepEqual(ok(await other.from("tasks").select("*").eq("id", task)), [])
  assert.deepEqual(
    ok(await other.from("task_history").select("*").eq("task_id", task)),
    []
  )
  const visible = ok(
    await executor.from("tasks").select("id").eq("project_id", project)
  )
  assert.deepEqual(
    visible.map((row) => row.id),
    [task]
  )
  denied(
    await executor.from("tasks").update({ title: "Forged" }).eq("id", task)
  )
  denied(
    await manager.from("tasks").update({ status: "accepted" }).eq("id", task)
  )
  denied(await executor.from("tasks").delete().eq("id", task))
  denied(
    await executor
      .from("profiles")
      .update({ role: "manager" })
      .eq("id", demo.users[1].id)
  )
  denied(
    await executor.rpc("save_project", {
      p_id: null,
      p_name: "Forbidden",
      p_address: "Forbidden",
    })
  )
  denied(
    await executor.rpc("save_task", {
      p_id: task,
      p_title: "Forged",
      p_description: "",
      p_project_id: project,
      p_assignee_id: demo.users[2].id,
    })
  )
  denied(await executor.rpc("delete_task", { p_id: secondTask }))
  denied(
    await manager
      .from("task_history")
      .insert({
        task_id: task,
        actor_id: demo.users[0].id,
        to_status: "accepted",
      })
  )
  denied(
    await manager
      .from("task_history")
      .update({ comment: "Forged" })
      .eq("task_id", task)
  )
  denied(await executor.from("task_history").delete().eq("task_id", task))
  const transition = (client, from, next, comment = null) =>
    client.rpc("transition_task", {
      p_task_id: task,
      p_expected_status: from,
      p_next_status: next,
      p_comment: comment,
    })
  denied(await transition(manager, "new", "in_progress"))
  denied(await transition(other, "new", "in_progress"))
  denied(await transition(executor, "new", "accepted"))
  const concurrent = await Promise.all([
    transition(executor, "new", "in_progress"),
    transition(executor, "new", "in_progress"),
  ])
  assert.equal(concurrent.filter((result) => !result.error).length, 1)
  checks++
  assert.equal(concurrent.filter((result) => result.error).length, 1)
  checks++
  ok(await transition(executor, "in_progress", "in_review"))
  denied(await transition(manager, "in_review", "needs_revision", "  "))
  denied(await transition(manager, "in_review", "needs_revision", "\n\t"))
  ok(
    await transition(
      manager,
      "in_review",
      "needs_revision",
      "Исправить крепление"
    )
  )
  ok(await transition(executor, "needs_revision", "in_progress"))
  ok(await transition(executor, "in_progress", "in_review"))
  ok(await transition(manager, "in_review", "accepted"))
  denied(await transition(executor, "accepted", "in_progress"))
  const history = ok(
    await manager
      .from("task_history")
      .select("*")
      .eq("task_id", task)
      .order("created_at")
  )
  assert.equal(history.length, 7)
  assert.equal(history[0].from_status, null)
  assert.equal(history[0].actor_id, demo.users[0].id)
  assert.equal(history[1].actor_id, demo.users[1].id)
  assert.equal(history[3].comment, "Исправить крепление")
  assert.ok(history.every((row) => row.created_at))
  const before = ok(
    await manager.from("tasks").select("*").eq("id", task).single()
  )
  ok(
    await manager.rpc("save_task", {
      p_id: task,
      p_title: "Переназначенная задача",
      p_description: "Новое описание",
      p_project_id: project,
      p_assignee_id: demo.users[2].id,
    })
  )
  assert.deepEqual(
    ok(await executor.from("tasks").select("*").eq("id", task)),
    []
  )
  assert.deepEqual(
    ok(await executor.from("task_history").select("*").eq("task_id", task)),
    []
  )
  const after = ok(
    await other.from("tasks").select("*").eq("id", task).single()
  )
  for (const field of ["status", "author_id", "created_at"])
    assert.equal(after[field], before[field])
  assert.equal(
    ok(await other.from("task_history").select("id").eq("task_id", task))
      .length,
    7
  )
  ok(await manager.rpc("delete_task", { p_id: task }))
  assert.deepEqual(ok(await other.from("tasks").select("*").eq("id", task)), [])
  ok(await manager.rpc("delete_project", { p_id: project }))
  assert.deepEqual(
    ok(await other.from("tasks").select("*").eq("id", secondTask)),
    []
  )
  assert.deepEqual(
    ok(await other.from("projects").select("*").eq("id", project)),
    []
  )
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
    assert.equal(
      ok(await admin.from("task_history").select("id").eq("task_id", task))
        .length,
      7
    )
    assert.ok(
      ok(
        await admin
          .from("tasks")
          .select("deleted_at")
          .eq("id", secondTask)
          .single()
      ).deleted_at
    )
  }
  console.log(
    `Direct API checks passed: ${checks}. Test fixtures were soft-deleted; demo tasks are unchanged.`
  )
} finally {
  const remaining = await manager
    .from("projects")
    .select("id")
    .eq("id", project)
  if (remaining.data?.length)
    ok(await manager.rpc("delete_project", { p_id: project }))
  await Promise.all(
    users.map((client) => client.auth.signOut({ scope: "local" }))
  )
}
