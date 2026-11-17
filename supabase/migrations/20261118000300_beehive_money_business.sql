-- Beehive Home · money & business (SPEC § 3.3, § 3.4)

create table if not exists public.beehive_petty (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('in','out')),
  date date not null,
  amount int not null check (amount >= 0),
  category text not null default 'other' check (category in
    ('supplies','laundry','cleaning','repairs','transport','guest','other')),
  apartment_id text references public.beehive_apartments(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid()
);
create index if not exists beehive_petty_apartment_idx on public.beehive_petty(apartment_id);
create index if not exists beehive_petty_created_by_idx on public.beehive_petty(created_by);
create or replace trigger beehive_petty_updated_at before update on public.beehive_petty
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_petty enable row level security;
revoke all on table public.beehive_petty from anon;
create policy beehive_petty_staff_select on public.beehive_petty for select to authenticated
  using ((select public.beehive_is_staff()));
create policy beehive_petty_staff_insert on public.beehive_petty for insert to authenticated
  with check ((select public.beehive_is_staff()));
create policy beehive_petty_update on public.beehive_petty for update to authenticated
  using ((select public.beehive_is_owner()) or (created_by = (select auth.uid()) and (select public.beehive_is_staff())))
  with check ((select public.beehive_is_owner()) or (created_by = (select auth.uid()) and (select public.beehive_is_staff())));
create policy beehive_petty_owner_delete on public.beehive_petty for delete to authenticated
  using ((select public.beehive_is_owner()));

create table if not exists public.beehive_expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  amount int not null check (amount >= 0),
  category text not null default 'other' check (category in ('electricity','water','internet',
    'association','repairs','supplies','laundry','wages','cleaning','gas','taxes','marketing','assets','bank','other')),
  apartment_id text references public.beehive_apartments(id),
  vendor text,
  paid_via text check (paid_via in ('upi','cash','bank','card')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid()
);
create index if not exists beehive_expenses_date_idx on public.beehive_expenses(date);
create index if not exists beehive_expenses_apartment_idx on public.beehive_expenses(apartment_id);
create index if not exists beehive_expenses_created_by_idx on public.beehive_expenses(created_by);
create or replace trigger beehive_expenses_updated_at before update on public.beehive_expenses
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_expenses enable row level security;
revoke all on table public.beehive_expenses from anon;
create policy beehive_expenses_owner_all on public.beehive_expenses for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));

create table if not exists public.beehive_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price int check (price is null or price >= 0),
  unit text not null default 'use' check (unit in ('use','day','night','hour','event','item')),
  apartment_id text references public.beehive_apartments(id),
  qty int,
  deposit int,
  description text,
  setup_note text,
  return_check boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists beehive_extras_apartment_idx on public.beehive_extras(apartment_id);
create or replace trigger beehive_extras_updated_at before update on public.beehive_extras
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_extras enable row level security;
revoke all on table public.beehive_extras from anon;
create policy beehive_extras_staff_select on public.beehive_extras for select to authenticated
  using ((select public.beehive_is_staff()));
create policy beehive_extras_owner_insert on public.beehive_extras for insert to authenticated
  with check ((select public.beehive_is_owner()));
create policy beehive_extras_owner_update on public.beehive_extras for update to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));
create policy beehive_extras_owner_delete on public.beehive_extras for delete to authenticated
  using ((select public.beehive_is_owner()));

create table if not exists public.beehive_booking_extras (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.beehive_bookings(id) on delete cascade,
  extra_id uuid references public.beehive_extras(id) on delete set null,
  name text not null,
  unit text not null default 'use',
  qty int not null default 1 check (qty >= 0),
  units int not null default 1 check (units >= 0),
  price int not null default 0 check (price >= 0),
  total int generated always as (qty * units * price) stored,
  date date not null,
  status text not null default 'requested' check (status in ('requested','confirmed','delivered','returned','cancelled')),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists beehive_booking_extras_booking_idx on public.beehive_booking_extras(booking_id);
create index if not exists beehive_booking_extras_extra_idx on public.beehive_booking_extras(extra_id);
create or replace trigger beehive_booking_extras_updated_at before update on public.beehive_booking_extras
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_booking_extras enable row level security;
revoke all on table public.beehive_booking_extras from anon;
create policy beehive_booking_extras_owner_all on public.beehive_booking_extras for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));

create table if not exists public.beehive_licences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  number text,
  issued_by text,
  apartment_id text references public.beehive_apartments(id),
  issued date,
  expires date,
  remind_days int not null default 60,
  note text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists beehive_licences_apartment_idx on public.beehive_licences(apartment_id);
create or replace trigger beehive_licences_updated_at before update on public.beehive_licences
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_licences enable row level security;
revoke all on table public.beehive_licences from anon;
create policy beehive_licences_owner_all on public.beehive_licences for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));

create table if not exists public.beehive_listings (
  id uuid primary key default gen_random_uuid(),
  apartment_id text not null references public.beehive_apartments(id),
  channel text not null check (channel in ('airbnb','booking','direct','other')),
  title text,
  url text,
  price int,
  status text not null default 'live' check (status in ('live','paused','draft')),
  rating numeric(3,2),
  reviews int,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists beehive_listings_apartment_idx on public.beehive_listings(apartment_id);
create or replace trigger beehive_listings_updated_at before update on public.beehive_listings
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_listings enable row level security;
revoke all on table public.beehive_listings from anon;
create policy beehive_listings_owner_all on public.beehive_listings for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));

create table if not exists public.beehive_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'all' check (channel in ('all','airbnb','booking','direct','instagram','whatsapp','google')),
  spend int not null default 0,
  start date,
  "end" date,
  offer text,
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create or replace trigger beehive_campaigns_updated_at before update on public.beehive_campaigns
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_campaigns enable row level security;
revoke all on table public.beehive_campaigns from anon;
create policy beehive_campaigns_owner_all on public.beehive_campaigns for all to authenticated
  using ((select public.beehive_is_owner())) with check ((select public.beehive_is_owner()));

-- Daily digest written by the 07:00 IST cron (SPEC § 7)
create table if not exists public.beehive_digests (
  day date primary key,
  alerts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create or replace trigger beehive_digests_updated_at before update on public.beehive_digests
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_digests enable row level security;
revoke all on table public.beehive_digests from anon;
create policy beehive_digests_owner_select on public.beehive_digests for select to authenticated
  using ((select public.beehive_is_owner()));

