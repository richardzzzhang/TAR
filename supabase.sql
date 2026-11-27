create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(btrim(text)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "Anyone can read messages" on public.messages;
create policy "Anyone can read messages"
  on public.messages for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can add messages" on public.messages;
create policy "Anyone can add messages"
  on public.messages for insert
  to anon, authenticated
  with check (char_length(btrim(text)) between 1 and 500);

grant select, insert on public.messages to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

notify pgrst, 'reload schema';
