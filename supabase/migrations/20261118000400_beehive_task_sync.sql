-- Beehive Home · bookings → jobs automation (SPEC § 4.1)

create or replace function public.beehive_today()
returns date language sql stable
set search_path = public
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.beehive_sync_tasks(p_apartment text)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_today date := public.beehive_today();
  v_apt public.beehive_apartments%rowtype;
  b record;
  nb record;
  v_setup text[];
  v_collect text[];
begin
  select * into v_apt from public.beehive_apartments where id = p_apartment;
  if not found then return; end if;

  -- 1. Remove auto jobs whose booking is cancelled (keep done jobs).
  delete from public.beehive_tasks t
   using public.beehive_bookings bk
   where t.booking_id = bk.id and t.auto and t.status <> 'done'
     and bk.apartment_id = p_apartment and bk.status = 'cancelled';

  -- Auto jobs that moved to another apartment.
  delete from public.beehive_tasks t
   using public.beehive_bookings bk
   where t.booking_id = bk.id and t.auto and t.status <> 'done'
     and bk.apartment_id <> t.apartment_id and t.apartment_id = p_apartment;

  for b in
    select * from public.beehive_bookings
     where apartment_id = p_apartment and status <> 'cancelled'
       and (check_out >= v_today - 2 or check_in >= v_today - 2)
     order by check_in
  loop
    select coalesce(array_agg(be.name || case when be.qty > 1 then ' ×' || be.qty else '' end order by be.date), '{}')
      into v_setup
      from public.beehive_booking_extras be
     where be.booking_id = b.id and be.status <> 'cancelled' and be.extra_id is not null;

    select coalesce(array_agg(be.name || case when be.qty > 1 then ' ×' || be.qty else '' end order by be.date), '{}')
      into v_collect
      from public.beehive_booking_extras be
      join public.beehive_extras e on e.id = be.extra_id
     where be.booking_id = b.id and be.status <> 'cancelled' and e.return_check;

    -- Turnover on check-out day
    if b.check_out >= v_today - 2 then
      select n.check_in, coalesce(n.check_in_time, v_apt.check_in_time) as t, n.adults + n.children as g
        into nb
        from public.beehive_bookings n
       where n.apartment_id = p_apartment and n.status <> 'cancelled'
         and n.id <> b.id and n.check_in >= b.check_out
       order by n.check_in limit 1;

      insert into public.beehive_tasks as t (kind, apartment_id, booking_id, auto, date, time,
        guest_first_name, guests, channel, is_foreign, next_arrival, next_arrival_time, next_guests,
        extras_collect, hk_note)
      values ('turnover', p_apartment, b.id, true, b.check_out, coalesce(b.check_out_time, v_apt.check_out_time),
        split_part(trim(b.guest_name), ' ', 1), b.adults + b.children, b.channel, b.foreign_national,
        nb.check_in, nb.t, nb.g, v_collect, b.hk_note)
      on conflict (booking_id, kind) where auto do update set
        apartment_id = excluded.apartment_id, date = excluded.date, time = excluded.time,
        guest_first_name = excluded.guest_first_name, guests = excluded.guests,
        channel = excluded.channel, is_foreign = excluded.is_foreign,
        next_arrival = excluded.next_arrival, next_arrival_time = excluded.next_arrival_time,
        next_guests = excluded.next_guests, extras_collect = excluded.extras_collect,
        hk_note = excluded.hk_note;
    end if;

    -- Arrival on check-in day
    if b.check_in >= v_today - 2 then
      insert into public.beehive_tasks as t (kind, apartment_id, booking_id, auto, date, time,
        guest_first_name, guests, guest_phone, channel, is_foreign, extras_setup, hk_note)
      values ('arrival', p_apartment, b.id, true, b.check_in, coalesce(b.check_in_time, v_apt.check_in_time),
        split_part(trim(b.guest_name), ' ', 1), b.adults + b.children,
        case when b.share_phone then b.phone else null end, b.channel, b.foreign_national, v_setup, b.hk_note)
      on conflict (booking_id, kind) where auto do update set
        apartment_id = excluded.apartment_id, date = excluded.date, time = excluded.time,
        guest_first_name = excluded.guest_first_name, guests = excluded.guests,
        guest_phone = excluded.guest_phone, channel = excluded.channel,
        is_foreign = excluded.is_foreign, extras_setup = excluded.extras_setup,
        hk_note = excluded.hk_note;
    end if;
  end loop;
end $$;

revoke all on function public.beehive_sync_tasks(text) from public, anon, authenticated;

create or replace function public.beehive_bookings_after_change()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    perform public.beehive_sync_tasks(old.apartment_id);
  end if;
  if tg_op in ('INSERT','UPDATE') and (tg_op = 'INSERT' or new.apartment_id <> old.apartment_id) then
    perform public.beehive_sync_tasks(new.apartment_id);
  end if;
  return null;
end $$;
revoke all on function public.beehive_bookings_after_change() from public, anon, authenticated;

create or replace trigger beehive_bookings_sync after insert or update or delete on public.beehive_bookings
  for each row execute function public.beehive_bookings_after_change();

create or replace function public.beehive_booking_extras_after_change()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare v_apt text;
begin
  select apartment_id into v_apt from public.beehive_bookings
   where id = coalesce(new.booking_id, old.booking_id);
  if v_apt is not null then perform public.beehive_sync_tasks(v_apt); end if;
  return null;
end $$;
revoke all on function public.beehive_booking_extras_after_change() from public, anon, authenticated;

create or replace trigger beehive_booking_extras_sync after insert or update or delete on public.beehive_booking_extras
  for each row execute function public.beehive_booking_extras_after_change();

-- Daily refresh (called by the cron) so jobs exist for bookings that come into the window.
create or replace function public.beehive_sync_all_tasks()
returns void language plpgsql security definer
set search_path = public
as $$
declare a record;
begin
  for a in select id from public.beehive_apartments loop
    perform public.beehive_sync_tasks(a.id);
  end loop;
end $$;
revoke all on function public.beehive_sync_all_tasks() from public, anon, authenticated;
grant execute on function public.beehive_sync_all_tasks() to service_role;

