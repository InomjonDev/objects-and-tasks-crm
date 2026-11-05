import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { createServer } from "node:net"

// An isolated disposable Postgres validates the real migration, grants, functions, and RLS.
const directory = mkdtempSync(join(tmpdir(), "forhh-db-"))
const pgBin =
  process.env.PG_BIN ??
  dirname(execFileSync("which", ["initdb"], { encoding: "utf8" }).trim())
const server = createServer()
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const port = server.address().port
await new Promise((resolve) => server.close(resolve))
const run = (name, args) =>
  execFileSync(join(pgBin, name), args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
let started = false
let checks = 0
const sql = (query, user, commit = false) => {
  const prefix = user
    ? `begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; `
    : ""
  return spawnSync(
    join(pgBin, "psql"),
    [
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      directory,
      "-p",
      String(port),
      "-d",
      "postgres",
      "-c",
      `${prefix}${query}${user ? (commit ? "; commit;" : "; rollback;") : ""}`,
    ],
    { encoding: "utf8" }
  )
}
function succeeds(query, user, commit = false) {
  const result = sql(query, user, commit)
  assert.equal(result.status, 0, result.stderr)
  checks++
  return result.stdout.trim()
}
function rejects(query, user) {
  const result = sql(query, user)
  assert.notEqual(result.status, 0, `Unexpected success: ${query}`)
  checks++
}
const manager = "10000000-0000-0000-0000-000000000001"
const executor = "10000000-0000-0000-0000-000000000002"
const other = "10000000-0000-0000-0000-000000000003"
const secondManager = "10000000-0000-0000-0000-000000000004"
const project = "20000000-0000-0000-0000-000000000001"
const hiddenProject = "20000000-0000-0000-0000-000000000002"
const states = ["new", "in_progress", "in_review", "accepted", "needs_revision"]
const taskId = (index) => `30000000-0000-0000-0000-00000000000${index + 1}`
try {
  run("initdb", [
    "-D",
    join(directory, "data"),
    "-A",
    "trust",
    "--no-locale",
    "-E",
    "UTF8",
  ])
  run("pg_ctl", [
    "-D",
    join(directory, "data"),
    "-l",
    join(directory, "postgres.log"),
    "-o",
    `-k ${directory} -p ${port} -h 127.0.0.1`,
    "-w",
    "start",
  ])
  started = true
  succeeds(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, created_at timestamptz not null default now(), raw_app_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;`)
  for (const file of readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    succeeds(readFileSync(`supabase/migrations/${file}`, "utf8"))
  }
  succeeds(`insert into auth.users(id) values ('${manager}'), ('${executor}'), ('${other}'), ('${secondManager}');
    insert into public.profiles values ('${manager}', 'Manager', 'manager'), ('${executor}', 'Executor A', 'executor'), ('${other}', 'Executor B', 'executor'), ('${secondManager}', 'Manager B', 'manager');
    insert into public.projects(id,name,address) values ('${project}', 'Shared', 'Address'), ('${hiddenProject}', 'Hidden', 'Address');
    ${states.map((status, index) => `insert into public.tasks(id,title,project_id,assignee_id,status,author_id) values ('${taskId(index)}','Task','${project}','${executor}','${status}','${manager}');`).join("\n")}
    insert into public.task_history(task_id,actor_id,to_status) values ('${taskId(0)}','${manager}','new');`)
  succeeds(
    `select public.update_profile('Updated name'); do $$ begin if (select display_name from public.profiles where id=auth.uid()) <> 'Updated name' then raise exception 'Profile not updated'; end if; if (select role from public.profiles where id=auth.uid()) <> 'executor' then raise exception 'Role changed'; end if; end $$`,
    executor
  )
  rejects(`select public.update_profile(' ')`, executor)
  rejects(`select public.update_profile(repeat('a',121))`, manager)
  rejects(`set role anon; select public.update_profile('Forged')`)
  assert.equal(
    succeeds(`select count(*) from public.list_staff()`, manager),
    "4"
  )
  rejects(`select * from public.list_staff()`, executor)
  rejects(`set role anon; select * from public.list_staff()`)
  succeeds(
    `begin; insert into auth.users(id,email,raw_app_meta_data) values ('10000000-0000-0000-0000-000000000005','new@example.com','{"crm_role":"executor","crm_display_name":"New staff"}'); do $$ begin if not exists(select 1 from public.profiles where id='10000000-0000-0000-0000-000000000005' and role='executor') then raise exception 'Staff profile missing'; end if; end $$; rollback;`
  )
  rejects(
    `insert into auth.users(id,raw_app_meta_data) values ('10000000-0000-0000-0000-000000000006','{"crm_role":"admin","crm_display_name":"Forged"}')`
  )
  assert.equal(
    succeeds(
      `select count(*) from auth.users where id='10000000-0000-0000-0000-000000000006'`
    ),
    "0"
  )
  succeeds(
    `begin; insert into auth.users(id) values ('10000000-0000-0000-0000-000000000007'); update auth.users set raw_app_meta_data='{"crm_role":"executor","crm_display_name":"Late metadata"}' where id='10000000-0000-0000-0000-000000000007'; do $$ begin if not exists(select 1 from public.profiles where id='10000000-0000-0000-0000-000000000007' and role='executor') then raise exception 'Late profile missing'; end if; end $$; update auth.users set raw_app_meta_data='{"crm_role":"manager","crm_display_name":"Do not reset"}' where id='10000000-0000-0000-0000-000000000007'; do $$ begin if not exists(select 1 from public.profiles where id='10000000-0000-0000-0000-000000000007' and role='executor' and display_name='Late metadata') then raise exception 'Existing role/name changed'; end if; end $$; rollback;`
  )
  for (const [index, from] of states.entries()) {
    for (const to of states) {
      for (const actor of [manager, executor, other, secondManager]) {
        const allowed =
          ((actor === manager || actor === secondManager) &&
            from === "in_review" &&
            ["accepted", "needs_revision"].includes(to)) ||
          (actor === executor &&
            ((["new", "needs_revision"].includes(from) &&
              to === "in_progress") ||
              (from === "in_progress" && to === "in_review")))
        const query = `select public.transition_task('${taskId(index)}','${from}','${to}','Исправить крепление')`
        if (allowed) succeeds(query, actor)
        else rejects(query, actor)
      }
    }
  }
  assert.equal(succeeds("select count(*) from public.tasks", executor), "5")
  assert.equal(succeeds("select count(*) from public.tasks", other), "0")
  assert.equal(succeeds("select count(*) from public.projects", executor), "1")
  assert.equal(succeeds("select count(*) from public.task_history", other), "0")
  assert.equal(succeeds("select count(*) from public.profiles", executor), "2")
  rejects(`set role anon; select * from public.tasks`)
  rejects(`set role anon; select public.save_project(null,'Forged','Address')`)
  rejects(`update public.tasks set title='Forged'`, executor)
  rejects(`update public.tasks set status='accepted'`, manager)
  rejects(
    `insert into public.tasks(title,project_id,assignee_id,author_id) values ('Forged','${project}','${executor}','${manager}')`,
    executor
  )
  rejects(
    `update public.profiles set role='manager' where id='${executor}'`,
    executor
  )
  rejects(
    `insert into public.task_history(task_id,actor_id,to_status) values ('${taskId(0)}','${manager}','accepted')`,
    manager
  )
  rejects(`update public.task_history set comment='Forged'`, manager)
  rejects(`delete from public.task_history`, executor)
  rejects(`select public.save_project(null,'Object','Address')`, executor)
  rejects(`select public.save_project(null,' ','Address')`, manager)
  rejects(`select public.save_project(null,E'\\n\\t','Address')`, manager)
  rejects(
    `select public.save_task(null,'Task','','${project}','${manager}')`,
    manager
  )
  rejects(
    `select public.transition_task('${taskId(2)}','in_review','needs_revision','  ')`,
    manager
  )
  rejects(
    `select public.transition_task('${taskId(2)}','in_review','needs_revision',E'\\n\\t')`,
    manager
  )
  rejects(
    `select public.transition_task('${taskId(0)}','in_progress','in_review',null)`,
    executor
  )
  rejects(
    `select public.transition_task('${taskId(0)}','new',null,null)`,
    executor
  )
  succeeds(
    `do $$ declare created uuid; begin created := public.save_task(null,'New task','','${project}','${executor}'); if (select count(*) from public.task_history where task_id=created and actor_id=auth.uid() and from_status is null and to_status='new') <> 1 then raise exception 'Creation history missing'; end if; end $$`,
    manager
  )
  succeeds(
    `select public.transition_task('${taskId(0)}','new','in_progress',null); do $$ begin if (select count(*) from public.task_history where task_id='${taskId(0)}') <> 2 then raise exception 'History missing'; end if; end $$`,
    executor
  )
  rejects(
    `select public.transition_task('${taskId(0)}','new','in_progress',null); select public.transition_task('${taskId(0)}','new','in_progress',null)`,
    executor
  )
  succeeds(
    `select public.save_task('${taskId(0)}','Reassigned','','${project}','${other}'); do $$ begin if (select status from public.tasks where id='${taskId(0)}') <> 'new' then raise exception 'Status reset'; end if; end $$`,
    manager,
    true
  )
  assert.equal(
    succeeds(
      `select count(*) from public.tasks where id='${taskId(0)}'`,
      executor
    ),
    "0"
  )
  assert.equal(
    succeeds(
      `select count(*) from public.task_history where task_id='${taskId(0)}'`,
      other
    ),
    "1"
  )
  succeeds(
    `select public.delete_project('${project}'); do $$ begin if exists(select 1 from public.tasks) then raise exception 'Deleted tasks visible'; end if; end $$`,
    manager,
    true
  )
  assert.equal(
    succeeds(`select count(*) from public.task_history`, manager),
    "0"
  )
  assert.equal(succeeds(`select count(*) from public.task_history`), "1")
  assert.equal(
    succeeds(`select count(*) from public.tasks where deleted_at is not null`),
    "5"
  )
  console.log(
    `Database checks passed: ${checks} (including 100 role/transition combinations).`
  )
} finally {
  if (started)
    run("pg_ctl", [
      "-D",
      join(directory, "data"),
      "-m",
      "immediate",
      "-w",
      "stop",
    ])
  rmSync(directory, { recursive: true, force: true })
}
