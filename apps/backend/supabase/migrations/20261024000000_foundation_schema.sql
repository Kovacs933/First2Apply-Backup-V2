

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."Job Status" AS ENUM (
    'new',
    'applied',
    'archived',
    'processing',
    'excluded_by_advanced_matching',
    'deleted'
);


ALTER TYPE "public"."Job Status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_chatgpt_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" integer, "output_tokens_increment" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update public.advanced_matching
  set 
    ai_api_cost = ai_api_cost + cost_increment, 
    ai_api_input_tokens_used = ai_api_input_tokens_used + input_tokens_increment, 
    ai_api_output_tokens_used = ai_api_output_tokens_used + output_tokens_increment
  where user_id = for_user_id;
end;
$$;


ALTER FUNCTION "public"."count_chatgpt_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" integer, "output_tokens_increment" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_jobs"("jobs_status" "public"."Job Status" DEFAULT NULL::"public"."Job Status", "jobs_search" "text" DEFAULT NULL::"text", "jobs_site_ids" integer[] DEFAULT NULL::integer[], "jobs_link_ids" integer[] DEFAULT NULL::integer[], "jobs_labels" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("status" "public"."Job Status", "job_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select j.status, count(*) as job_count
  from jobs j
  where user_id = auth.uid()
    and (jobs_status is null or j.status = jobs_status)
    and (array_length(jobs_site_ids, 1) is null or j."siteId" = any(jobs_site_ids))
    and (array_length(jobs_link_ids, 1) is null or j.link_id = any(jobs_link_ids))
    and (array_length(jobs_labels, 1) is null or labels && jobs_labels)
    and (jobs_search is null or j.job_search_vector @@ plainto_tsquery('english', jobs_search))
  group by j.status
  order by j.status;
end; 
$$;


ALTER FUNCTION "public"."count_jobs"("jobs_status" "public"."Job Status", "jobs_search" "text", "jobs_site_ids" integer[], "jobs_link_ids" integer[], "jobs_labels" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("email" "text") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
begin
  return query select au.id from auth.users au where au.email = $1;
end;
$_$;


ALTER FUNCTION "public"."get_user_id_by_email"("email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "externalId" "text" NOT NULL,
    "externalUrl" "text" NOT NULL,
    "siteId" bigint NOT NULL,
    "title" "text" NOT NULL,
    "companyName" "text" NOT NULL,
    "companyLogo" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "salary" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "jobType" "text",
    "status" "public"."Job Status" DEFAULT 'new'::"public"."Job Status" NOT NULL,
    "description" "text",
    "labels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "link_id" bigint,
    "exclude_reason" "text",
    "job_search_vector" "tsvector"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


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


ALTER FUNCTION "public"."list_jobs"("jobs_status" "public"."Job Status", "jobs_after" "text", "jobs_page_size" integer, "jobs_search" "text", "jobs_site_ids" integer[], "jobs_link_ids" integer[], "jobs_labels" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_ai_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" bigint, "output_tokens_increment" bigint) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.ai_usage_daily (user_id, usage_date, cost, input_tokens, output_tokens)
  values (for_user_id, current_date, cost_increment, input_tokens_increment, output_tokens_increment)
  on conflict (user_id, usage_date)
  do update set
    cost = public.ai_usage_daily.cost + excluded.cost,
    input_tokens = public.ai_usage_daily.input_tokens + excluded.input_tokens,
    output_tokens = public.ai_usage_daily.output_tokens + excluded.output_tokens,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."log_ai_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" bigint, "output_tokens_increment" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Update the job_search_vector column with weighted tsvector values
  new.job_search_vector := 
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new."companyName", '')), 'B');
  return new;
end;
$$;


ALTER FUNCTION "public"."update_job_search_vector"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advanced_matching" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "blacklisted_companies" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "chatgpt_prompt" "text" DEFAULT ''::"text" NOT NULL,
    "ai_api_cost" double precision DEFAULT '0'::double precision NOT NULL,
    "ai_api_input_tokens_used" double precision DEFAULT '0'::double precision NOT NULL,
    "ai_api_output_tokens_used" double precision DEFAULT '0'::double precision NOT NULL
);


ALTER TABLE "public"."advanced_matching" OWNER TO "postgres";


ALTER TABLE "public"."advanced_matching" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."advanced_matching_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ai_usage_daily" (
    "user_id" "uuid" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "cost" numeric DEFAULT 0 NOT NULL,
    "input_tokens" bigint DEFAULT 0 NOT NULL,
    "output_tokens" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_usage_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."html_dumps" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "url" "text" NOT NULL,
    "html" "text" NOT NULL,
    "webpage_runtime_data" "jsonb"
);


ALTER TABLE "public"."html_dumps" OWNER TO "postgres";


ALTER TABLE "public"."html_dumps" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."html_dumps_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."jobs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."links" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "url" "text" NOT NULL,
    "title" "text" NOT NULL,
    "site_id" bigint NOT NULL,
    "scrape_failure_count" integer DEFAULT 0 NOT NULL,
    "last_scraped_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "scrape_failure_email_sent" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."links" OWNER TO "postgres";


ALTER TABLE "public"."links" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."links_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "text" "text" NOT NULL,
    "files" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "job_id" bigint NOT NULL
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


ALTER TABLE "public"."notes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "subscription_end_date" timestamp without time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "subscription_tier" "text" DEFAULT 'basic'::"text" NOT NULL,
    "is_trial" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE "public"."profiles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."profiles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "rating" integer NOT NULL
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


ALTER TABLE "public"."reviews" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."reviews_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sites" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "urls" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "queryParamsToRemove" "text"[],
    "logo_url" "text" NOT NULL,
    "blacklisted_paths" "text"[] DEFAULT '{/}'::"text"[] NOT NULL,
    "provider" "text" NOT NULL,
    "deprecated" boolean DEFAULT false NOT NULL,
    "incognito_support" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."sites" OWNER TO "postgres";


ALTER TABLE "public"."sites" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sites_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."v_ai_usage_last_30d" AS
 SELECT "d"."user_id",
    COALESCE("sum"("d"."cost"), (0)::numeric) AS "cost_last_30d",
    (COALESCE("sum"("d"."input_tokens"), (0)::numeric))::bigint AS "input_tokens_last_30d",
    (COALESCE("sum"("d"."output_tokens"), (0)::numeric))::bigint AS "output_tokens_last_30d"
   FROM "public"."ai_usage_daily" "d"
  WHERE ("d"."usage_date" >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY "d"."user_id";


ALTER TABLE "public"."v_ai_usage_last_30d" OWNER TO "postgres";


ALTER TABLE ONLY "public"."advanced_matching"
    ADD CONSTRAINT "advanced_matching_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advanced_matching"
    ADD CONSTRAINT "advanced_matching_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("user_id", "usage_date");



ALTER TABLE ONLY "public"."html_dumps"
    ADD CONSTRAINT "html_dumps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_user_id_externalid_key" UNIQUE ("user_id", "externalId");



ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "unique_user_review" UNIQUE ("user_id");



CREATE INDEX "jobs_user_id_updated_at_id_status_idx" ON "public"."jobs" USING "btree" ("user_id", "updated_at" DESC, "id" DESC, "status");



CREATE OR REPLACE TRIGGER "trigger_update_job_search_vector" BEFORE INSERT OR UPDATE OF "title", "companyName" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_job_search_vector"();



ALTER TABLE ONLY "public"."advanced_matching"
    ADD CONSTRAINT "advanced_matching_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE RESTRICT ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_siteid_fkey" FOREIGN KEY ("siteId") REFERENCES "public"."sites"("id") ON UPDATE RESTRICT ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON UPDATE RESTRICT ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "public_jobs_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE "public"."advanced_matching" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enable all for users based on user_id" ON "public"."advanced_matching" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "enable all for users based on user_id" ON "public"."html_dumps" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "enable all for users based on user_id" ON "public"."jobs" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "enable all for users based on user_id" ON "public"."links" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "enable all for users based on user_id" ON "public"."notes" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "enable insert reviews for authenticated users only" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "enable select for authenticated users only" ON "public"."sites" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "enable select profiles for authenticated users only" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "enable select reviews for authenticated users only" ON "public"."reviews" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "enable update reviews for authenticated users only" ON "public"."reviews" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."html_dumps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."count_chatgpt_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" integer, "output_tokens_increment" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."count_chatgpt_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" integer, "output_tokens_increment" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_chatgpt_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" integer, "output_tokens_increment" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."count_jobs"("jobs_status" "public"."Job Status", "jobs_search" "text", "jobs_site_ids" integer[], "jobs_link_ids" integer[], "jobs_labels" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."count_jobs"("jobs_status" "public"."Job Status", "jobs_search" "text", "jobs_site_ids" integer[], "jobs_link_ids" integer[], "jobs_labels" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_jobs"("jobs_status" "public"."Job Status", "jobs_search" "text", "jobs_site_ids" integer[], "jobs_link_ids" integer[], "jobs_labels" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON FUNCTION "public"."list_jobs"("jobs_status" "public"."Job Status", "jobs_after" "text", "jobs_page_size" integer, "jobs_search" "text", "jobs_site_ids" integer[], "jobs_link_ids" integer[], "jobs_labels" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."list_jobs"("jobs_status" "public"."Job Status", "jobs_after" "text", "jobs_page_size" integer, "jobs_search" "text", "jobs_site_ids" integer[], "jobs_link_ids" integer[], "jobs_labels" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_jobs"("jobs_status" "public"."Job Status", "jobs_after" "text", "jobs_page_size" integer, "jobs_search" "text", "jobs_site_ids" integer[], "jobs_link_ids" integer[], "jobs_labels" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_ai_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" bigint, "output_tokens_increment" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."log_ai_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" bigint, "output_tokens_increment" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_ai_usage"("for_user_id" "uuid", "cost_increment" numeric, "input_tokens_increment" bigint, "output_tokens_increment" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_job_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_job_search_vector"() TO "service_role";


















GRANT ALL ON TABLE "public"."advanced_matching" TO "anon";
GRANT ALL ON TABLE "public"."advanced_matching" TO "authenticated";
GRANT ALL ON TABLE "public"."advanced_matching" TO "service_role";



GRANT ALL ON SEQUENCE "public"."advanced_matching_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."advanced_matching_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."advanced_matching_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_daily" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_daily" TO "service_role";



GRANT ALL ON TABLE "public"."html_dumps" TO "anon";
GRANT ALL ON TABLE "public"."html_dumps" TO "authenticated";
GRANT ALL ON TABLE "public"."html_dumps" TO "service_role";



GRANT ALL ON SEQUENCE "public"."html_dumps_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."html_dumps_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."html_dumps_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."links" TO "anon";
GRANT ALL ON TABLE "public"."links" TO "authenticated";
GRANT ALL ON TABLE "public"."links" TO "service_role";



GRANT ALL ON SEQUENCE "public"."links_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."links_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."links_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profiles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reviews_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sites" TO "anon";
GRANT ALL ON TABLE "public"."sites" TO "authenticated";
GRANT ALL ON TABLE "public"."sites" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sites_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sites_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sites_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_ai_usage_last_30d" TO "anon";
GRANT ALL ON TABLE "public"."v_ai_usage_last_30d" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ai_usage_last_30d" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";
































-- not part of the public schema dump: creates a profile row (7 day trial) for every new account
CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();
