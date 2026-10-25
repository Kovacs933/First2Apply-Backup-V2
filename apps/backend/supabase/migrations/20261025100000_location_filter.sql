-- Location filter (no AI): only show UK jobs, and optionally only jobs within a distance of a town or postcode
alter table public.advanced_matching
  add column if not exists uk_only boolean not null default false,
  add column if not exists location_center text not null default '',
  add column if not exists location_radius_miles integer;
