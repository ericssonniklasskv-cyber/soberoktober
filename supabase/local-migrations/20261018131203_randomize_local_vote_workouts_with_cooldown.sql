-- LOCAL TEST ONLY. Shared, persisted draws; no production changes.
create table if not exists private.vote_preview_catalog(
 task_id text primary key,
 task jsonb not null check(jsonb_typeof(task)='object')
);
create table if not exists private.vote_preview_draws(
 workout_date date primary key check(workout_date between date '2026-10-19' and date '2026-10-25'),
 catalog_revision text not null,
 source text not null check(source in ('legacy','random')),
 generated_at timestamptz not null default clock_timestamp()
);
alter table private.vote_preview_catalog enable row level security;
alter table private.vote_preview_draws enable row level security;
revoke all on private.vote_preview_catalog,private.vote_preview_draws from public,anon,authenticated;

-- The original numbered list: remove #1 (bingo 0), #18 (bingo 21), #19 (bingo 22).
with retained as (
 select 'bingo-'||i task_id,private.default_bingo_test_board()->i task
 from unnest(array[1,2,3,4,6,7,8,9,10,11,13,14,15,17,18,19,24]) i
), added(task_id,task) as(values
 ('strength-squats-3x15','{"label":"3 × 15 squats","description":"3 set med 15 squats i varje set – 45 squats totalt.","unit":"squats","base_amount":45}'::jsonb),
 ('strength-pushups-3x10','{"label":"3 × 10 armhävningar","description":"3 set med 10 armhävningar i varje set – 30 armhävningar totalt.","unit":"armhävningar","base_amount":30}'::jsonb),
 ('strength-pullups-3x5','{"label":"3 × 5 pull-ups","description":"3 set med 5 pull-ups i varje set – 15 pull-ups totalt.","unit":"pull-ups","base_amount":15}'::jsonb)
)
insert into private.vote_preview_catalog(task_id,task)
 select task_id,task||jsonb_build_object('vote_id',task_id) from (select * from retained union all select * from added)t
 on conflict(task_id)do update set task=excluded.task;
delete from private.vote_preview_catalog where task_id not in(
 'bingo-1','bingo-2','bingo-3','bingo-4','bingo-6','bingo-7','bingo-8','bingo-9','bingo-10','bingo-11','bingo-13','bingo-14','bingo-15','bingo-17','bingo-18','bingo-19','bingo-24',
 'strength-squats-3x15','strength-pushups-3x10','strength-pullups-3x5');

create or replace function private.vote_preview_prepare() returns void
language plpgsql security invoker set search_path='' as $$
declare day date; instant timestamptz; revision text; chosen integer;
begin
 -- Same lock order as clock/reset operations. Serialise the entire week's draw.
 perform 1 from private.vote_preview_settings where singleton for share;
 perform pg_advisory_xact_lock(260020,1);
 instant:=private.vote_preview_clock();
 select md5(string_agg(task::text,'|' order by task_id)) into revision from private.vote_preview_catalog;
 if revision is null then raise exception 'Aktivitetsutbudet är tomt.';end if;
 for day in select d::date from generate_series(date '2026-10-19',date '2026-10-25',interval '1 day')d order by d loop
  if exists(select 1 from private.vote_preview_draws where workout_date=day and catalog_revision=revision)then continue;end if;
  if private.vote_preview_opens(day)<=instant
   or exists(select 1 from private.vote_preview_votes where workout_date=day)
   or exists(select 1 from private.vote_preview_results where workout_date=day)
   or exists(select 1 from private.vote_preview_completions where workout_date=day)then
   if (select count(*) from private.vote_preview_options where workout_date=day)<>4 then raise exception 'En öppnad omröstning saknar fyra alternativ.';end if;
   insert into private.vote_preview_draws(workout_date,catalog_revision,source)values(day,'legacy','legacy')on conflict do nothing;
   continue;
  end if;
  delete from private.vote_preview_options where workout_date=day;
  insert into private.vote_preview_options(workout_date,option_id,task)
  select day,(row_number() over(order by random())-1)::integer,task from (
   select c.task from private.vote_preview_catalog c where not exists(
    select 1 from private.vote_preview_options o where o.workout_date between day-2 and day-1 and o.task->>'vote_id'=c.task_id
   )order by random()limit 4
  )eligible;
  get diagnostics chosen=row_count;
  if chosen<>4 then raise exception 'Aktivitetsutbudet räcker inte till fyra unika alternativ med två dagars spärr.';end if;
  insert into private.vote_preview_draws(workout_date,catalog_revision,source)values(day,revision,'random')
   on conflict(workout_date)do update set catalog_revision=excluded.catalog_revision,source='random',generated_at=clock_timestamp();
 end loop;
end; $$;
revoke all on function private.vote_preview_prepare() from public,anon,authenticated;

-- Preserve legacy/open polls; add stable identity without changing their visible task.
update private.vote_preview_options o set task=task||jsonb_build_object('vote_id',coalesce(
 (select c.task_id from private.vote_preview_catalog c where c.task->>'label'=o.task->>'label'),
 (select 'bingo-'||(ordinality-1) from jsonb_array_elements(private.default_bingo_test_board())with ordinality b(task,ordinality)where b.task->>'label'=o.task->>'label'),
 'legacy-'||md5(o.task::text)))where o.task->>'vote_id' is null;
create unique index if not exists vote_preview_unique_activity_per_day on private.vote_preview_options(workout_date,(task->>'vote_id'))where task?'vote_id';

create or replace function private.vote_preview_admin(p_action text,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); instant timestamptz; previous timestamptz; day date;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and is_admin) then raise exception 'Endast lokal admin kan styra testet.' using errcode='42501'; end if;
 select test_now into previous from private.vote_preview_settings where singleton for update;
 if p_action='reset' then
  delete from private.vote_preview_completions where workout_date between date '2026-10-19' and date '2026-10-25';
  delete from private.vote_preview_votes where workout_date between date '2026-10-19' and date '2026-10-25'; delete from private.vote_preview_results where workout_date between date '2026-10-19' and date '2026-10-25';
  delete from private.vote_preview_draws where workout_date between date '2026-10-19' and date '2026-10-25';
  delete from private.vote_preview_options where workout_date between date '2026-10-19' and date '2026-10-25';
  update private.vote_preview_settings set test_now=timestamptz '2026-10-18 20:59:00+02' where singleton;
  perform private.vote_preview_prepare();
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


select private.vote_preview_prepare();
notify pgrst,'reload schema';
