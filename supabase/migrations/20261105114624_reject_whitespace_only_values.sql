-- Nonblank means more than spaces, tabs, or line breaks, including direct API calls.
alter table public.profiles add constraint profiles_name_nonblank check (display_name ~ '[^[:space:]]');
alter table public.projects add constraint projects_name_nonblank check (name ~ '[^[:space:]]');
alter table public.projects add constraint projects_address_nonblank check (address ~ '[^[:space:]]');
alter table public.tasks add constraint tasks_title_nonblank check (title ~ '[^[:space:]]');
alter table public.task_history add constraint revision_comment_nonblank
  check (to_status <> 'needs_revision' or (comment is not null and comment ~ '[^[:space:]]'));
