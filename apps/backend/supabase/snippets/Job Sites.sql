create or replace function list_jobs(
    jobs_status "Job Status", 
    jobs_after text, 
    jobs_page_size integer, 
    jobs_search text default null,
    jobs_site_ids integer[] default null,
    jobs_link_ids integer[] default null,
    jobs_labels text[] default null
)
returns setof jobs 
language plpgsql
security definer set search_path = public
as $$
declare
  after_id integer;
  after_updated_at timestamp;
begin
  if jobs_after is not null then
    after_id := split_part(jobs_after, '!', 1)::integer;
    after_updated_at := split_part(jobs_after, '!', 2)::timestamp;
  end if;

  return query
    select
    j.id,
    j.user_id,
    j."externalId",
    j."externalUrl",
    j."siteId",
    j.title,
    j."companyName",
    j."companyLogo",
    j.location,
    j.created_at,
    j.updated_at,
    j.salary,
    j.tags,
    j."jobType",
    j.status,
    null::text as description,
    j.labels,
    j.link_id,
    j.exclude_reason,
    null::tsvector as job_search_vector
  from jobs j
  where user_id = auth.uid()
    and status = jobs_status
    and (jobs_after is null or (updated_at, id) < (after_updated_at, after_id))
    and (array_length(jobs_site_ids, 1) is null or "siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or labels && jobs_labels)
    and (jobs_search is null or job_search_vector @@ plainto_tsquery('english', jobs_search))
  order by updated_at desc, id desc
  limit jobs_page_size;
end;
$$;