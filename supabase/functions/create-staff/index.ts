import { createClient } from "npm:@supabase/supabase-js@2.81.1"
import { parseStaffInput } from "./validation.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors })

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors })
  if (request.method !== "POST")
    return reply({ error: "method_not_allowed" }, 405)
  const authorization = request.headers.get("Authorization")
  if (!authorization?.startsWith("Bearer "))
    return reply({ error: "unauthorized" }, 401)
  try {
    const url = Deno.env.get("SUPABASE_URL")!
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    // Verify the user with Auth, then read the authoritative database role on every request.
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(authorization.slice(7))
    if (authError || !user) return reply({ error: "unauthorized" }, 401)
    const { data: caller, error: roleError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (roleError || caller?.role !== "manager")
      return reply({ error: "forbidden" }, 403)
    const raw = await request.text()
    if (raw.length > 4096) return reply({ error: "invalid_input" }, 400)
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return reply({ error: "invalid_input" }, 400)
    }
    const input = parseStaffInput(body)
    if (!input) return reply({ error: "invalid_input" }, 400)
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { crm_role: input.role, crm_display_name: input.name },
    })
    if (error)
      return reply(
        {
          error:
            error.code === "email_exists" ? "email_exists" : "invalid_input",
        },
        error.code === "email_exists" ? 409 : 400
      )
    return reply(
      {
        user: { id: data.user.id, display_name: input.name, role: input.role },
      },
      201
    )
  } catch {
    return reply({ error: "service_unavailable" }, 503)
  }
})
