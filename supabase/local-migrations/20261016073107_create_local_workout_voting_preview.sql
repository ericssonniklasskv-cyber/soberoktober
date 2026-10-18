-- LOCAL TEST ONLY. Intentionally outside supabase/migrations: never deploy this
-- preview clock or its admin reset RPC to production.
create table if not exists private.vote_preview_settings (
  singleton boolean primary key default true check(singleton),
  test_now timestamptz
);
insert into private.vote_preview_settings values(true,'2026-10-18 21:00:00+02') on conflict do nothing;
create table if not exists private.vote_preview_options (
  workout_date date not null check(workout_date between date '2026-10-19' and date '2026-10-25'),
  option_id integer not null check(option_id between 0 and 3),
  task jsonb not null,
  primary key(workout_date,option_id)
);
create table if not exists private.vote_preview_votes (
  workout_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id integer not null,
  voted_at timestamptz not null,
  primary key(workout_date,user_id),
  foreign key(workout_date,option_id) references private.vote_preview_options(workout_date,option_id)
);
create index if not exists vote_preview_votes_user_idx on private.vote_preview_votes(user_id);
create table if not exists private.vote_preview_results (
  workout_date date primary key,
  option_id integer not null,
  total_votes integer not null,
  tied_options integer not null,
  counts jsonb not null,
  resolved_at timestamptz not null,
  foreign key(workout_date,option_id) references private.vote_preview_options(workout_date,option_id)
);
alter table private.vote_preview_settings enable row level security;
alter table private.vote_preview_options enable row level security;
alter table private.vote_preview_votes enable row level security;
alter table private.vote_preview_results enable row level security;
revoke all on private.vote_preview_settings,private.vote_preview_options,private.vote_preview_votes,private.vote_preview_results from public,anon,authenticated;

with days(workout_date,cells) as (values
 ('2026-10-19'::date,array[9,10,15,17]),
 ('2026-10-20'::date,array[0,4,11,19]),
 ('2026-10-21'::date,array[1,7,14,18]),
 ('2026-10-22'::date,array[2,3,6,21]),
 ('2026-10-23'::date,array[4,9,13,22]),
 ('2026-10-24'::date,array[0,8,15,17]),
 ('2026-10-25'::date,array[3,10,19,24])
)
insert into private.vote_preview_options(workout_date,option_id,task)
select workout_date,ordinality-1,private.default_bingo_test_board()->cell
from days cross join lateral unnest(cells) with ordinality c(cell,ordinality)
on conflict do nothing;

create or replace function private.vote_preview_clock() returns timestamptz
language sql stable security invoker set search_path='' as $$
 select coalesce(test_now,statement_timestamp()) from private.vote_preview_settings where singleton;
$$;
create or replace function private.vote_preview_opens(workout_date date) returns timestamptz
language sql immutable security invoker set search_path='' as $$
 select case when workout_date=date '2026-10-19' then timestamptz '2026-10-18 21:00:00+02'
 else ((workout_date-1)::timestamp+interval '15 hours') at time zone 'Europe/Stockholm' end;
$$;
create or replace function private.vote_preview_settle(p_date date,p_instant timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare picked integer; top_count integer; tied integer; total integer; tallies jsonb;
begin
 if p_instant < (p_date::timestamp at time zone 'Europe/Stockholm') then return; end if;
 perform pg_advisory_xact_lock(260019,p_date-date '2026-01-01');
 if exists(select 1 from private.vote_preview_results where workout_date=p_date) then return; end if;
 select max(votes),sum(votes),jsonb_object_agg(option_id,votes) into top_count,total,tallies from (
  select o.option_id,count(v.user_id)::integer votes from private.vote_preview_options o
  left join private.vote_preview_votes v on v.workout_date=o.workout_date and v.option_id=o.option_id
  where o.workout_date=p_date group by o.option_id
 ) t;
 if tallies is null then return; end if;
 select count(*) into tied from jsonb_each_text(tallies) where value::integer=top_count;
 select key::integer into picked from jsonb_each_text(tallies) where value::integer=top_count order by random() limit 1;
 insert into private.vote_preview_results values(p_date,picked,total,tied,tallies,p_instant);
end; $$;

create or replace function private.vote_preview_state(p_actor uuid,p_instant timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'now',p_instant,'today',timezone('Europe/Stockholm',p_instant)::date,
 'is_admin',coalesce((select is_admin from public.profiles where id=p_actor),false),
 'can_vote',coalesce((select competition_status='active' from public.profiles where id=p_actor),false),
 'simulated',(select test_now is not null from private.vote_preview_settings where singleton),
 'days',(select jsonb_agg(jsonb_build_object(
  'date',d.workout_date,'opens',private.vote_preview_opens(d.workout_date),
  'closes',d.workout_date::timestamp at time zone 'Europe/Stockholm',
  'own_vote',(select option_id from private.vote_preview_votes where user_id=p_actor and workout_date=d.workout_date),
  'options',(select jsonb_agg(jsonb_build_object('id',o.option_id,'title',o.task->>'label','description',o.task->>'description','votes',(select count(*) from private.vote_preview_votes v where v.workout_date=o.workout_date and v.option_id=o.option_id)) order by o.option_id) from private.vote_preview_options o where o.workout_date=d.workout_date),
  'result',(select to_jsonb(r)-'workout_date' from private.vote_preview_results r where r.workout_date=d.workout_date)
 ) order by d.workout_date) from (select distinct workout_date from private.vote_preview_options)d)
 );
$$;

create or replace function private.vote_preview_action(p_action text,p_date date,p_option integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); instant timestamptz; day date; actor_status text;
begin
 if actor is null then raise exception 'Logga in för att rösta.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('get','vote') then raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
 perform 1 from private.vote_preview_settings where singleton for share;
 instant:=private.vote_preview_clock();
 select competition_status into actor_status from public.profiles where id=actor and nullif(btrim(display_name),'') is not null for share;
 if not found then raise exception 'Välj ett deltagarnamn först.' using errcode='42501'; end if;
 for day in select distinct workout_date from private.vote_preview_options where workout_date::timestamp at time zone 'Europe/Stockholm'<=instant order by workout_date loop
  perform private.vote_preview_settle(day,instant);
 end loop;
 if p_action='vote' then
  if actor_status<>'active' then raise exception 'Bara aktiva deltagare kan rösta.' using errcode='42501'; end if;
  if p_date is null or not exists(select 1 from private.vote_preview_options where workout_date=p_date and option_id=p_option) then raise exception 'Välj ett av de fyra passen.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(260019,p_date-date '2026-01-01');
  -- Recheck after waiting for the poll lock; a request started before midnight
  -- must not insert a vote after the deadline.
  select coalesce(test_now,clock_timestamp()) into instant from private.vote_preview_settings where singleton;
  if instant<private.vote_preview_opens(p_date) or instant>=p_date::timestamp at time zone 'Europe/Stockholm'
   or exists(select 1 from private.vote_preview_results where workout_date=p_date) then
   raise exception 'Omröstningen är inte öppen. Du röstar dagen före passet.' using errcode='42501'; end if;
  begin
   insert into private.vote_preview_votes values(p_date,actor,p_option,instant);
  exception when unique_violation then raise exception 'Du har redan röstat för den här dagen. Rösten kan inte ändras.' using errcode='23505'; end;
 end if;
 return private.vote_preview_state(actor,instant);
end; $$;

create or replace function private.vote_preview_admin(p_action text,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); instant timestamptz; previous timestamptz; day date;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and is_admin) then raise exception 'Endast lokal admin kan styra testet.' using errcode='42501'; end if;
 select test_now into previous from private.vote_preview_settings where singleton for update;
 if p_action='reset' then
  delete from private.vote_preview_votes where workout_date between date '2026-10-19' and date '2026-10-25'; delete from private.vote_preview_results where workout_date between date '2026-10-19' and date '2026-10-25';
  update private.vote_preview_settings set test_now=timestamptz '2026-10-18 20:59:00+02' where singleton;
 elsif p_action='clock' then
  if p_now is null or p_now<timestamptz '2026-10-18 19:59:00+02' or p_now>timestamptz '2026-10-26 00:00:00+01' then raise exception 'Välj ett testdatum 18–26 oktober.' using errcode='22023'; end if;
  if previous is not null and p_now<previous then raise exception 'Testklockan går bara framåt. Återställ testet för att börja om.' using errcode='22023'; end if;
  update private.vote_preview_settings set test_now=p_now where singleton;
 elsif p_action='real_time' then
  update private.vote_preview_settings set test_now=null where singleton;
 else raise exception 'Ogiltig teståtgärd.' using errcode='22023'; end if;
 instant:=private.vote_preview_clock();
 for day in select distinct workout_date from private.vote_preview_options where workout_date::timestamp at time zone 'Europe/Stockholm'<=instant order by workout_date loop
  perform private.vote_preview_settle(day,instant);
 end loop;
 return private.vote_preview_state(actor,instant);
end; $$;

revoke all on function private.vote_preview_clock(),private.vote_preview_opens(date),private.vote_preview_settle(date,timestamptz),private.vote_preview_state(uuid,timestamptz),private.vote_preview_action(text,date,integer),private.vote_preview_admin(text,timestamptz) from public,anon,authenticated;
grant execute on function private.vote_preview_action(text,date,integer),private.vote_preview_admin(text,timestamptz) to authenticated;
create or replace function public.local_workout_vote(p_action text default 'get',p_date date default null,p_option integer default null) returns jsonb
language sql security invoker set search_path='' as $$select private.vote_preview_action(p_action,p_date,p_option);$$;
create or replace function public.local_workout_vote_admin(p_action text,p_now timestamptz default null) returns jsonb
language sql security invoker set search_path='' as $$select private.vote_preview_admin(p_action,p_now);$$;
revoke all on function public.local_workout_vote(text,date,integer),public.local_workout_vote_admin(text,timestamptz) from public,anon;
grant execute on function public.local_workout_vote(text,date,integer),public.local_workout_vote_admin(text,timestamptz) to authenticated;
notify pgrst,'reload schema';
