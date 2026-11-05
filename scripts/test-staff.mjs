import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
const demo = JSON.parse(readFileSync(".local/demo-accounts.json", "utf8"))
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY
assert.equal(url, demo.url)
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY)
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options)
const clients = []
const fixtures = []
let checks = 0
const ok = (result) => {
  assert.equal(result.error, null, result.error?.message)
  checks++
  return result.data
}
async function login(email, password) {
  const client = createClient(url, key, options)
  const data = ok(await client.auth.signInWithPassword({ email, password }))
  clients.push(client)
  return { client, token: data.session.access_token }
}
const manager = await login(demo.users[0].email, demo.users[0].password)
const executor = await login(demo.users[1].email, demo.users[1].password)
async function call(token, body, method = "POST") {
  const response = await fetch(`${url}/functions/v1/create-staff`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    ...(method === "POST"
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  })
  const data = response.status === 204 ? null : await response.json()
  return { status: response.status, data, headers: response.headers }
}
function status(result, expected) {
  assert.equal(result.status, expected, JSON.stringify(result.data))
  checks++
  return result.data
}
const marker = `staff-test-${randomBytes(6).toString("hex")}`
const valid = {
  name: "Staff test",
  email: `${marker}@example.com`,
  password: `${randomBytes(16).toString("base64url")}!A9`,
  role: "executor",
}
try {
  const preflight = await call(null, null, "OPTIONS")
  status(preflight, 204)
  assert.ok(
    preflight.headers
      .get("access-control-allow-headers")
      .includes("authorization")
  )
  status(await call(null, null, "GET"), 405)
  status(await call(null, valid), 401)
  status(await call("forged-token", valid), 401)
  status(await call(executor.token, valid), 403)
  for (const body of [
    "not-json",
    null,
    { ...valid, role: "admin" },
    { ...valid, name: "\n\t" },
    { ...valid, email: "bad-email" },
    { ...valid, password: "short" },
    { ...valid, password: "я".repeat(37) },
  ])
    status(await call(manager.token, body), 400)
  const created = status(await call(manager.token, valid), 201).user
  assert.ok(!demo.users.some((user) => user.id === created.id))
  fixtures.push({ id: created.id, email: valid.email })
  assert.deepEqual(Object.keys(created).sort(), ["display_name", "id", "role"])
  const staff = await login(valid.email, valid.password)
  const profile = ok(
    await staff.client
      .from("profiles")
      .select("*")
      .eq("id", created.id)
      .single()
  )
  assert.equal(profile.role, "executor")
  assert.equal(profile.display_name, valid.name)
  assert.ok(!("email" in profile))
  ok(
    await staff.client.rpc("update_profile", {
      p_display_name: "Updated staff name",
    })
  )
  assert.equal(
    ok(
      await staff.client
        .from("profiles")
        .select("display_name,role")
        .eq("id", created.id)
        .single()
    ).display_name,
    "Updated staff name"
  )
  assert.ok((await staff.client.rpc("list_staff")).error)
  checks++
  assert.ok(
    (
      await staff.client
        .from("profiles")
        .update({ role: "manager" })
        .eq("id", created.id)
    ).error
  )
  checks++
  ok(await staff.client.auth.updateUser({ data: { crm_role: "manager" } }))
  status(
    await call(staff.token, {
      ...valid,
      email: `${marker}-forged@example.com`,
    }),
    403
  )
  status(await call(manager.token, { ...valid, role: "manager" }), 409)
  assert.equal(
    ok(
      await staff.client
        .from("profiles")
        .select("role")
        .eq("id", created.id)
        .single()
    ).role,
    "executor"
  )
  const roster = ok(await manager.client.rpc("list_staff"))
  assert.ok(
    roster.some(
      (person) => person.id === created.id && person.email === valid.email
    )
  )
  const managerInput = {
    ...valid,
    email: `${marker}-manager@example.com`,
    name: "Second test manager",
    role: "manager",
  }
  const newManager = status(await call(manager.token, managerInput), 201).user
  assert.ok(!demo.users.some((user) => user.id === newManager.id))
  fixtures.push({ id: newManager.id, email: managerInput.email })
  const secondManager = await login(managerInput.email, managerInput.password)
  assert.ok(
    ok(await secondManager.client.rpc("list_staff")).some(
      (person) => person.id === newManager.id && person.role === "manager"
    )
  )
  console.log(
    `Staff and profile API checks passed: ${checks}. No existing demo identities were changed.`
  )
} finally {
  await Promise.all(
    clients.map((client) => client.auth.signOut({ scope: "local" }))
  )
  for (const fixture of fixtures) {
    const { user } = ok(await admin.auth.admin.getUserById(fixture.id))
    assert.equal(user.email, fixture.email)
    ok(await admin.from("profiles").delete().eq("id", fixture.id))
    ok(await admin.auth.admin.deleteUser(fixture.id))
  }
}
