-- Private feed state; competition results and scoring remain unchanged.
create table private.bingo_activity_events (
  event_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_key text not null,
  activity_type text not null check (activity_type in ('bingo_cell','bingo_row','bingo_full')),
  cell_index integer check (cell_index between 0 and 24),
  result_date date not null check (result_date between date '2026-10-05' and date '2026-10-11'),
  event_at timestamptz not null,
  is_active boolean not null default true,
  unique (user_id, activity_key)
);
alter table private.bingo_activity_events enable row level security;
revoke all on private.bingo_activity_events from public, anon, authenticated;
revoke all on sequence private.bingo_activity_events_event_id_seq from public, anon, authenticated;
create index bingo_activity_events_feed_idx on private.bingo_activity_events(event_at desc,event_id desc) where is_active;

create function private.bingo_feed_achievements(cells jsonb)
returns table(activity_key text, activity_type text, cell_index integer, result_date date)
language sql immutable set search_path='' as $$
  with squares as (
    select key::integer as cell,value::date as day from jsonb_each_text(cells)
  ), score as (select private.bingo_score(cells) value)
  select 'cell:'||cell,'bingo_cell',cell,day from squares
  union all
  select 'row:'||line,'bingo_row',null::integer,
    (select max(day) from squares where cell/5=line::integer)
  from score cross join lateral jsonb_array_elements_text(value->'rows') r(line)
  union all
  select 'column:'||line,'bingo_row',null::integer,
    (select max(day) from squares where cell%5=line::integer)
  from score cross join lateral jsonb_array_elements_text(value->'columns') c(line)
  union all
  select 'full','bingo_full',null::integer,(select max(day) from squares)
  from score where (value->>'full_board_points')::integer>0;
$$;
revoke all on function private.bingo_feed_achievements(jsonb) from public, anon, authenticated;

create function private.sync_bingo_activity(p_user uuid,p_cells jsonb,p_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  -- Keep the audit row but withdraw celebrations that an undo makes invalid.
  update private.bingo_activity_events e set is_active=false
  where e.user_id=p_user and e.is_active
    and not exists(select 1 from private.bingo_feed_achievements(p_cells) a where a.activity_key=e.activity_key);
  insert into private.bingo_activity_events(user_id,activity_key,activity_type,cell_index,result_date,event_at)
  select p_user,a.activity_key,a.activity_type,a.cell_index,a.result_date,p_at
  from private.bingo_feed_achievements(p_cells) a
  where not exists(select 1 from private.bingo_activity_events e where e.user_id=p_user and e.activity_key=a.activity_key and e.is_active)
  order by case a.activity_type when 'bingo_cell' then 0 when 'bingo_row' then 1 else 2 end,a.activity_key
  on conflict(user_id,activity_key) do update
  set is_active=true,result_date=excluded.result_date,event_at=excluded.event_at;
end;
$$;
revoke all on function private.sync_bingo_activity(uuid,jsonb,timestamptz) from public, anon, authenticated;

create function private.record_bingo_activity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not private.bingo_enabled() then return new; end if;
  if tg_op='UPDATE' then
    if old.completed_cells is not distinct from new.completed_cells then return new; end if;
  end if;
  perform private.sync_bingo_activity(new.user_id,new.completed_cells,new.updated_at);
  return new;
end;
$$;
revoke all on function private.record_bingo_activity() from public, anon, authenticated;
create trigger record_bingo_activity after insert or update of completed_cells on public.bingo_results
for each row execute function private.record_bingo_activity();

-- Preserve any already-completed squares without rewriting boards or points.
do $$ declare b record; begin
  if private.bingo_enabled() then
    for b in select user_id,completed_cells,updated_at from public.bingo_results where completed_cells<>'{}'::jsonb loop
      perform private.sync_bingo_activity(b.user_id,b.completed_cells,b.updated_at);
    end loop;
  end if;
end; $$;

create function private.get_competition_activity_feed(p_limit integer,p_offset integer)
returns table(display_name text,multiplier smallint,activity_type text,event_at timestamptz,result_date date,activity_label text)
language sql stable security definer set search_path='' as $$
  with events as (
    select e.user_id,e.multiplier,e.activity_type,e.event_at,e.result_date,
      null::text activity_label,e.event_id,0 source_order
    from public.daily_result_activity_events e
    where e.result_date between date '2026-10-01' and date '2026-10-31'
    union all
    select e.user_id,null::smallint,e.activity_type,e.event_at,e.result_date,
      case when e.activity_type='bingo_cell' then private.competition_bingo_board()->e.cell_index->>'description' else null end,
      e.event_id,1
    from private.bingo_activity_events e where e.is_active and private.bingo_enabled()
  )
  select p.display_name,e.multiplier,e.activity_type,e.event_at,e.result_date,e.activity_label
  from events e join public.profiles p on p.id=e.user_id
  where nullif(btrim(p.display_name),'') is not null
  order by e.event_at desc,e.source_order desc,e.event_id desc
  limit least(greatest(coalesce(p_limit,4),1),51)
  offset greatest(coalesce(p_offset,0),0);
$$;
revoke all on function private.get_competition_activity_feed(integer,integer) from public;
grant execute on function private.get_competition_activity_feed(integer,integer) to anon, authenticated;

-- Replace the RPC signature atomically to add the optional bingo label.
drop function public.get_activity_feed(integer,integer);
create function public.get_activity_feed(p_limit integer default 4,p_offset integer default 0)
returns table(display_name text,multiplier smallint,activity_type text,event_at timestamptz,result_date date,activity_label text)
language sql stable security invoker set search_path='' as $$
  select * from private.get_competition_activity_feed(p_limit,p_offset);
$$;
revoke all on function public.get_activity_feed(integer,integer) from public;
grant execute on function public.get_activity_feed(integer,integer) to anon, authenticated;
notify pgrst,'reload schema';
