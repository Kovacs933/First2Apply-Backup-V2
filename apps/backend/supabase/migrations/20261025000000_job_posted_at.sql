-- When the job board says a job was posted (read from the search results card), so the app can show
-- "Posted 3 days ago" instead of only when Foundation found it.
alter table "public"."jobs" add column if not exists "postedAt" timestamp with time zone;

-- list_jobs returns whole job rows, so it has to list the new column too (in table order: it's last)
CREATE OR REPLACE FUNCTION "public"."list_jobs"("jobs_status" "public"."Job Status", "jobs_after" "text", "jobs_page_size" integer, "jobs_search" "text" DEFAULT NULL::"text", "jobs_site_ids" integer[] DEFAULT NULL::integer[], "jobs_link_ids" integer[] DEFAULT NULL::integer[], "jobs_labels" "text"[] DEFAULT NULL::"text"[]) RETURNS SETOF "public"."jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    null::tsvector as job_search_vector,
    j."postedAt"
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
