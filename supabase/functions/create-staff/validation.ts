export function parseStaffInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const body = input as Record<string, unknown>
  if (
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  )
    return null
  const name = body.name.trim()
  const email = body.email.trim().toLowerCase()
  if (
    !name ||
    name.length > 120 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return null
  if (body.role !== "manager" && body.role !== "executor") return null
  if (
    body.password.length < 10 ||
    new TextEncoder().encode(body.password).length > 72
  )
    return null
  return { name, email, password: body.password, role: body.role }
}
