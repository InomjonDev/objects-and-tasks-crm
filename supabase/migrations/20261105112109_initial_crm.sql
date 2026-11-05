create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.app_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'in_review', 'accepted', 'needs_revision');

create table public.profiles (
  id uuid primary key references auth.users(id),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  role public.app_role not null
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  address text not null check (length(btrim(address)) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  project_id uuid not null references public.projects(id),
  assignee_id uuid not null references public.profiles(id),
  status public.task_status not null default 'new',
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  from_status public.task_status,
  to_status public.task_status not null,
  comment text check (length(comment) <= 2000)
);
create index tasks_project_active_idx on public.tasks(project_id) where deleted_at is null;
create index tasks_assignee_active_idx on public.tasks(assignee_id) where deleted_at is null;
create index task_history_task_idx on public.task_history(task_id, created_at);

create function private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;
create function private.can_read_task(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t join public.projects p on p.id = t.project_id
    where t.id = p_id and t.deleted_at is null and p.deleted_at is null
      and (private.is_manager() or t.assignee_id = auth.uid())
  );
$$;
create function private.can_read_project(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p where p.id = p_id and p.deleted_at is null
    and (private.is_manager() or exists (
      select 1 from public.tasks t where t.project_id = p.id
        and t.deleted_at is null and t.assignee_id = auth.uid()
    ))
  );
$$;
create function private.can_read_profile(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_id = auth.uid() or private.is_manager()
    or exists (select 1 from public.tasks t where (t.author_id = p_id or t.assignee_id = p_id) and private.can_read_task(t.id))
    or exists (select 1 from public.task_history h where h.actor_id = p_id and private.can_read_task(h.task_id))
  );
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (private.can_read_profile(id));
create policy projects_read on public.projects for select to authenticated using (private.can_read_project(id));
create policy tasks_read on public.tasks for select to authenticated using (private.can_read_task(id));
create policy history_read on public.task_history for select to authenticated using (private.can_read_task(task_id));

create function private.require_manager() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_manager() then
    raise exception 'Действие доступно только постановщику' using errcode = '42501';
  end if;
end;
$$;
create function private.save_project(p_id uuid, p_name text, p_address text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.require_manager();
  if p_id is null then
    insert into public.projects(name, address) values (btrim(p_name), btrim(p_address)) returning id into result;
  else
    update public.projects set name = btrim(p_name), address = btrim(p_address)
      where id = p_id and deleted_at is null returning id into result;
    if result is null then raise exception 'Объект не найден' using errcode = 'P0002'; end if;
  end if;
  return result;
end;
$$;
create function private.save_task(p_id uuid, p_title text, p_description text, p_project_id uuid, p_assignee_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform private.require_manager();
  perform 1 from public.projects where id = p_project_id and deleted_at is null for update;
  if not found then raise exception 'Объект не найден' using errcode = 'P0002'; end if;
  if not exists(select 1 from public.profiles where id = p_assignee_id and role = 'executor') then
    raise exception 'Выберите исполнителя' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.tasks(title, description, project_id, assignee_id, author_id)
      values (btrim(p_title), coalesce(p_description, ''), p_project_id, p_assignee_id, auth.uid()) returning id into result;
    insert into public.task_history(task_id, actor_id, to_status) values (result, auth.uid(), 'new');
  else
    update public.tasks set title = btrim(p_title), description = coalesce(p_description, ''),
      project_id = p_project_id, assignee_id = p_assignee_id
      where id = p_id and deleted_at is null
        and exists(select 1 from public.projects p where p.id = tasks.project_id and p.deleted_at is null)
      returning id into result;
    if result is null then raise exception 'Задача не найдена' using errcode = 'P0002'; end if;
  end if;
  return result;
end;
$$;
create function private.delete_project(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  update public.projects set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then raise exception 'Объект не найден' using errcode = 'P0002'; end if;
  update public.tasks set deleted_at = now() where project_id = p_id and deleted_at is null;
end;
$$;
create function private.delete_task(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  update public.tasks set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then raise exception 'Задача не найдена' using errcode = 'P0002'; end if;
end;
$$;
create function private.transition_task(p_task_id uuid, p_expected_status public.task_status, p_next_status public.task_status, p_comment text) returns void
language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks; project uuid; permitted boolean;
begin
  if auth.uid() is null then raise exception 'Необходим вход' using errcode = '42501'; end if;
  select project_id into project from public.tasks where id = p_task_id;
  perform 1 from public.projects where id = project and deleted_at is null for update;
  if not found then raise exception 'Задача недоступна' using errcode = '42501'; end if;
  select * into current_task from public.tasks where id = p_task_id and project_id = project and deleted_at is null for update;
  if not found or not (private.is_manager() or current_task.assignee_id = auth.uid()) then
    raise exception 'Задача недоступна' using errcode = '42501';
  end if;
  if p_expected_status is distinct from current_task.status then
    raise exception 'Статус уже изменился. Обновите задачу' using errcode = '40001';
  end if;
  permitted := (
    current_task.assignee_id = auth.uid() and (
      (current_task.status in ('new', 'needs_revision') and p_next_status = 'in_progress')
      or (current_task.status = 'in_progress' and p_next_status = 'in_review')
    )
  ) or (private.is_manager() and current_task.status = 'in_review' and p_next_status in ('accepted', 'needs_revision'));
  if permitted is distinct from true then raise exception 'Переход статуса запрещён' using errcode = '42501'; end if;
  if p_next_status = 'needs_revision' and nullif(btrim(p_comment), '') is null then
    raise exception 'Укажите причину возврата' using errcode = '22023';
  end if;
  if length(p_comment) > 2000 then raise exception 'Комментарий не более 2000 символов' using errcode = '22023'; end if;
  update public.tasks set status = p_next_status where id = p_task_id;
  insert into public.task_history(task_id, actor_id, from_status, to_status, comment)
    values (p_task_id, auth.uid(), current_task.status, p_next_status, nullif(btrim(p_comment), ''));
end;
$$;

-- Only invoker wrappers are exposed to PostgREST; privileged code stays in private.
create function public.save_project(p_id uuid, p_name text, p_address text) returns uuid
language sql security invoker set search_path = '' as $$ select private.save_project(p_id, p_name, p_address); $$;
create function public.save_task(p_id uuid, p_title text, p_description text, p_project_id uuid, p_assignee_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.save_task(p_id, p_title, p_description, p_project_id, p_assignee_id); $$;
create function public.delete_project(p_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.delete_project(p_id); $$;
create function public.delete_task(p_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.delete_task(p_id); $$;
create function public.transition_task(p_task_id uuid, p_expected_status public.task_status, p_next_status public.task_status, p_comment text default null) returns void
language sql security invoker set search_path = '' as $$ select private.transition_task(p_task_id, p_expected_status, p_next_status, p_comment); $$;

revoke all on public.profiles, public.projects, public.tasks, public.task_history from anon, authenticated;
grant select on public.profiles, public.projects, public.tasks, public.task_history to authenticated;
grant all on public.profiles to service_role;
grant select on public.projects, public.tasks, public.task_history to service_role;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to authenticated;
revoke all on function public.save_project(uuid, text, text), public.save_task(uuid, text, text, uuid, uuid),
  public.delete_project(uuid), public.delete_task(uuid), public.transition_task(uuid, public.task_status, public.task_status, text) from public, anon, authenticated;
grant execute on function public.save_project(uuid, text, text), public.save_task(uuid, text, text, uuid, uuid),
  public.delete_project(uuid), public.delete_task(uuid), public.transition_task(uuid, public.task_status, public.task_status, text) to authenticated;
