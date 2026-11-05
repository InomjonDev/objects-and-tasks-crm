import assert from "node:assert/strict"
import { test } from "node:test"
import { parseStaffInput } from "./validation.ts"
const valid = {
  name: "  Jane Doe  ",
  email: " JANE@example.com ",
  password: "ValidPassword123!",
  role: "executor",
}
test("staff input normalizes identity fields and permits only the two roles", () => {
  assert.deepEqual(parseStaffInput(valid), {
    ...valid,
    name: "Jane Doe",
    email: "jane@example.com",
  })
  assert.equal(parseStaffInput({ ...valid, role: "manager" })?.role, "manager")
})
test("staff input rejects missing, malformed, oversized, and privileged values", () => {
  for (const input of [
    null,
    [],
    {},
    { ...valid, name: "\n\t" },
    { ...valid, name: "a".repeat(121) },
    { ...valid, email: "bad@" },
    { ...valid, role: "admin" },
    { ...valid, password: "short" },
    { ...valid, password: "a".repeat(73) },
    { ...valid, password: "я".repeat(37) },
  ])
    assert.equal(parseStaffInput(input), null)
  assert.ok(parseStaffInput({ ...valid, password: "a".repeat(72) }))
})
