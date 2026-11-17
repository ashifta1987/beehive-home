-- Beehive Home · production seed (SPEC § 10). Safe to run once; uses on conflict / not exists.

insert into public.beehive_apartments (id, name, code, sort, tag_colour, location, bedrooms, features,
  check_in_time, check_out_time, cleaning_checklist, arrival_checklist, house_rules, welcome_message)
values
('apt-1bhk', '1 Bedroom Apartment', '1BHK', 1, 'tag1', 'Panampilly Nagar, Kochi', 1,
  array['Air conditioning','Attached bathroom','Small pantry'], '14:00', '11:00',
  array[
    'Strip the bed and put on fresh linen',
    'Fresh bath and hand towels',
    'Clean and disinfect bathroom, toilet and shower',
    'Wipe pantry counter, sink, kettle and microwave',
    'Empty leftovers from the fridge and wipe the shelves',
    'Sweep and mop all floors',
    'Dust surfaces, switches, remotes and door handles',
    'Empty and wash bins, put new liners',
    'Check AC, lights, fans, TV and Wi-Fi work',
    'Restock toiletries, tissue and drinking water',
    'Lock windows, switch off lights and AC, send photos to owner'],
  array[
    'Collect photo ID of every adult guest',
    'Foreign guests: copy of passport photo page and visa',
    'Hand over keys and note how many sets',
    'Show AC remote, water purifier and Wi-Fi details',
    'Share house rules and your phone number'],
  array[
    'No smoking inside the apartment',
    'Quiet hours 10 PM to 7 AM, no parties',
    'Only registered guests stay overnight',
    'Switch off AC and lights when you go out',
    'Check out by 11 AM on your last day',
    'Missing items, damage or a very messy room are charged extra'],
  'Hello {guest}, welcome to Beehive Home! Your stay at our {apartment} in Panampilly Nagar, Kochi is confirmed for {checkin} to {checkout}. Check-in is from {checkinTime} and check-out is by {checkoutTime}. Please send a photo ID for each adult before arrival. Message me here anytime if you need anything.'),
('apt-2bhk', '2 Bedroom Apartment', '2BHK', 2, 'tag2', 'Panampilly Nagar, Kochi', 2,
  array['Air conditioning','Attached bathroom','Hall','Pantry'], '14:00', '11:00',
  array[
    'Strip both beds and put on fresh linen',
    'Fresh bath and hand towels',
    'Clean and disinfect bathroom, toilet and shower',
    'Hall: wipe table, arrange sofa and cushions',
    'Wipe pantry counter, sink, kettle and microwave',
    'Empty leftovers from the fridge and wipe the shelves',
    'Sweep and mop all floors',
    'Dust surfaces, switches, remotes and door handles',
    'Empty and wash bins, put new liners',
    'Check AC, lights, fans, TV and Wi-Fi work',
    'Restock toiletries, tissue and drinking water',
    'Lock windows, switch off lights and AC, send photos to owner'],
  array[
    'Collect photo ID of every adult guest',
    'Foreign guests: copy of passport photo page and visa',
    'Hand over keys and note how many sets',
    'Show AC remote, water purifier and Wi-Fi details',
    'Share house rules and your phone number'],
  array[
    'No smoking inside the apartment',
    'Quiet hours 10 PM to 7 AM, no parties',
    'Only registered guests stay overnight',
    'Switch off AC and lights when you go out',
    'Check out by 11 AM on your last day',
    'Missing items, damage or a very messy room are charged extra'],
  'Hello {guest}, welcome to Beehive Home! Your stay at our {apartment} in Panampilly Nagar, Kochi is confirmed for {checkin} to {checkout}. Check-in is from {checkinTime} and check-out is by {checkoutTime}. Please send a photo ID for each adult before arrival. Message me here anytime if you need anything.')
on conflict (id) do nothing;

-- Periodic care, one row per apartment
insert into public.beehive_schedules (name, category, apartment_id, every_days, who, created_by)
select s.name, s.category, a.id, s.every_days, s.who, null
from (values
  ('Hygiene inspection', 'hygiene', 7, 'housekeeper'),
  ('Clean AC filters', 'airfilter', 30, 'housekeeper'),
  ('Water purifier check', 'purifier', 90, 'technician'),
  ('Deep clean', 'deepclean', 90, 'housekeeper'),
  ('Pest control', 'pest', 90, 'technician'),
  ('AC service', 'acservice', 180, 'technician'),
  ('Water quality test', 'watertest', 180, 'technician'),
  ('Safety check', 'safety', 180, 'owner')
) as s(name, category, every_days, who)
cross join public.beehive_apartments a
where a.id in ('apt-1bhk','apt-2bhk')
  and not exists (select 1 from public.beehive_schedules x where x.name = s.name and x.apartment_id = a.id);

-- Paid extras catalog (prices not set — owner fills in)
insert into public.beehive_extras (name, price, unit, return_check, active)
select e.name, null, e.unit, e.return_check, e.active
from (values
  ('Air fryer', 'day', true, true),
  ('BBQ maker', 'use', true, true),
  ('Party hall', 'hour', false, true),
  ('Extra cleaning (room left messy)', 'event', false, false)
) as e(name, unit, return_check, active)
where not exists (select 1 from public.beehive_extras x where x.name = e.name);


-- Door keys for the QR posters (random; rotate from the Posters page)
insert into public.beehive_door_keys (apartment, label, door_key)
select a.id, a.code, encode(extensions.gen_random_bytes(12), 'hex')
from public.beehive_apartments a
where a.id in ('apt-1bhk','apt-2bhk')
on conflict (apartment) do nothing;
