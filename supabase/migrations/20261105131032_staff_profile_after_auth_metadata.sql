-- Auth can assign app_metadata after INSERT; handle that update without changing existing roles or names.
create or replace function private.create_staff_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data ->> 'crm_role' is not null
    and not exists(select 1 from public.profiles where id = new.id) then
    insert into public.profiles(id, display_name, role)
      values (new.id, new.raw_app_meta_data ->> 'crm_display_name', (new.raw_app_meta_data ->> 'crm_role')::public.app_role);
  end if;
  return new;
end;
$$;
drop trigger create_staff_profile on auth.users;
create trigger create_staff_profile after insert or update of raw_app_meta_data on auth.users
  for each row execute function private.create_staff_profile();
