create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'PARTY WITH DJ',
  status text not null default 'WAITING'
    check (status in ('WAITING','LIVE','PAUSED','ENDED')),
  buzzer_active boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_name text not null,
  college_name text not null,
  joined_at timestamptz not null default now(),
  active boolean not null default true
);

create table if not exists public.buzzes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  position integer not null,
  buzzed_at timestamptz not null default now(),
  unique(event_id, position),
  unique(event_id, participant_id)
);

create index if not exists participants_event_idx on public.participants(event_id);
create index if not exists buzzes_event_idx on public.buzzes(event_id);
create index if not exists buzzes_position_idx on public.buzzes(event_id, position);

create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at
before update on public.events
for each row execute function public.update_updated_at();

create or replace function public.register_buzz(
  p_event_id uuid,
  p_participant_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_position integer;
  v_buzz public.buzzes;
begin
  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.status <> 'LIVE' then raise exception 'EVENT_NOT_LIVE'; end if;
  if not v_event.buzzer_active then raise exception 'BUZZER_CLOSED'; end if;

  if not exists (
    select 1 from public.participants
    where id = p_participant_id
      and event_id = p_event_id
      and active = true
  ) then
    raise exception 'PARTICIPANT_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.buzzes
    where event_id = p_event_id
      and participant_id = p_participant_id
  ) then
    raise exception 'ALREADY_BUZZED';
  end if;

  select coalesce(max(position), 0) + 1
  into v_position
  from public.buzzes
  where event_id = p_event_id;

  insert into public.buzzes(event_id, participant_id, position)
  values(p_event_id, p_participant_id, v_position)
  returning * into v_buzz;

  update public.events
  set buzzer_active = false
  where id = p_event_id;

  return json_build_object(
    'success', true,
    'buzz_id', v_buzz.id,
    'position', v_buzz.position,
    'buzzed_at', v_buzz.buzzed_at,
    'participant_id', v_buzz.participant_id
  );
end;
$$;

alter table public.events replica identity full;
alter table public.participants replica identity full;
alter table public.buzzes replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.participants;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.buzzes;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.buzzes enable row level security;

drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
on public.events for select using (true);

drop policy if exists "Public can read participants" on public.participants;
create policy "Public can read participants"
on public.participants for select using (true);

drop policy if exists "Public can join event" on public.participants;
create policy "Public can join event"
on public.participants for insert with check (true);

drop policy if exists "Public can read buzzes" on public.buzzes;
create policy "Public can read buzzes"
on public.buzzes for select using (true);

insert into public.events(name)
select 'PARTY WITH DJ'
where not exists (select 1 from public.events);
