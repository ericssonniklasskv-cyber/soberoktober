-- Private messages are accessed only through recipient-scoped RPCs.
-- Activity keys identify feed events, never participants.
create table private.activity_kudos (
  kudos_id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  activity_key text not null,
  activity_label text not null,
  message text check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (sender_id, activity_key),
  check (sender_id <> recipient_id)
);
create index activity_kudos_recipient_idx
  on private.activity_kudos (recipient_id, created_at desc, kudos_id desc);
alter table private.activity_kudos enable row level security;
create policy deny_direct_kudos_access on private.activity_kudos
  for all to anon, authenticated using (false) with check (false);
revoke all on private.activity_kudos from public, anon, authenticated;
revoke all on sequence private.activity_kudos_kudos_id_seq from public, anon, authenticated;

-- One internal source for public and authenticated feeds and target resolution.
create function private.kudos_feed_events()
returns table(user_id uuid, multiplier smallint, activity_type text,
  event_at timestamptz, result_date date, activity_label text,
  event_id bigint, source_order integer, activity_key text, kudos_label text)
language sql stable security invoker set search_path='' as $$
  select e.user_id,e.multiplier,e.activity_type,e.event_at,e.result_date,
    null::text,e.event_id,0,'daily:'||e.event_id,
    'dagens pass ×'||e.multiplier
  from public.daily_result_activity_events e
  where e.result_date between date '2026-10-01' and date '2026-10-31'
  union all
  select e.user_id,null::smallint,e.activity_type,e.event_at,e.result_date,
    case when e.activity_type='bingo_cell' then private.competition_bingo_board()->e.cell_index->>'description' else null end,
    e.event_id,1,'bingo:'||e.event_id,
    case e.activity_type
      when 'bingo_cell' then private.competition_bingo_board()->e.cell_index->>'description'
      when 'bingo_row' then 'en hel bingorad'
      else 'hela bingobrickan' end
  from private.bingo_activity_events e where e.is_active and private.bingo_enabled();
$$;
revoke all on function private.kudos_feed_events() from public, anon, authenticated;

-- Same public payload and ordering as before: no kudos or private message data.
create or replace function private.get_competition_activity_feed(p_limit integer,p_offset integer)
returns table(display_name text,multiplier smallint,activity_type text,event_at timestamptz,result_date date,activity_label text)
language sql stable security definer set search_path='' as $$
  select p.display_name,e.multiplier,e.activity_type,e.event_at,e.result_date,e.activity_label
  from private.kudos_feed_events() e join public.profiles p on p.id=e.user_id
  where nullif(btrim(p.display_name),'') is not null
  order by e.event_at desc,e.source_order desc,e.event_id desc
  limit least(greatest(coalesce(p_limit,4),1),51)
  offset greatest(coalesce(p_offset,0),0);
$$;

create function private.get_kudos_activity_feed(p_limit integer,p_offset integer)
returns table(display_name text,multiplier smallint,activity_type text,event_at timestamptz,result_date date,
  activity_label text,activity_key text,is_own boolean,kudos_sent boolean)
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Logga in för att ge kudos.' using errcode='42501'; end if;
  return query
  select p.display_name,e.multiplier,e.activity_type,e.event_at,e.result_date,e.activity_label,
    e.activity_key,e.user_id=viewer,
    exists(select 1 from private.activity_kudos k where k.sender_id=viewer and k.activity_key=e.activity_key)
  from private.kudos_feed_events() e join public.profiles p on p.id=e.user_id
  where nullif(btrim(p.display_name),'') is not null
  order by e.event_at desc,e.source_order desc,e.event_id desc
  limit least(greatest(coalesce(p_limit,4),1),51)
  offset greatest(coalesce(p_offset,0),0);
end;
$$;

create function private.send_activity_kudos(p_activity_key text,p_message text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  sender uuid := auth.uid();
  target record;
  clean_message text := nullif(regexp_replace(coalesce(p_message,''),'^\s+|\s+$','','g'),'');
begin
  if sender is null or not exists(select 1 from public.profiles p where p.id=sender and nullif(btrim(p.display_name),'') is not null)
    then raise exception 'Logga in och välj ditt namn först.' using errcode='42501'; end if;
  if char_length(clean_message)>300 then raise exception 'Meddelandet får vara högst 300 tecken.' using errcode='22023'; end if;
  select e.user_id,e.kudos_label into target
  from private.kudos_feed_events() e join public.profiles p on p.id=e.user_id
  where e.activity_key=p_activity_key and nullif(btrim(p.display_name),'') is not null;
  if not found then raise exception 'Aktiviteten finns inte längre i flödet.' using errcode='22023'; end if;
  if target.user_id=sender then raise exception 'Ge kudos till någon annan i gänget.' using errcode='22023'; end if;
  insert into private.activity_kudos(sender_id,recipient_id,activity_key,activity_label,message)
  values(sender,target.user_id,p_activity_key,target.kudos_label,clean_message)
  on conflict(sender_id,activity_key) do nothing;
  -- A retry neither sends another notification nor replaces the original message.
  return true;
end;
$$;

create function private.get_my_activity_kudos(p_limit integer,p_offset integer)
returns table(kudos_key text,sender_name text,activity_label text,message text,created_at timestamptz,is_unread boolean)
language plpgsql stable security definer set search_path='' as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Logga in för att se dina kudos.' using errcode='42501'; end if;
  return query select k.kudos_id::text,coalesce(nullif(btrim(p.display_name),''),'Deltagare'),k.activity_label,k.message,k.created_at,k.read_at is null
  from private.activity_kudos k left join public.profiles p on p.id=k.sender_id
  where k.recipient_id=viewer
  order by k.created_at desc,k.kudos_id desc
  limit least(greatest(coalesce(p_limit,20),1),51)
  offset greatest(coalesce(p_offset,0),0);
end;
$$;

create function private.get_my_kudos_unread_count()
returns bigint language plpgsql stable security definer set search_path='' as $$
declare viewer uuid := auth.uid(); total bigint;
begin
  if viewer is null then raise exception 'Logga in för att se dina kudos.' using errcode='42501'; end if;
  select count(*) into total from private.activity_kudos where recipient_id=viewer and read_at is null;
  return total;
end;
$$;

create function private.mark_activity_kudos_read(p_kudos_keys text[])
returns integer language plpgsql security definer set search_path='' as $$
declare viewer uuid := auth.uid(); affected integer;
begin
  if viewer is null then raise exception 'Logga in för att se dina kudos.' using errcode='42501'; end if;
  if coalesce(cardinality(p_kudos_keys),0)>50 then raise exception 'För många notiser.' using errcode='22023'; end if;
  update private.activity_kudos set read_at=now()
  where recipient_id=viewer and read_at is null and kudos_id=any(p_kudos_keys::bigint[]);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create function public.get_kudos_activity_feed(p_limit integer default 4,p_offset integer default 0)
returns table(display_name text,multiplier smallint,activity_type text,event_at timestamptz,result_date date,
  activity_label text,activity_key text,is_own boolean,kudos_sent boolean)
language sql stable security invoker set search_path='' as $$ select * from private.get_kudos_activity_feed(p_limit,p_offset); $$;
create function public.send_activity_kudos(p_activity_key text,p_message text default null)
returns boolean language sql security invoker set search_path='' as $$ select private.send_activity_kudos(p_activity_key,p_message); $$;
create function public.get_my_activity_kudos(p_limit integer default 20,p_offset integer default 0)
returns table(kudos_key text,sender_name text,activity_label text,message text,created_at timestamptz,is_unread boolean)
language sql stable security invoker set search_path='' as $$ select * from private.get_my_activity_kudos(p_limit,p_offset); $$;
create function public.get_my_kudos_unread_count()
returns bigint language sql stable security invoker set search_path='' as $$ select private.get_my_kudos_unread_count(); $$;
create function public.mark_activity_kudos_read(p_kudos_keys text[])
returns integer language sql security invoker set search_path='' as $$ select private.mark_activity_kudos_read(p_kudos_keys); $$;

-- Explicitly limit every entry point; private helper stays unavailable to clients.
do $$ declare f regprocedure; begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname in
      ('get_kudos_activity_feed','send_activity_kudos','get_my_activity_kudos','get_my_kudos_unread_count','mark_activity_kudos_read')
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end; $$;
notify pgrst,'reload schema';
