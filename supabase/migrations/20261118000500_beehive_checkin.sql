-- Beehive Home · guest QR check-in (SPEC § 3.5, § 6)
-- Dedicated Beehive project: tables are created fresh. ID photos live only in the
-- private Storage bucket beehive-ids; beehive_checkin_files indexes them (no base64 table).

create table public.beehive_door_keys (
  apartment text primary key references public.beehive_apartments(id) on delete cascade,
  label text,
  door_key text not null check (length(door_key) >= 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create or replace trigger beehive_door_keys_updated_at before update on public.beehive_door_keys
  for each row execute function public.beehive_set_updated_at();

create table public.beehive_checkins (
  id uuid primary key default gen_random_uuid(),
  apartment text not null references public.beehive_apartments(id),
  full_name text,
  phone text,
  adults int,
  children int,
  check_out date,
  is_foreign boolean not null default false,
  id_type text,
  nationality text,
  passport_no text,
  passport_expiry date,
  visa_no text,
  visa_type text,
  visa_expiry date,
  arrived_india date,
  arriving_from text,
  next_destination text,
  lang text,
  rules_accepted_at timestamptz,
  has_photo boolean not null default false,
  photo_count int not null default 0,
  booking_id uuid references public.beehive_bookings(id) on delete set null,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index beehive_checkins_apartment_created_idx on public.beehive_checkins(apartment, created_at);
create index beehive_checkins_booking_idx on public.beehive_checkins(booking_id);
create or replace trigger beehive_checkins_updated_at before update on public.beehive_checkins
  for each row execute function public.beehive_set_updated_at();

create table public.beehive_checkin_files (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.beehive_checkins(id) on delete cascade,
  path text not null unique,
  mime text not null default 'image/jpeg',
  created_at timestamptz not null default now()
);
create index beehive_checkin_files_checkin_idx on public.beehive_checkin_files(checkin_id);

alter table public.beehive_door_keys enable row level security;
alter table public.beehive_checkins enable row level security;
alter table public.beehive_checkin_files enable row level security;
revoke all on table public.beehive_door_keys from anon;
revoke all on table public.beehive_checkins from anon;
revoke all on table public.beehive_checkin_files from anon;

-- Owner-only access. Guests act only through the security definer functions below
-- and the upload route (service role).
create policy beehive_door_keys_owner_all on public.beehive_door_keys for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));
create policy beehive_checkins_owner_all on public.beehive_checkins for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));
create policy beehive_checkin_files_owner_select on public.beehive_checkin_files for select to authenticated
  using ((select public.beehive_is_owner()));

-- Guest-facing functions ---------------------------------------------------
-- What a guest may see before submitting: name, code, check-out time, house rules.
create or replace function public.beehive_guest_apartment(p_apartment text, p_key text)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare v jsonb;
begin
  if p_apartment is null or p_key is null or length(p_key) < 8 then return null; end if;
  select jsonb_build_object('id', a.id, 'name', a.name, 'code', a.code, 'tag_colour', a.tag_colour,
           'check_out_time', to_char(a.check_out_time, 'HH24:MI'), 'house_rules', to_jsonb(a.house_rules))
    into v
    from public.beehive_door_keys k
    join public.beehive_apartments a on a.id = k.apartment
   where k.apartment = p_apartment and k.door_key = p_key;
  return v;
end $$;
revoke all on function public.beehive_guest_apartment(text, text) from public;
grant execute on function public.beehive_guest_apartment(text, text) to anon, authenticated;

-- Submit a check-in. Validates the key, rate-limits (15 per apartment per hour) and
-- returns the check-in id plus Wi-Fi details.
create or replace function public.beehive_guest_submit(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_apt text := p->>'apartment';
  v_key text := p->>'key';
  v_id uuid;
  v_a public.beehive_apartments%rowtype;
  v_foreign boolean := coalesce((p->>'is_foreign')::boolean, false);
begin
  if not exists (select 1 from public.beehive_door_keys where apartment = v_apt and door_key = v_key) then
    raise exception 'invalid_key' using errcode = '28000';
  end if;
  if (select count(*) from public.beehive_checkins
       where apartment = v_apt and created_at > now() - interval '1 hour') >= 15 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if coalesce(length(trim(p->>'full_name')), 0) < 2 or length(p->>'full_name') > 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if coalesce((p->>'rules_accepted')::boolean, false) is not true then
    raise exception 'rules_not_accepted' using errcode = '22023';
  end if;

  select * into v_a from public.beehive_apartments where id = v_apt;

  insert into public.beehive_checkins (apartment, full_name, phone, adults, children, check_out,
    is_foreign, id_type, nationality, passport_no, passport_expiry, visa_no, visa_type, visa_expiry,
    arrived_india, arriving_from, next_destination, lang, rules_accepted_at, has_photo, photo_count)
  values (v_apt, left(trim(p->>'full_name'), 120), left(p->>'phone', 30),
    least(greatest(coalesce((p->>'adults')::int, 1), 1), 20),
    least(greatest(coalesce((p->>'children')::int, 0), 0), 20),
    nullif(p->>'check_out', '')::date, v_foreign, left(p->>'id_type', 30),
    case when v_foreign then left(p->>'nationality', 60) else 'Indian' end,
    case when v_foreign then left(p->>'passport_no', 30) end,
    case when v_foreign then nullif(p->>'passport_expiry', '')::date end,
    case when v_foreign then left(p->>'visa_no', 30) end,
    case when v_foreign then left(p->>'visa_type', 40) end,
    case when v_foreign then nullif(p->>'visa_expiry', '')::date end,
    case when v_foreign then nullif(p->>'arrived_india', '')::date end,
    case when v_foreign then left(p->>'arriving_from', 80) end,
    case when v_foreign then left(p->>'next_destination', 80) end,
    left(p->>'lang', 5), now(), false, 0)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'name', v_a.name, 'code', v_a.code,
    'check_out_time', to_char(v_a.check_out_time, 'HH24:MI'),
    'wifi_name', v_a.wifi_name, 'wifi_password', v_a.wifi_password);
end $$;
revoke all on function public.beehive_guest_submit(jsonb) from public;
grant execute on function public.beehive_guest_submit(jsonb) to anon, authenticated;

-- Private bucket for ID photos ---------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('beehive-ids', 'beehive-ids', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists beehive_ids_owner_select on storage.objects;
create policy beehive_ids_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'beehive-ids' and (select public.beehive_is_owner()));

