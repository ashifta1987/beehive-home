-- Beehive Home · advisor fixes (security definer functions out of the exposed API schema)
-- Supabase advisors flagged SECURITY DEFINER functions in `public` that API roles can call.
-- Pattern: the privileged code lives in a schema PostgREST does not expose
-- (beehive_private); `public` keeps thin SECURITY INVOKER wrappers with the same names,
-- so RLS policies and the app keep working unchanged.

create schema if not exists beehive_private;
revoke all on schema beehive_private from public;
grant usage on schema beehive_private to anon, authenticated, service_role;

-- Role helpers -------------------------------------------------------------
create or replace function beehive_private.is_owner()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.beehive_staff
    where user_id = (select auth.uid()) and role = 'owner' and active
  );
$$;

create or replace function beehive_private.is_staff()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.beehive_staff
    where user_id = (select auth.uid()) and active
  );
$$;

revoke all on function beehive_private.is_owner() from public, anon;
revoke all on function beehive_private.is_staff() from public, anon;
grant execute on function beehive_private.is_owner() to authenticated, service_role;
grant execute on function beehive_private.is_staff() to authenticated, service_role;

create or replace function public.beehive_is_owner()
returns boolean language sql stable security invoker
set search_path = ''
as $$ select beehive_private.is_owner() $$;

create or replace function public.beehive_is_staff()
returns boolean language sql stable security invoker
set search_path = ''
as $$ select beehive_private.is_staff() $$;

revoke all on function public.beehive_is_owner() from public, anon;
revoke all on function public.beehive_is_staff() from public, anon;
grant execute on function public.beehive_is_owner() to authenticated, service_role;
grant execute on function public.beehive_is_staff() to authenticated, service_role;

-- Guest functions ----------------------------------------------------------
-- Intentionally callable without signing in (the door QR), but only by `anon`
-- (the app's guest routes use a session-less anon client). The definer bodies move to
-- beehive_private; public wrappers are SECURITY INVOKER.
alter function public.beehive_guest_apartment(text, text) set schema beehive_private;
alter function beehive_private.beehive_guest_apartment(text, text) rename to guest_apartment;
alter function public.beehive_guest_submit(jsonb) set schema beehive_private;
alter function beehive_private.beehive_guest_submit(jsonb) rename to guest_submit;

revoke all on function beehive_private.guest_apartment(text, text) from public, authenticated;
revoke all on function beehive_private.guest_submit(jsonb) from public, authenticated;
grant execute on function beehive_private.guest_apartment(text, text) to anon, service_role;
grant execute on function beehive_private.guest_submit(jsonb) to anon, service_role;

create or replace function public.beehive_guest_apartment(p_apartment text, p_key text)
returns jsonb language sql stable security invoker
set search_path = ''
as $$ select beehive_private.guest_apartment(p_apartment, p_key) $$;

create or replace function public.beehive_guest_submit(p jsonb)
returns jsonb language sql volatile security invoker
set search_path = ''
as $$ select beehive_private.guest_submit(p) $$;

revoke all on function public.beehive_guest_apartment(text, text) from public, authenticated;
revoke all on function public.beehive_guest_submit(jsonb) from public, authenticated;
grant execute on function public.beehive_guest_apartment(text, text) to anon, service_role;
grant execute on function public.beehive_guest_submit(jsonb) to anon, service_role;
