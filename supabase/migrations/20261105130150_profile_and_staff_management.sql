create function private.update_profile(p_display_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Необходим вход' using errcode = '42501'; end if;
  update public.profiles set display_name = btrim(p_display_name) where id = auth.uid();
  if not found then raise exception 'Профиль не найден.' using errcode = 'P0002'; end if;
end;
$$;
create function public.update_profile(p_display_name text) returns void
language sql security invoker set search_path = '' as $$ select private.update_profile(p_display_name); $$;

create function private.list_staff() returns table(id uuid, display_name text, role public.app_role, email text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_manager();
  return query select p.id, p.display_name, p.role, u.email::text, u.created_at
    from public.profiles p join auth.users u on u.id = p.id order by p.display_name;
end;
$$;
create function public.list_staff() returns table(id uuid, display_name text, role public.app_role, email text, created_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.list_staff(); $$;

-- App metadata is admin-only. The Auth transaction rolls back if profile insertion fails.
create function private.create_staff_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data ->> 'crm_role' is not null then
    insert into public.profiles(id, display_name, role)
      values (new.id, new.raw_app_meta_data ->> 'crm_display_name', (new.raw_app_meta_data ->> 'crm_role')::public.app_role);
  end if;
  return new;
end;
$$;
create trigger create_staff_profile after insert on auth.users
  for each row execute function private.create_staff_profile();

revoke all on function private.create_staff_profile() from public, anon, authenticated;
revoke all on function private.update_profile(text), private.list_staff(), public.update_profile(text), public.list_staff() from public, anon, authenticated;
grant execute on function private.update_profile(text), private.list_staff(), public.update_profile(text), public.list_staff() to authenticated;
