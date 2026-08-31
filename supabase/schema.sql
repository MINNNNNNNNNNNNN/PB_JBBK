create extension if not exists pgcrypto;

create table if not exists public.lottery_rooms (
  slug text primary key,
  remaining_count integer not null check (remaining_count >= 0),
  remaining_wins integer not null check (remaining_wins >= 0 and remaining_wins <= remaining_count),
  is_drawing boolean not null default false,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.lottery_decks (
  room_slug text primary key references public.lottery_rooms(slug) on delete cascade,
  deck jsonb not null default '[]'::jsonb,
  draw_token uuid,
  draw_expires_at timestamptz
);

alter table public.lottery_rooms enable row level security;
alter table public.lottery_decks enable row level security;

drop policy if exists lottery_rooms_read on public.lottery_rooms;
create policy lottery_rooms_read
  on public.lottery_rooms
  for select
  to anon, authenticated
  using (true);

revoke all on public.lottery_decks from public, anon, authenticated;
revoke insert, update, delete on public.lottery_rooms from anon, authenticated;
grant select on public.lottery_rooms to anon, authenticated;

insert into public.lottery_rooms (slug, remaining_count, remaining_wins, is_drawing, version)
values ('main', 100, 2, false, 0)
on conflict (slug) do nothing;

insert into public.lottery_decks (room_slug, deck)
select
  'main',
  (
    select jsonb_agg(ticket order by random())
    from (
      select 'WIN'::text as ticket from generate_series(1, 2)
      union all
      select 'BLANK'::text as ticket from generate_series(1, 98)
    ) seeded
  )
where not exists (select 1 from public.lottery_decks where room_slug = 'main');

create or replace function public.draw_ticket(room_slug text)
returns table (
  result text,
  remaining_count integer,
  remaining_wins integer,
  is_drawing boolean,
  version bigint,
  draw_token uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck jsonb;
  v_token uuid;
  v_expires timestamptz;
  v_result text;
  v_count integer;
  v_wins integer;
  v_version bigint;
begin
  select d.deck, d.draw_token, d.draw_expires_at
    into v_deck, v_token, v_expires
  from public.lottery_decks d
  where d.room_slug = draw_ticket.room_slug
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select r.remaining_count, r.remaining_wins, r.version
    into v_count, v_wins, v_version
  from public.lottery_rooms r
  where r.slug = draw_ticket.room_slug
  for update;

  if v_token is not null and v_expires is not null and v_expires > now() then
    raise exception 'DRAW_IN_PROGRESS';
  end if;

  if jsonb_array_length(v_deck) = 0 then
    update public.lottery_decks
      set draw_token = null, draw_expires_at = null
      where public.lottery_decks.room_slug = draw_ticket.room_slug;
    update public.lottery_rooms
      set is_drawing = false, updated_at = now()
      where slug = draw_ticket.room_slug;
    raise exception 'EMPTY_DECK';
  end if;

  v_result := v_deck ->> 0;
  v_deck := v_deck - 0;
  v_count := greatest(0, v_count - 1);
  if v_result = 'WIN' then
    v_wins := greatest(0, v_wins - 1);
  end if;
  v_token := gen_random_uuid();
  v_expires := now() + interval '15 seconds';
  v_version := v_version + 1;

  update public.lottery_decks
    set deck = v_deck,
        draw_token = v_token,
        draw_expires_at = v_expires
    where public.lottery_decks.room_slug = draw_ticket.room_slug;

  update public.lottery_rooms
    set remaining_count = v_count,
        remaining_wins = v_wins,
        is_drawing = true,
        version = v_version,
        updated_at = now()
    where slug = draw_ticket.room_slug;

  return query select v_result, v_count, v_wins, true, v_version, v_token;
end;
$$;

create or replace function public.confirm_draw(room_slug text, draw_token uuid)
returns table (
  remaining_count integer,
  remaining_wins integer,
  is_drawing boolean,
  version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_count integer;
  v_wins integer;
  v_version bigint;
begin
  select d.draw_token
    into v_token
  from public.lottery_decks d
  where d.room_slug = confirm_draw.room_slug
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_token is null or v_token <> confirm_draw.draw_token then
    raise exception 'INVALID_DRAW_TOKEN';
  end if;

  select r.remaining_count, r.remaining_wins, r.version
    into v_count, v_wins, v_version
  from public.lottery_rooms r
  where r.slug = confirm_draw.room_slug
  for update;

  v_version := v_version + 1;

  update public.lottery_decks
    set draw_token = null,
        draw_expires_at = null
    where public.lottery_decks.room_slug = confirm_draw.room_slug;

  update public.lottery_rooms
    set is_drawing = false,
        version = v_version,
        updated_at = now()
    where slug = confirm_draw.room_slug;

  return query select v_count, v_wins, false, v_version;
end;
$$;

create or replace function public.add_tickets(room_slug text, add_wins integer, add_blanks integer)
returns table (
  remaining_count integer,
  remaining_wins integer,
  is_drawing boolean,
  version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck jsonb;
  v_token uuid;
  v_expires timestamptz;
  v_count integer;
  v_wins integer;
  v_version bigint;
  v_added jsonb;
  v_combined jsonb;
  v_shuffled jsonb;
begin
  if add_wins < 0 or add_blanks < 0 or add_wins + add_blanks <= 0 then
    raise exception 'INVALID_ADD_COUNT';
  end if;
  if add_wins > 999 or add_blanks > 9999 then
    raise exception 'ADD_LIMIT_EXCEEDED';
  end if;

  select d.deck, d.draw_token, d.draw_expires_at
    into v_deck, v_token, v_expires
  from public.lottery_decks d
  where d.room_slug = add_tickets.room_slug
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  select r.remaining_count, r.remaining_wins, r.version
    into v_count, v_wins, v_version
  from public.lottery_rooms r
  where r.slug = add_tickets.room_slug
  for update;

  if v_token is not null and v_expires is not null and v_expires > now() then
    raise exception 'DRAW_IN_PROGRESS';
  end if;

  select coalesce(jsonb_agg(ticket), '[]'::jsonb)
    into v_added
  from (
    select 'WIN'::text as ticket from generate_series(1, add_wins)
    union all
    select 'BLANK'::text as ticket from generate_series(1, add_blanks)
  ) additions;

  v_combined := v_deck || v_added;
  select coalesce(jsonb_agg(value order by random()), '[]'::jsonb)
    into v_shuffled
  from jsonb_array_elements(v_combined);

  v_count := v_count + add_wins + add_blanks;
  v_wins := v_wins + add_wins;
  v_version := v_version + 1;

  update public.lottery_decks
    set deck = v_shuffled,
        draw_token = null,
        draw_expires_at = null
    where public.lottery_decks.room_slug = add_tickets.room_slug;

  update public.lottery_rooms
    set remaining_count = v_count,
        remaining_wins = v_wins,
        is_drawing = false,
        version = v_version,
        updated_at = now()
    where slug = add_tickets.room_slug;

  return query select v_count, v_wins, false, v_version;
end;
$$;

revoke all on function public.draw_ticket(text) from public;
revoke all on function public.confirm_draw(text, uuid) from public;
revoke all on function public.add_tickets(text, integer, integer) from public;

grant execute on function public.draw_ticket(text) to anon, authenticated;
grant execute on function public.confirm_draw(text, uuid) to anon, authenticated;
grant execute on function public.add_tickets(text, integer, integer) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lottery_rooms'
  ) then
    alter publication supabase_realtime add table public.lottery_rooms;
  end if;
end $$;
