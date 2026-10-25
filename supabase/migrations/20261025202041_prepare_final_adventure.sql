-- Final-week backend. Additive, disabled until an explicitly approved activation.
create table private.adventure_settings(singleton boolean primary key default true check(singleton), enabled boolean not null default false);
insert into private.adventure_settings values(true,false);
create table private.adventure_personal_pawns(user_id uuid primary key references public.profiles(id) on delete cascade, pawn_id text not null unique check(pawn_id in ('mikeb','jerka','zellmani','elliott-da-bomb','nillebae')));
-- Verified production account IDs, read with permission on 25 October 2026.
-- Bind once to identity, including Elliott's emoji-bearing display name.
-- Fresh local databases without these accounts remain unbound; never fall back to names.
do $$ declare item record; begin
 for item in select * from (values ('56eb1611-deae-4b0a-99c1-5a73c66fcfd0'::uuid,'elliott-da-bomb'),('8b58969b-fc96-4934-882e-aba9d13b3d39'::uuid,'jerka'),('03c84aa4-cf6f-4ff4-a947-17773ed30abb'::uuid,'mikeb'),('3762adf9-f59e-473f-bb4b-47c45a858585'::uuid,'nillebae'),('25b7ec21-e28b-41aa-b33c-fba048992fe7'::uuid,'zellmani')) v(user_id,pawn_id) loop
  if exists(select 1 from public.profiles where id=item.user_id)then
   insert into private.adventure_personal_pawns(user_id,pawn_id)values(item.user_id,item.pawn_id);
  end if;
 end loop;
end $$;
create table private.adventure_games(user_id uuid primary key references public.profiles(id) on delete cascade, revision integer not null default 0, mount_index integer not null default 0 check(mount_index between 0 and 5), welcome_seen boolean not null default false);
create table private.adventure_events(user_id uuid not null references public.profiles(id) on delete cascade, seq integer not null, event_id uuid not null, kind text not null check(kind in ('exercise','boss','score')), exercise_id text check(exercise_id in ('squats','pushups','pullups','running')), boss_id text, choice_id text, event_date date not null check(event_date between date '2026-10-26' and date '2026-10-31'), created_at timestamptz not null default statement_timestamp(), primary key(user_id,seq),unique(user_id,event_id));
create index adventure_events_feed_idx on private.adventure_events(created_at desc,event_id);
create table private.adventure_requests(user_id uuid not null references public.profiles(id) on delete cascade, request_id uuid not null, payload jsonb not null, created_at timestamptz not null default statement_timestamp(),primary key(user_id,request_id));
alter table private.adventure_settings enable row level security;
alter table private.adventure_personal_pawns enable row level security;
alter table private.adventure_games enable row level security;
alter table private.adventure_events enable row level security;
alter table private.adventure_requests enable row level security;
revoke all on private.adventure_settings,private.adventure_personal_pawns,private.adventure_games,private.adventure_events,private.adventure_requests from public,anon,authenticated;

create function private.adventure_clock() returns timestamptz language sql volatile security invoker set search_path='' as $$select clock_timestamp();$$;
create function private.adventure_enabled() returns boolean language sql stable security invoker set search_path='' as $$select enabled from private.adventure_settings where singleton;$$;
create function private.adventure_progress(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with counts as(select count(*)filter(where kind='exercise')::integer position,count(*)filter(where kind='boss')::integer bosses,count(*)filter(where kind='score')::integer points from private.adventure_events where user_id=p_user)
 select jsonb_build_object('position',position,'bosses',bosses,'points',points,'pending',case when position>0 and position%6=0 and bosses<position/6 then position/6 else null end) from counts;
$$;
create function private.adventure_state(p_actor uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare d date:=(private.adventure_clock() at time zone 'Europe/Stockholm')::date; begin
 return jsonb_build_object('server_now',private.adventure_clock(),'today',d,'enabled',private.adventure_enabled(),'active',private.adventure_enabled() and d between date '2026-10-26' and date '2026-10-31',
 'profile',(select jsonb_build_object('id',p.id,'name',p.display_name,'is_admin',p.is_admin,'status',p.competition_status,'pawn_id',a.pawn_id,'mount_index',g.mount_index,'welcome_seen',g.welcome_seen) from public.profiles p join private.adventure_games g on g.user_id=p.id left join private.adventure_personal_pawns a on a.user_id=p.id where p.id=p_actor),
 'revision',(select revision from private.adventure_games where user_id=p_actor),
 'state',jsonb_build_object('version',2,'events',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',event_id,'type',kind,'date',event_date,'exerciseId',exercise_id,'bossId',boss_id,'choiceId',choice_id,'distanceKm',case when kind='exercise' and exercise_id='running' then 1 else null end))order by seq)from private.adventure_events where user_id=p_actor),'[]'::jsonb)),
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'pawn_id',a.pawn_id,'mount_index',coalesce(g.mount_index,0),'position',(private.adventure_progress(p.id)->>'position')::integer)order by p.created_at,p.id)from public.profiles p left join private.adventure_games g on g.user_id=p.id left join private.adventure_personal_pawns a on a.user_id=p.id where nullif(btrim(p.display_name),'')is not null),'[]'::jsonb),
 'bonus',(select jsonb_build_object('description',c.bonus_description,'points',c.bonus_points,'claimed',exists(select 1 from public.daily_bonus_claims b where b.user_id=p_actor and b.challenge_date=d))from public.daily_challenges c where c.challenge_date=d),
 'activity',coalesce((select jsonb_agg(x.data order by x.at desc,x.key desc)from(select jsonb_build_object('id',e.event_id,'user_id',e.user_id,'kind',e.kind,'exercise_id',e.exercise_id,'boss_id',e.boss_id,'date',e.event_date,'at',e.created_at) data,e.created_at at,e.event_id::text key from private.adventure_events e union all select jsonb_build_object('id','bonus-'||b.user_id||'-'||b.challenge_date,'user_id',b.user_id,'kind','bonus','points',b.points,'date',b.challenge_date,'at',b.created_at),b.created_at,'bonus-'||b.user_id||'-'||b.challenge_date from public.daily_bonus_claims b where b.challenge_date between date '2026-10-26'and date '2026-10-31' order by at desc,key desc limit 50)x),'[]'::jsonb));
end $$;

-- Only this authenticated command can change game state; dates and points are server-owned.
create function private.adventure_action(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); profile public.profiles%rowtype; game private.adventure_games%rowtype; d date; progress jsonb; pos integer; pending integer; req uuid; old jsonb; fingerprint jsonb; last_event private.adventure_events%rowtype; boss_ids text[]:=array['troll','witch','dragon','sphinx','kraken','final']; choice_ids text[]:=array['somersault','handstand','morning-walk','ball-juggling','bottle-flip','victory-jump']; kind text; seq_no integer; points integer; begin
 if actor is null then raise exception 'Logga in först.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('get','exercise','boss','undo','mount','seen','bonus','unbonus') or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>4096 then raise exception 'Ogiltig åtgärd.' using errcode='22023';end if;
 select * into profile from public.profiles where id=actor and nullif(btrim(display_name),'')is not null for update;
 if not found then raise exception 'Välj ditt deltagarnamn först.' using errcode='42501';end if;
 insert into private.adventure_games(user_id,mount_index) values(actor,mod(abs(hashtextextended(actor::text,0)::numeric),6)::integer)on conflict do nothing;
 select * into game from private.adventure_games where user_id=actor for update;
 if p_action='get' then return private.adventure_state(actor);end if;
 req:=(p_payload->>'request_id')::uuid;
 if req is null then raise exception 'Registreringen saknar ID.' using errcode='22023';end if;
 fingerprint:=jsonb_build_object('action',p_action,'payload',p_payload);
 select payload into old from private.adventure_requests where user_id=actor and request_id=req;
 if found then
  if old<>fingerprint then raise exception 'Registrerings-ID används redan.' using errcode='22023';end if;
  return private.adventure_state(actor);
 end if;
 d:=(private.adventure_clock()at time zone 'Europe/Stockholm')::date;
 if p_action in('exercise','boss','undo','bonus','unbonus')then
  if not private.adventure_enabled()or d not between date '2026-10-26'and date '2026-10-31'then raise exception 'Finalveckan är öppen 26–31 oktober, svensk tid.' using errcode='42501';end if;
  if profile.competition_status<>'active'then raise exception 'Du är utslagen ur tävlingen.'using errcode='42501';end if;
 end if;
 if p_action in('exercise','boss','undo','mount')and (p_payload->>'expected_revision')::integer is distinct from game.revision then raise exception 'Din resa har ändrats i en annan flik. Uppdatera och försök igen.' using errcode='40001';end if;
 progress:=private.adventure_progress(actor);pos:=(progress->>'position')::integer;pending:=(progress->>'pending')::integer;
 select coalesce(max(seq),0)+1 into seq_no from private.adventure_events where user_id=actor;
 if p_action='exercise'then
  if p_payload->>'exercise_id' is null or p_payload->>'exercise_id'not in('squats','pushups','pullups','running')then raise exception 'Okänd övning.'using errcode='22023';end if;
  if pending is not null and pending<>6 then raise exception 'Klara bossens uppdrag först.'using errcode='42501';end if;
  if seq_no>10000 then raise exception 'Registreringsgränsen är nådd.'using errcode='22023';end if;
  kind:=case when pos=36 then 'score'else 'exercise'end;
  insert into private.adventure_events(user_id,seq,event_id,kind,exercise_id,event_date)values(actor,seq_no,req,kind,p_payload->>'exercise_id',d);
 elsif p_action='boss'then
  if pending is null or p_payload->>'boss_id'is distinct from boss_ids[pending]or p_payload->>'choice_id'is distinct from choice_ids[pending]then raise exception 'Bossen är inte tillgänglig.'using errcode='42501';end if;
  if pending=6 and d<>date '2026-10-31'then raise exception 'Bakrusbaronen öppnar den 31 oktober.'using errcode='42501';end if;
  insert into private.adventure_events(user_id,seq,event_id,kind,boss_id,choice_id,event_date)values(actor,seq_no,req,'boss',boss_ids[pending],choice_ids[pending],d);
 elsif p_action='undo'then
  select * into last_event from private.adventure_events where user_id=actor order by seq desc limit 1;
  if last_event.event_id is null or last_event.event_id is distinct from (p_payload->>'event_id')::uuid then raise exception 'Händelsen har ändrats. Uppdatera först.'using errcode='40001';end if;
  delete from private.adventure_events where user_id=actor and seq=last_event.seq;
 elsif p_action='mount'then
  if exists(select 1 from private.adventure_personal_pawns where user_id=actor)then raise exception 'Din personliga pjäs är tilldelad.'using errcode='42501';end if;
  if p_payload->>'index' is null or (p_payload->>'index')::integer not between 0 and 5 then raise exception 'Välj en giltig pjäs.'using errcode='22023';end if;
  update private.adventure_games set mount_index=(p_payload->>'index')::integer where user_id=actor;
 elsif p_action='seen'then
  update private.adventure_games set welcome_seen=true where user_id=actor;
 elsif p_action='bonus'then
  select bonus_points into points from public.daily_challenges where challenge_date=d and nullif(btrim(bonus_description),'')is not null and bonus_points between 1 and 100;
  if points is null then raise exception 'Dagens bonus är inte publicerad ännu.'using errcode='22023';end if;
  insert into public.daily_bonus_claims(user_id,challenge_date,points)values(actor,d,points)on conflict(user_id,challenge_date)do nothing;
 elsif p_action='unbonus'then
  delete from public.daily_bonus_claims where user_id=actor and challenge_date=d;
 end if;
 insert into private.adventure_requests(user_id,request_id,payload)values(actor,req,fingerprint);
 update private.adventure_games set revision=revision+1 where user_id=actor;
 return private.adventure_state(actor);
end $$;
create function public.my_adventure(p_action text default 'get',p_payload jsonb default '{}'::jsonb)returns jsonb language sql security invoker set search_path=''as $$select private.adventure_action(p_action,p_payload);$$;
revoke all on function private.adventure_clock(),private.adventure_enabled(),private.adventure_progress(uuid),private.adventure_state(uuid),private.adventure_action(text,jsonb),public.my_adventure(text,jsonb)from public,anon,authenticated;
grant execute on function private.adventure_action(text,jsonb),public.my_adventure(text,jsonb)to authenticated;

-- Preserve the old day-completion implementation outside the final theme.
alter function private.competition_day_complete(uuid,date)rename to competition_day_complete_before_adventure;
create function private.competition_day_complete(p_user uuid,p_date date)returns boolean language sql stable security definer set search_path=''as $$
 select case when private.adventure_enabled()and p_date between date '2026-10-26'and date '2026-10-31'then exists(select 1 from private.adventure_events e where e.user_id=p_user and e.event_date=p_date)else private.competition_day_complete_before_adventure(p_user,p_date)end;
$$;
revoke all on function private.competition_day_complete(uuid,date),private.competition_day_complete_before_adventure(uuid,date)from public,anon,authenticated;

create or replace function public.get_leaderboard()returns table(rank_position bigint,display_name text,total_points numeric,completed_days bigint,is_current_user boolean,is_eliminated boolean)language sql stable security definer set search_path=''as $$
 with scores as(
 select r.user_id,sum(r.points)::numeric points from public.daily_results r where not(private.bingo_enabled()and r.result_date between date '2026-10-05'and date '2026-10-11')and r.result_date not between date '2026-10-12'and date '2026-10-25'and not(private.adventure_enabled()and r.result_date between date '2026-10-26'and date '2026-10-31')group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from public.daily_bonus_claims c group by c.user_id
 union all select b.user_id,(private.bingo_score(b.completed_cells)->>'total_points')::numeric from public.bingo_results b where private.bingo_enabled()
 union all select r.user_id,sum(r.points)::numeric from public.roulette_daily_scores r group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from private.workout_vote_completions c group by c.user_id
 union all select e.user_id,count(*)::numeric from private.adventure_events e where kind='score'group by e.user_id
 ),participants as(select p.id,p.display_name,coalesce((select sum(s.points)from scores s where s.user_id=p.id),0)::numeric total_points,(select count(*)from generate_series(date '2026-10-01',date '2026-10-31',interval '1 day')d where private.competition_day_complete(p.id,d::date))::bigint completed_days,p.competition_status='eliminated'is_eliminated from public.profiles p where p.display_name is not null),ranked as(select *,rank()over(order by total_points desc,completed_days desc)::bigint rank_position from participants)
 select rank_position,display_name,total_points,completed_days,id=(select auth.uid()),is_eliminated from ranked order by rank_position,total_points desc,completed_days desc,lower(display_name),id;
$$;

-- Private account IDs for the authenticated realm; same totals as the public list.
create function private.adventure_standings()returns jsonb language sql stable security definer set search_path=''as $$

 with scores as(
 select r.user_id,sum(r.points)::numeric points from public.daily_results r where not(private.bingo_enabled()and r.result_date between date '2026-10-05'and date '2026-10-11')and r.result_date not between date '2026-10-12'and date '2026-10-25'and not(private.adventure_enabled()and r.result_date between date '2026-10-26'and date '2026-10-31')group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from public.daily_bonus_claims c group by c.user_id
 union all select b.user_id,(private.bingo_score(b.completed_cells)->>'total_points')::numeric from public.bingo_results b where private.bingo_enabled()
 union all select r.user_id,sum(r.points)::numeric from public.roulette_daily_scores r group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from private.workout_vote_completions c group by c.user_id
 union all select e.user_id,count(*)::numeric from private.adventure_events e where kind='score'group by e.user_id
 ),participants as(select p.id,p.display_name,coalesce((select sum(s.points)from scores s where s.user_id=p.id),0)::numeric total_points,(select count(*)from generate_series(date '2026-10-01',date '2026-10-31',interval '1 day')d where private.competition_day_complete(p.id,d::date))::bigint completed_days,p.competition_status='eliminated'is_eliminated from public.profiles p where p.display_name is not null),ranked as(select *,rank()over(order by total_points desc,completed_days desc)::bigint rank_position from participants)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'points',total_points,'days',completed_days,'eliminated',is_eliminated,'final_points',coalesce((select count(*)from private.adventure_events e where e.user_id=ranked.id and kind='score'),0)+coalesce((select sum(b.points)from public.daily_bonus_claims b where b.user_id=ranked.id and b.challenge_date between date '2026-10-26'and date '2026-10-31'),0))),'[]'::jsonb)from ranked;
$$;
revoke all on function private.adventure_standings()from public,anon,authenticated;
-- Include standings without re-running the command or exposing a private helper.
create function private.adventure_api(p_action text,p_payload jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare result jsonb;begin
 result:=private.adventure_action(p_action,p_payload);
 return result||jsonb_build_object('standings',private.adventure_standings(),'previous_activity',coalesce((select jsonb_agg(to_jsonb(f))from private.get_competition_activity_feed(50,0)f where f.activity_type not like 'adventure_%'),'[]'::jsonb));
end $$;
create or replace function public.my_adventure(p_action text default 'get',p_payload jsonb default '{}'::jsonb)returns jsonb language sql security invoker set search_path=''as $$select private.adventure_api(p_action,p_payload);$$;
revoke all on function private.adventure_action(text,jsonb),private.adventure_api(text,jsonb),public.my_adventure(text,jsonb)from public,anon,authenticated;
grant execute on function private.adventure_api(text,jsonb),public.my_adventure(text,jsonb)to authenticated;

create function private.guard_adventure_daily_result()returns trigger language plpgsql security definer set search_path=''as $$begin
 if private.adventure_enabled()then raise exception 'Finalveckan gäller Frestelsernas rike. Registrera övningen där.'using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.guard_adventure_daily_result()from public,anon,authenticated;
create trigger guard_adventure_daily_result before insert or update on public.daily_results for each row when(new.result_date between date '2026-10-26'and date '2026-10-31')execute function private.guard_adventure_daily_result();
notify pgrst,'reload schema';

create sequence private.adventure_activity_seq;
alter table private.adventure_events add column activity_id bigint not null default nextval('private.adventure_activity_seq') unique;
revoke all on sequence private.adventure_activity_seq from public,anon,authenticated;
alter function private.kudos_feed_events()rename to kudos_feed_events_before_adventure;
create function private.kudos_feed_events()returns table(user_id uuid,multiplier smallint,activity_type text,event_at timestamptz,result_date date,activity_label text,event_id bigint,source_order integer,activity_key text,kudos_label text)language sql stable security invoker set search_path=''as $$
 select * from private.kudos_feed_events_before_adventure()
 union all
 select e.user_id,null::smallint,case e.kind when 'exercise'then 'adventure_step'when 'boss'then 'adventure_boss'else 'adventure_score'end,e.created_at,e.event_date,
 case when e.kind='boss'then case e.boss_id when 'troll'then 'Attraktiva Öl-Orcen'when 'witch'then 'Sexiga vin-gnomen'when 'dragon'then 'Shotsdraken'when 'sphinx'then 'Proseccohäxan'when 'kraken'then 'Nattklubbsgollum'else 'Bakrusbaronen'end else case e.exercise_id when 'squats'then '15 squats'when 'pushups'then '10 armhävningar'when 'pullups'then '5 pull-ups'else '1 km löpning'end end,
 e.activity_id,4,'adventure:'||e.activity_id,'Frestelsernas rike'from private.adventure_events e;
$$;
revoke all on function private.kudos_feed_events(),private.kudos_feed_events_before_adventure()from public,anon,authenticated;
notify pgrst,'reload schema';
