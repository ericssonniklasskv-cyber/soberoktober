-- Production: Dagens val, 19–25 October 2026. No test clock or reset endpoints.
-- Refuse to replace already registered normal results for the new theme.
do $$begin
 if exists(select 1 from public.daily_results where result_date between date '2026-10-19'and date '2026-10-25')then
  raise exception 'Future workout results already exist; review their migration before releasing voting.';
 end if;
end;$$;

create table if not exists private.workout_vote_options (
  workout_date date not null check(workout_date between date '2026-10-19' and date '2026-10-25'),
  option_id integer not null check(option_id between 0 and 3),
  task jsonb not null,
  primary key(workout_date,option_id)
);
create table if not exists private.workout_vote_votes (
  workout_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id integer not null,
  voted_at timestamptz not null,
  primary key(workout_date,user_id),
  foreign key(workout_date,option_id) references private.workout_vote_options(workout_date,option_id)
);
create index if not exists workout_vote_votes_user_idx on private.workout_vote_votes(user_id);
create table if not exists private.workout_vote_results (
  workout_date date primary key,
  option_id integer not null,
  total_votes integer not null,
  tied_options integer not null,
  counts jsonb not null,
  resolved_at timestamptz not null,
  foreign key(workout_date,option_id) references private.workout_vote_options(workout_date,option_id)
);
alter table private.workout_vote_options enable row level security;
alter table private.workout_vote_votes enable row level security;
alter table private.workout_vote_results enable row level security;
revoke all on private.workout_vote_options,private.workout_vote_votes,private.workout_vote_results from public,anon,authenticated;


create or replace function private.workout_vote_clock()returns timestamptz language sql stable security invoker set search_path=''as $$select statement_timestamp();$$;

create or replace function private.workout_vote_opens(workout_date date) returns timestamptz
language sql immutable security invoker set search_path='' as $$
 select case when workout_date=date '2026-10-19' then timestamptz '2026-10-18 21:00:00+02'
 else ((workout_date-1)::timestamp+interval '15 hours') at time zone 'Europe/Stockholm' end;
$$;

create or replace function private.workout_vote_settle(p_date date,p_instant timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare picked integer; top_count integer; tied integer; total integer; tallies jsonb;
begin
 if p_instant < (p_date::timestamp at time zone 'Europe/Stockholm') then return; end if;
 perform pg_advisory_xact_lock(260119,p_date-date '2026-01-01');
 if exists(select 1 from private.workout_vote_results where workout_date=p_date) then return; end if;
 select max(votes),sum(votes),jsonb_object_agg(option_id,votes) into top_count,total,tallies from (
  select o.option_id,count(v.user_id)::integer votes from private.workout_vote_options o
  left join private.workout_vote_votes v on v.workout_date=o.workout_date and v.option_id=o.option_id
  where o.workout_date=p_date group by o.option_id
 ) t;
 if tallies is null then return; end if;
 select count(*) into tied from jsonb_each_text(tallies) where value::integer=top_count;
 select key::integer into picked from jsonb_each_text(tallies) where value::integer=top_count order by random() limit 1;
 insert into private.workout_vote_results values(p_date,picked,total,tied,tallies,p_instant);
end; $$;

create table if not exists private.workout_vote_completions (
 workout_date date not null references private.workout_vote_results(workout_date),
 user_id uuid not null references auth.users(id) on delete cascade,
 points smallint not null default 3 check(points=3),
 completed_at timestamptz not null,
 primary key(workout_date,user_id)
);
create index if not exists workout_vote_completions_user_idx on private.workout_vote_completions(user_id);
alter table private.workout_vote_completions enable row level security;
revoke all on private.workout_vote_completions from public,anon,authenticated;


alter table private.workout_vote_completions add column if not exists kind text not null default 'workout';
alter table private.workout_vote_completions drop constraint if exists workout_vote_completions_points_check;
alter table private.workout_vote_completions drop constraint if exists workout_vote_completion_kind_points;
alter table private.workout_vote_completions add constraint workout_vote_completion_kind_points
 check((kind='workout' and points=3) or (kind='steps' and points=1));


create or replace function private.workout_vote_state(p_actor uuid,p_instant timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'now',p_instant,'today',timezone('Europe/Stockholm',p_instant)::date,
 'is_admin',coalesce((select is_admin from public.profiles where id=p_actor),false),
 'can_vote',coalesce((select competition_status='active' from public.profiles where id=p_actor),false),
 'simulated',false,
 'days',(select jsonb_agg(jsonb_build_object(
  'date',d.workout_date,'opens',private.workout_vote_opens(d.workout_date),
  'closes',d.workout_date::timestamp at time zone 'Europe/Stockholm',
  'completion',(select jsonb_build_object('completed_at',completed_at,'points',points,'kind',kind) from private.workout_vote_completions where user_id=p_actor and workout_date=d.workout_date),
  'own_vote',(select option_id from private.workout_vote_votes where user_id=p_actor and workout_date=d.workout_date),
  'options',(select jsonb_agg(jsonb_build_object('id',o.option_id,'title',o.task->>'label','description',o.task->>'description','votes',(select count(*) from private.workout_vote_votes v where v.workout_date=o.workout_date and v.option_id=o.option_id)) order by o.option_id) from private.workout_vote_options o where o.workout_date=d.workout_date),
  'result',(select to_jsonb(r)-'workout_date' from private.workout_vote_results r where r.workout_date=d.workout_date)
 ) order by d.workout_date) from (select distinct workout_date from private.workout_vote_options)d)
 );
$$;

create or replace function private.workout_vote_action(p_action text,p_date date,p_option integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); instant timestamptz; day date; actor_status text; existing_kind text; chosen_kind text;
begin
 if actor is null then raise exception 'Logga in för att rösta.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('get','vote','complete','uncomplete','steps','unsteps') then raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
 instant:=private.workout_vote_clock();
 select competition_status into actor_status from public.profiles where id=actor and nullif(btrim(display_name),'') is not null for share;
 if not found then raise exception 'Välj ett deltagarnamn först.' using errcode='42501'; end if;
 for day in select distinct workout_date from private.workout_vote_options where workout_date::timestamp at time zone 'Europe/Stockholm'<=instant order by workout_date loop
  perform private.workout_vote_settle(day,instant);
 end loop;
 if p_action='vote' then
  if actor_status<>'active' then raise exception 'Bara aktiva deltagare kan rösta.' using errcode='42501'; end if;
  if p_date is null or not exists(select 1 from private.workout_vote_options where workout_date=p_date and option_id=p_option) then raise exception 'Välj ett av de fyra passen.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(260119,p_date-date '2026-01-01');
  -- Recheck after waiting for the poll lock; a request started before midnight
  -- must not insert a vote after the deadline.
  instant:=clock_timestamp();
  if instant<private.workout_vote_opens(p_date) or instant>=p_date::timestamp at time zone 'Europe/Stockholm'
   or exists(select 1 from private.workout_vote_results where workout_date=p_date) then
   raise exception 'Omröstningen är inte öppen. Du röstar dagen före passet.' using errcode='42501'; end if;
  begin
   insert into private.workout_vote_votes values(p_date,actor,p_option,instant);
  exception when unique_violation then raise exception 'Du har redan röstat för den här dagen. Rösten kan inte ändras.' using errcode='23505'; end;
 elsif p_action in ('complete','uncomplete','steps','unsteps') then
  perform pg_advisory_xact_lock(260119,coalesce(p_date,date '2026-01-01')-date '2026-01-01');
  instant:=clock_timestamp();
  if p_date is null or p_date<>timezone('Europe/Stockholm',instant)::date
     or not exists(select 1 from private.workout_vote_results where workout_date=p_date) then
   raise exception 'Du kan klarmarkera dagens pass först när omröstningen är avgjord.' using errcode='42501';
  end if;
  chosen_kind:=case when p_action in ('steps','unsteps') then 'steps' else 'workout' end;
  if p_action in ('complete','steps') then
   if actor_status<>'active' then raise exception 'Bara aktiva deltagare kan klarmarkera pass.' using errcode='42501'; end if;
   select kind into existing_kind from private.workout_vote_completions where workout_date=p_date and user_id=actor;
   if existing_kind is not null and existing_kind<>chosen_kind then
    if existing_kind='steps' then raise exception 'Klicka ur 10 000 steg innan du klarmarkerar passet.' using errcode='42501';
    else raise exception 'Ångra klarmarkeringen innan du väljer 10 000 steg.' using errcode='42501'; end if;
   end if;
   insert into private.workout_vote_completions(workout_date,user_id,points,kind,completed_at)
   values(p_date,actor,case when chosen_kind='steps' then 1 else 3 end,chosen_kind,instant) on conflict do nothing;
  else
   delete from private.workout_vote_completions where workout_date=p_date and user_id=actor and kind=chosen_kind;
  end if;
 end if;
 return private.workout_vote_state(actor,instant);
end; $$;

create table if not exists private.workout_vote_catalog(
 task_id text primary key,
 task jsonb not null check(jsonb_typeof(task)='object')
);
create table if not exists private.workout_vote_draws(
 workout_date date primary key check(workout_date between date '2026-10-19' and date '2026-10-25'),
 catalog_revision text not null,
 source text not null check(source in ('legacy','random')),
 generated_at timestamptz not null default clock_timestamp()
);
alter table private.workout_vote_catalog enable row level security;
alter table private.workout_vote_draws enable row level security;
revoke all on private.workout_vote_catalog,private.workout_vote_draws from public,anon,authenticated;

-- The original numbered list: remove #1 (bingo 0), #18 (bingo 21), #19 (bingo 22).
with retained as (
 select 'bingo-'||i task_id,private.default_bingo_test_board()->i task
 from unnest(array[1,2,3,4,6,7,8,9,10,11,13,14,15,17,18,19,24]) i
), added(task_id,task) as(values
 ('strength-squats-3x15','{"label":"3 × 15 squats","description":"3 set med 15 squats i varje set – 45 squats totalt.","unit":"squats","base_amount":45}'::jsonb),
 ('strength-pushups-3x10','{"label":"3 × 10 armhävningar","description":"3 set med 10 armhävningar i varje set – 30 armhävningar totalt.","unit":"armhävningar","base_amount":30}'::jsonb),
 ('strength-pullups-3x5','{"label":"3 × 5 pull-ups","description":"3 set med 5 pull-ups i varje set – 15 pull-ups totalt.","unit":"pull-ups","base_amount":15}'::jsonb)
)
insert into private.workout_vote_catalog(task_id,task)
 select task_id,task||jsonb_build_object('vote_id',task_id) from (select * from retained union all select * from added)t
 on conflict(task_id)do update set task=excluded.task;
delete from private.workout_vote_catalog where task_id not in(
 'bingo-1','bingo-2','bingo-3','bingo-4','bingo-6','bingo-7','bingo-8','bingo-9','bingo-10','bingo-11','bingo-13','bingo-14','bingo-15','bingo-17','bingo-18','bingo-19','bingo-24',
 'strength-squats-3x15','strength-pushups-3x10','strength-pullups-3x5');


create or replace function private.workout_vote_prepare() returns void
language plpgsql security invoker set search_path=''as $$
declare day date; chosen integer; revision text;
begin
 perform pg_advisory_xact_lock(260120,1);
 select md5(string_agg(task::text,'|'order by task_id))into revision from private.workout_vote_catalog;
 for day in select d::date from generate_series(date '2026-10-19',date '2026-10-25',interval '1 day')d order by d loop
  chosen:=(select count(*)from private.workout_vote_options where workout_date=day);
  if chosen=4 then continue;end if;
  if chosen<>0 then raise exception 'An existing poll must have exactly four options.';end if;
  insert into private.workout_vote_options(workout_date,option_id,task)
   select day,(row_number()over(order by random())-1)::integer,task from(
    select c.task from private.workout_vote_catalog c where not exists(
     select 1 from private.workout_vote_options o where o.workout_date between day-2 and day-1 and o.task->>'vote_id'=c.task_id
    )order by random()limit 4
   )eligible;
  get diagnostics chosen=row_count;
  if chosen<>4 then raise exception 'Not enough distinct activities for the two-day cooldown.';end if;
  insert into private.workout_vote_draws(workout_date,catalog_revision,source)values(day,revision,'random');
 end loop;
end;$$;
create unique index workout_vote_unique_activity_per_day on private.workout_vote_options(workout_date,(task->>'vote_id'));
select private.workout_vote_prepare();

CREATE OR REPLACE FUNCTION private.competition_day_complete(p_user uuid, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when p_date between date '2026-10-19' and date '2026-10-25' then exists(select 1 from private.workout_vote_completions c where c.user_id=p_user and c.workout_date=p_date) when p_date between date '2026-10-12' and date '2026-10-18' then exists(select 1 from public.roulette_daily_scores r where r.user_id=p_user and r.result_date=p_date) when private.bingo_enabled() and p_date between date '2026-10-05' and date '2026-10-11' then
   exists(select 1 from public.bingo_results b where b.user_id=p_user and (p_date=any(b.repeat_dates) or exists(select 1 from jsonb_each_text(b.completed_cells) c where c.value=p_date::text)))
 else exists(select 1 from public.daily_results r where r.user_id=p_user and r.result_date=p_date) end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_leaderboard()
 RETURNS TABLE(rank_position bigint, display_name text, total_points numeric, completed_days bigint, is_current_user boolean, is_eliminated boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with scores as(
 select r.user_id,sum(r.points)::numeric points from public.daily_results r where not(private.bingo_enabled() and r.result_date between date '2026-10-05' and date '2026-10-11') and r.result_date not between date '2026-10-12' and date '2026-10-25' group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from public.daily_bonus_claims c group by c.user_id
 union all select b.user_id,(private.bingo_score(b.completed_cells)->>'total_points')::numeric from public.bingo_results b where private.bingo_enabled()
 union all select r.user_id,sum(r.points)::numeric from public.roulette_daily_scores r group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from private.workout_vote_completions c group by c.user_id
 ), participants as(
 select p.id,p.display_name,coalesce((select sum(s.points) from scores s where s.user_id=p.id),0)::numeric total_points,
 (select count(*) from generate_series(date '2026-10-01',date '2026-10-31',interval '1 day') d where private.competition_day_complete(p.id,d::date))::bigint completed_days,
 p.competition_status='eliminated' is_eliminated from public.profiles p where p.display_name is not null
 ), ranked as(select *,rank() over(order by total_points desc,completed_days desc)::bigint rank_position from participants)
 select rank_position,display_name,total_points,completed_days,id=(select auth.uid()),is_eliminated from ranked
 order by rank_position,total_points desc,completed_days desc,lower(display_name),id;
$function$
;


create or replace function private.guard_workout_vote_daily_result() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'Den dagen gäller Dagens val. Registrera dagens pass eller 10 000 steg där.' using errcode='42501'; end; $$;

create trigger guard_workout_vote_daily_result before insert or update on public.daily_results
for each row when(new.result_date between date '2026-10-19'and date '2026-10-25')execute function private.guard_workout_vote_daily_result();
create or replace function public.my_workout_vote(p_action text default 'get',p_date date default null,p_option integer default null)returns jsonb
language sql security invoker set search_path=''as $$select private.workout_vote_action(p_action,p_date,p_option);$$;
create or replace function private.workout_vote_tick()returns void language plpgsql security invoker set search_path=''as $$
declare day date;instant timestamptz:=clock_timestamp();
begin
 for day in select distinct workout_date from private.workout_vote_options where workout_date::timestamp at time zone 'Europe/Stockholm'<=instant order by workout_date loop
  perform private.workout_vote_settle(day,instant);
 end loop;
 if instant>=timestamptz '2026-10-26 00:00+01'and exists(select 1 from cron.job where jobname='soberoktober-workout-vote-midnight')then
  perform cron.unschedule('soberoktober-workout-vote-midnight');
 end if;
end;$$;
revoke all on function private.workout_vote_clock(),private.workout_vote_opens(date),private.workout_vote_settle(date,timestamptz),private.workout_vote_state(uuid,timestamptz),private.workout_vote_action(text,date,integer),private.workout_vote_prepare(),private.guard_workout_vote_daily_result(),private.workout_vote_tick(),public.my_workout_vote(text,date,integer)from public,anon,authenticated;
grant execute on function private.workout_vote_action(text,date,integer),public.my_workout_vote(text,date,integer)to authenticated;
select cron.schedule('soberoktober-workout-vote-midnight','* * * * *','select private.workout_vote_tick();');
notify pgrst,'reload schema';
