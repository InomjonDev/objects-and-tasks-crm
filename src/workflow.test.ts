import assert from "node:assert/strict"
import { test } from "node:test"
import { availableTransitions, statuses } from "./workflow.ts"

test("executor actions match the workflow and require assignment", () => {
  const expected = {
    new: ["in_progress"],
    in_progress: ["in_review"],
    in_review: [],
    accepted: [],
    needs_revision: ["in_progress"],
  }
  for (const status of Object.keys(statuses) as (keyof typeof statuses)[]) {
    assert.deepEqual(
      availableTransitions(status, "executor", true),
      expected[status]
    )
    assert.deepEqual(availableTransitions(status, "executor", false), [])
  }
})
test("managers can only review submitted work", () => {
  for (const status of Object.keys(statuses) as (keyof typeof statuses)[]) {
    assert.deepEqual(
      availableTransitions(status, "manager", false),
      status === "in_review" ? ["accepted", "needs_revision"] : []
    )
  }
})
