-- Beehive Home · work: tasks, issues, periodic care, assets, laundry (SPEC § 3.2)

-- Tasks (jobs) -------------------------------------------------------------
create table if not exists public.beehive_tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('turnover','arrival','deep','inspection','maintenance','laundry','other')),
  apartment_id text not null references public.beehive_apartments(id),
  booking_id uuid references public.beehive_bookings(id) on delete cascade,
  auto boolean not null default false,
  date date not null,
  time time,
  status text not null default 'pending' check (status in ('pending','in_progress','done')),
  checks jsonb not null default '{}'::jsonb,
  note text,
  hk_notes text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  guest_first_name text,
  guests int,
  guest_phone text,
  channel text,
  is_foreign boolean not null default false,
  next_arrival date,
  next_arrival_time time,
  next_guests int,
  extras_setup text[] not null default '{}',
  extras_collect text[] not null default '{}',
  hk_note text,
  inventory jsonb,
  inventory_at timestamptz,
  inventory_by uuid references auth.users(id),
  missing_count int,
  condition text check (condition in ('ok','messy','damaged')),
  condition_note text,
  condition_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid()
);
create unique index if not exists beehive_tasks_auto_uniq on public.beehive_tasks(booking_id, kind) where auto;
create index if not exists beehive_tasks_date_idx on public.beehive_tasks(date);
create index if not exists beehive_tasks_apartment_idx on public.beehive_tasks(apartment_id);
create index if not exists beehive_tasks_booking_idx on public.beehive_tasks(booking_id);
create index if not exists beehive_tasks_completed_by_idx on public.beehive_tasks(completed_by);
create index if not exists beehive_tasks_inventory_by_idx on public.beehive_tasks(inventory_by);
create index if not exists beehive_tasks_created_by_idx on public.beehive_tasks(created_by);
create or replace trigger beehive_tasks_updated_at before update on public.beehive_tasks
  for each row execute function public.beehive_set_updated_at();

-- Housekeepers may only change their own fields; everything else is kept as it was.
create or replace function public.beehive_tasks_guard()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if public.beehive_is_owner() or auth.uid() is null then
    return new;
  end if;
  new.kind := old.kind; new.apartment_id := old.apartment_id; new.booking_id := old.booking_id;
  new.auto := old.auto; new.date := old.date; new.time := old.time; new.note := old.note;
  new.guest_first_name := old.guest_first_name; new.guests := old.guests;
  new.guest_phone := old.guest_phone; new.channel := old.channel; new.is_foreign := old.is_foreign;
  new.next_arrival := old.next_arrival; new.next_arrival_time := old.next_arrival_time;
  new.next_guests := old.next_guests; new.extras_setup := old.extras_setup;
  new.extras_collect := old.extras_collect; new.hk_note := old.hk_note;
  new.created_by := old.created_by; new.created_at := old.created_at;
  return new;
end $$;
create or replace trigger beehive_tasks_guard before update on public.beehive_tasks
  for each row execute function public.beehive_tasks_guard();

alter table public.beehive_tasks enable row level security;
revoke all on table public.beehive_tasks from anon;
create policy beehive_tasks_staff_select on public.beehive_tasks for select to authenticated
  using ((select public.beehive_is_staff()));
create policy beehive_tasks_staff_update on public.beehive_tasks for update to authenticated
  using ((select public.beehive_is_staff())) with check ((select public.beehive_is_staff()));
create policy beehive_tasks_owner_insert on public.beehive_tasks for insert to authenticated
  with check ((select public.beehive_is_owner()));
create policy beehive_tasks_owner_delete on public.beehive_tasks for delete to authenticated
  using ((select public.beehive_is_owner()));

-- Issues (maintenance) -----------------------------------------------------
create table if not exists public.beehive_issues (
  id uuid primary key default gen_random_uuid(),
  apartment_id text references public.beehive_apartments(id),
  category text not null default 'maintenance' check (category in
    ('maintenance','electrical','plumbing','appliance','hygiene','supplies','damage','missing','mess','other')),
  priority text not null default 'normal' check (priority in ('low','normal','urgent')),
  status text not null default 'open' check (status in ('open','resolved')),
  text text not null,
  booking_id uuid references public.beehive_bookings(id) on delete set null,
  task_id uuid references public.beehive_tasks(id) on delete set null,
  guest_name text,
  extra_hours numeric(5,2),
  reported_by uuid references auth.users(id) default auth.uid(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution text,
  cost int,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists beehive_issues_apartment_idx on public.beehive_issues(apartment_id);
create index if not exists beehive_issues_booking_idx on public.beehive_issues(booking_id);
create index if not exists beehive_issues_task_idx on public.beehive_issues(task_id);
create index if not exists beehive_issues_reported_by_idx on public.beehive_issues(reported_by);
create index if not exists beehive_issues_resolved_by_idx on public.beehive_issues(resolved_by);
create or replace trigger beehive_issues_updated_at before update on public.beehive_issues
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_issues enable row level security;
revoke all on table public.beehive_issues from anon;
create policy beehive_issues_staff_select on public.beehive_issues for select to authenticated
  using ((select public.beehive_is_staff()));
create policy beehive_issues_staff_insert on public.beehive_issues for insert to authenticated
  with check ((select public.beehive_is_staff()));
create policy beehive_issues_update on public.beehive_issues for update to authenticated
  using ((select public.beehive_is_owner()) or (reported_by = (select auth.uid()) and (select public.beehive_is_staff())))
  with check ((select public.beehive_is_owner()) or (reported_by = (select auth.uid()) and (select public.beehive_is_staff())));
create policy beehive_issues_owner_delete on public.beehive_issues for delete to authenticated
  using ((select public.beehive_is_owner()));

-- Periodic care ------------------------------------------------------------
create table if not exists public.beehive_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other' check (category in
    ('hygiene','airfilter','purifier','watertest','deepclean','acservice','pest','safety','other')),
  apartment_id text references public.beehive_apartments(id),
  every_days int not null check (every_days > 0),
  last_done date,
  last_result text,
  who text not null default 'housekeeper' check (who in ('housekeeper','technician','owner')),
  vendor text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid()
);
create index if not exists beehive_schedules_apartment_idx on public.beehive_schedules(apartment_id);
create index if not exists beehive_schedules_created_by_idx on public.beehive_schedules(created_by);
create or replace trigger beehive_schedules_updated_at before update on public.beehive_schedules
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_schedules enable row level security;
revoke all on table public.beehive_schedules from anon;
create policy beehive_schedules_staff_all on public.beehive_schedules for all to authenticated
  using ((select public.beehive_is_staff())) with check ((select public.beehive_is_staff()));

create table if not exists public.beehive_schedule_log (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.beehive_schedules(id) on delete cascade,
  apartment_id text references public.beehive_apartments(id),
  date date not null,
  result text,
  note text,
  cost int,
  done_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists beehive_schedule_log_schedule_idx on public.beehive_schedule_log(schedule_id);
create index if not exists beehive_schedule_log_apartment_idx on public.beehive_schedule_log(apartment_id);
create index if not exists beehive_schedule_log_done_by_idx on public.beehive_schedule_log(done_by);
create or replace trigger beehive_schedule_log_updated_at before update on public.beehive_schedule_log
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_schedule_log enable row level security;
revoke all on table public.beehive_schedule_log from anon;
create policy beehive_schedule_log_staff_all on public.beehive_schedule_log for all to authenticated
  using ((select public.beehive_is_staff())) with check ((select public.beehive_is_staff()));

-- Assets & inventory -------------------------------------------------------
create table if not exists public.beehive_assets (
  id uuid primary key default gen_random_uuid(),
  apartment_id text not null references public.beehive_apartments(id),
  name text not null,
  category text not null default 'other' check (category in
    ('appliance','electronics','furniture','linen','kitchen','bathroom','decor','safety','other')),
  room text,
  qty int not null default 1 check (qty >= 0),
  value int,
  count_on_checkout boolean not null default false,
  purchased date,
  warranty_until date,
  serial text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid()
);
create index if not exists beehive_assets_apartment_idx on public.beehive_assets(apartment_id);
create index if not exists beehive_assets_created_by_idx on public.beehive_assets(created_by);
create or replace trigger beehive_assets_updated_at before update on public.beehive_assets
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_assets enable row level security;
revoke all on table public.beehive_assets from anon;
create policy beehive_assets_staff_all on public.beehive_assets for all to authenticated
  using ((select public.beehive_is_staff())) with check ((select public.beehive_is_staff()));

-- Laundry ------------------------------------------------------------------
create table if not exists public.beehive_laundry (
  id uuid primary key default gen_random_uuid(),
  apartment_id text references public.beehive_apartments(id),
  vendor text,
  sent_date date not null,
  items_sent int not null default 0,
  details text,
  returned_date date,
  items_returned int,
  cost int,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users(id) default auth.uid()
);
create index if not exists beehive_laundry_apartment_idx on public.beehive_laundry(apartment_id);
create index if not exists beehive_laundry_created_by_idx on public.beehive_laundry(created_by);
create or replace trigger beehive_laundry_updated_at before update on public.beehive_laundry
  for each row execute function public.beehive_set_updated_at();
alter table public.beehive_laundry enable row level security;
revoke all on table public.beehive_laundry from anon;
create policy beehive_laundry_staff_all on public.beehive_laundry for all to authenticated
  using ((select public.beehive_is_staff())) with check ((select public.beehive_is_staff()));
