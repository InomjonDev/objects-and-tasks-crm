import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"
import { english, translate } from "./messages.ts"
import { statuses, actionLabels } from "./workflow.ts"

test("both languages preserve user data and translate every status/action", () => {
  for (const label of [
    ...Object.values(statuses),
    ...Object.values(actionLabels),
  ]) {
    assert.ok(english[label])
    assert.equal(translate(label, "en"), english[label])
    assert.equal(translate(label, "ru"), label)
  }
  assert.equal(translate("ЖК User Content", "en"), "ЖК User Content")
  assert.equal(translate("constructor", "en"), "constructor")
  assert.equal(translate("__proto__", "en"), "__proto__")
})
test("every literal UI translation has an English message and no untranslated UI text remains", () => {
  function inspect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        inspect(path)
        continue
      }
      if (!path.endsWith(".tsx")) continue
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      )
      function walk(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "t" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        )
          assert.ok(
            english[node.arguments[0].text],
            `${path}: ${node.arguments[0].text}`
          )
        if (ts.isJsxText(node)) {
          const text = node.text.trim()
          assert.ok(
            !/[А-Яа-яЁё]/.test(text) || ["О", "Русский"].includes(text),
            `${path}: untranslated ${text}`
          )
        }
        ts.forEachChild(node, walk)
      }
      walk(source)
    }
  }
  inspect("src")
})
