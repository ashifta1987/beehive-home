-- Beehive Home · core: staff, apartments, helpers (SPEC § 1, § 2, § 3.1)
-- Every object is prefixed beehive_. Never touch anything without that prefix.

create extension if not exists btree_gist with schema extensions;

-- updated_at trigger -------------------------------------------------------
create or replace function public.beehive_set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Staff --------------------------------------------------------------------
create table if not exists public.beehive_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','housekeeper')),
  name text,
  email text,
  phone text,
  lang text not null default 'en' check (lang in ('en','ml')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id)
);
create index if not exists beehive_staff_created_by_idx on public.beehive_staff(created_by);

create or replace trigger beehive_staff_updated_at before update on public.beehive_staff
  for each row execute function public.beehive_set_updated_at();

-- Role helpers (security definer so policies can call them without recursion)
create or replace function public.beehive_is_owner()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.beehive_staff
    where user_id = (select auth.uid()) and role = 'owner' and active
  );
$$;

create or replace function public.beehive_is_staff()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.beehive_staff
    where user_id = (select auth.uid()) and active
  );
$$;

revoke all on function public.beehive_is_owner() from public, anon;
revoke all on function public.beehive_is_staff() from public, anon;
grant execute on function public.beehive_is_owner() to authenticated;
grant execute on function public.beehive_is_staff() to authenticated;

alter table public.beehive_staff enable row level security;
revoke all on table public.beehive_staff from anon;

create policy beehive_staff_select on public.beehive_staff for select to authenticated
  using (user_id = (select auth.uid()) or (select public.beehive_is_owner()));
create policy beehive_staff_owner_insert on public.beehive_staff for insert to authenticated
  with check ((select public.beehive_is_owner()));
create policy beehive_staff_owner_update on public.beehive_staff for update to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));
create policy beehive_staff_owner_delete on public.beehive_staff for delete to authenticated
  using ((select public.beehive_is_owner()));

-- Apartments ---------------------------------------------------------------
create table if not exists public.beehive_apartments (
  id text primary key,
  name text not null,
  code text not null,
  sort int not null default 0,
  tag_colour text not null default 'tag1' check (tag_colour in ('tag1','tag2','tag3','tag4')),
  location text,
  bedrooms int,
  max_guests int,
  features text[] not null default '{}',
  check_in_time time not null default '14:00',
  check_out_time time not null default '11:00',
  cleaning_checklist text[] not null default '{}',
  arrival_checklist text[] not null default '{}',
  house_rules text[] not null default '{}',
  welcome_message text,
  hk_notes text,
  wifi_name text,
  wifi_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create or replace trigger beehive_apartments_updated_at before update on public.beehive_apartments
  for each row execute function public.beehive_set_updated_at();

alter table public.beehive_apartments enable row level security;
revoke all on table public.beehive_apartments from anon;

create policy beehive_apartments_staff_select on public.beehive_apartments for select to authenticated
  using ((select public.beehive_is_staff()));
create policy beehive_apartments_owner_insert on public.beehive_apartments for insert to authenticated
  with check ((select public.beehive_is_owner()));
create policy beehive_apartments_owner_update on public.beehive_apartments for update to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));
create policy beehive_apartments_owner_delete on public.beehive_apartments for delete to authenticated
  using ((select public.beehive_is_owner()));

-- Bookings -----------------------------------------------------------------
create table if not exists public.beehive_bookings (
  id uuid primary key default gen_random_uuid(),
  apartment_id text not null references public.beehive_apartments(id),
  channel text not null default 'direct' check (channel in ('airbnb','booking','direct','other')),
  channel_ref text,
  guest_name text not null,
  phone text,
  email text,
  adults int not null default 2 check (adults between 0 and 50),
  children int not null default 0 check (children between 0 and 50),
  check_in date not null,
  check_out date not null,
  check_in_time time,
  check_out_time time,
  total int not null default 0,
  commission int not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('channel','paid','partial','pending')),
  deposit int not null default 0,
  deposit_status text not null default 'none' check (deposit_status in ('none','held','refunded','deducted')),
  status text not null default 'confirmed' check (status in ('confirmed','checked_in','checked_out','cancelled')),
  id_verified boolean not null default false,
  foreign_national boolean not null default false,
  share_phone boolean not null default true,
  hk_note text,
  notes text,
  review_asked boolean not null default false,
  ical_uid text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid(),
  constraint beehive_bookings_dates check (check_out > check_in),
  constraint beehive_bookings_no_overlap exclude using gist (
    apartment_id with =, daterange(check_in, check_out, '[)') with &&
  ) where (status <> 'cancelled')
);
create index if not exists beehive_bookings_apartment_idx on public.beehive_bookings(apartment_id, check_in);
create index if not exists beehive_bookings_created_by_idx on public.beehive_bookings(created_by);
create or replace trigger beehive_bookings_updated_at before update on public.beehive_bookings
  for each row execute function public.beehive_set_updated_at();

alter table public.beehive_bookings enable row level security;
revoke all on table public.beehive_bookings from anon;
create policy beehive_bookings_owner_all on public.beehive_bookings for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));

-- Guest profiles -----------------------------------------------------------
create table if not exists public.beehive_guest_profiles (
  key text primary key,
  tag text not null default 'none' check (tag in ('none','repeat','vip','blocked')),
  rating int check (rating between 1 and 5),
  nationality text,
  city text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create or replace trigger beehive_guest_profiles_updated_at before update on public.beehive_guest_profiles
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_guest_profiles enable row level security;
revoke all on table public.beehive_guest_profiles from anon;
create policy beehive_guest_profiles_owner_all on public.beehive_guest_profiles for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));

-- Foreign guest records (Form C) ------------------------------------------
create table if not exists public.beehive_foreign_records (
  booking_id uuid primary key references public.beehive_bookings(id) on delete cascade,
  nationality text,
  passport_no text,
  passport_expiry date,
  visa_no text,
  visa_type text,
  visa_expiry date,
  arrived_india date,
  arriving_from text,
  next_destination text,
  docs_collected boolean not null default false,
  form_c_submitted boolean not null default false,
  form_c_ref text,
  form_c_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create or replace trigger beehive_foreign_records_updated_at before update on public.beehive_foreign_records
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_foreign_records enable row level security;
revoke all on table public.beehive_foreign_records from anon;
create policy beehive_foreign_records_owner_all on public.beehive_foreign_records for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));
