-- Job boards shown under "Add Search".
-- Safe to run more than once: existing rows are updated in place.
-- Boards are never deleted (saved searches and jobs reference them); boards we no longer
-- support are marked deprecated, which hides them in the app and stops them being scanned.

INSERT INTO public.sites (id, name, urls, created_at, "queryParamsToRemove", logo_url, blacklisted_paths, provider, deprecated, incognito_support) VALUES
-- worldwide boards (the UK version opens first)
(1, 'LinkedIn', ARRAY['https://www.linkedin.com']::text[], '2024-01-20 15:02:02.723394+00', ARRAY['currentJobId']::text[], 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/linkedin.png', ARRAY['/','/jobs/','/feed/']::text[], 'linkedin', false, true),
(2, 'Glassdoor', ARRAY['https://www.glassdoor.co.uk','https://www.glassdoor.com','https://www.glassdoor.it']::text[], '2024-01-20 15:04:01.815691+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/glassdoor.png', ARRAY['/','/index.htm/','/job/index.htm/']::text[], 'glassdoor', false, false),
(3, 'Indeed', ARRAY['https://uk.indeed.com','https://www.indeed.com']::text[], '2024-01-20 15:04:34.53859+00', ARRAY['vjk']::text[], 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/indeed.png', ARRAY['/']::text[], 'indeed', false, false),
(4, 'Remote OK', ARRAY['https://remoteok.com']::text[], '2024-01-20 15:05:42.908282+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/remoteok.png', ARRAY['/']::text[], 'remoteok', false, false),
(5, 'We Work Remotely', ARRAY['https://weworkremotely.com']::text[], '2024-01-20 15:06:51.637899+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/weworkremotely.png', ARRAY['/']::text[], 'weworkremotely', false, false),
(10, 'Remotive', ARRAY['https://remotive.com']::text[], '2024-02-29 20:19:10.0231+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/remotive.png', ARRAY[]::text[], 'remotive', false, false),
(14, 'Robert Half', ARRAY['https://www.roberthalf.com/gb/en','https://www.roberthalf.com']::text[], '2024-03-10 15:59:51.175727+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/robert-half.png', ARRAY['/','/us/en/','/gb/en/']::text[], 'robertHalf', false, false),
(17, 'Custom Job Board', ARRAY['https://google.com/']::text[], '2025-08-29 10:21:22.12473+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/custom.png', ARRAY['/']::text[], 'custom', false, false),
(18, 'Hiring Cafe', ARRAY['https://hiring.cafe']::text[], '2026-05-10 09:00:00+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/hiringcafe.svg', ARRAY[]::text[], 'hiringCafe', false, false),

-- US-only (or other country) boards, no longer offered
(6, 'Dice', ARRAY['https://www.dice.com']::text[], '2024-02-18 21:24:51.005635+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/dice.png', ARRAY['/']::text[], 'dice', true, false),
(7, 'Flexjobs', ARRAY['https://www.flexjobs.com']::text[], '2024-02-19 18:47:19.776765+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/flexjobs.png', ARRAY['/']::text[], 'flexjobs', true, false),
(8, 'Bestjobs', ARRAY['https://www.bestjobs.eu']::text[], '2024-02-20 20:11:05.704758+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/bestjobs.png', ARRAY['/']::text[], 'bestjobs', true, false),
(9, 'Echojobs', ARRAY['https://echojobs.io']::text[], '2024-02-26 21:00:37.631948+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/echojobs.png', ARRAY['/']::text[], 'echojobs', true, false),
(11, 'Remoteio', ARRAY['https://www.remote.io']::text[], '2024-03-02 19:41:10.646411+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/remoteio.png', ARRAY['/']::text[], 'remoteio', true, false),
(12, 'Builtin', ARRAY['https://builtin.com/']::text[], '2024-03-02 20:35:38.822484+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/builtin.png', ARRAY['/']::text[], 'builtin', true, false),
(13, 'Naukri', ARRAY['https://www.naukri.com']::text[], '2024-03-02 22:05:48.946062+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/naukri.png', ARRAY['/']::text[], 'naukri', true, false),
(15, 'ZipRecruiter', ARRAY['https://www.ziprecruiter.com']::text[], '2024-10-08 19:18:46.060992+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/ziprecruiter.png', ARRAY['/']::text[], 'zipRecruiter', true, false),
(16, 'USA Jobs', ARRAY['https://www.usajobs.gov']::text[], '2024-10-08 20:05:31.819605+00', NULL, 'https://vnawaforiamopaudfefi.supabase.co/storage/v1/object/public/first2apply-public/usajobs.png', ARRAY['/']::text[], 'usaJobs', true, false),

-- UK boards
(19, 'Reed', ARRAY['https://www.reed.co.uk']::text[], '2026-10-24 12:00:00+00', ARRAY['sid']::text[], 'https://www.google.com/s2/favicons?domain=reed.co.uk&sz=128', ARRAY['/','/jobs']::text[], 'reed', false, false),
(20, 'Totaljobs & CWJobs', ARRAY['https://www.totaljobs.com','https://www.cwjobs.co.uk']::text[], '2026-10-24 12:00:00+00', NULL, 'https://icons.duckduckgo.com/ip3/www.totaljobs.com.ico', ARRAY['/']::text[], 'totaljobs', false, false),
(21, 'CV-Library', ARRAY['https://www.cv-library.co.uk']::text[], '2026-10-24 12:00:00+00', ARRAY['jobId','search_id']::text[], 'https://www.google.com/s2/favicons?domain=cv-library.co.uk&sz=128', ARRAY['/']::text[], 'cvLibrary', false, false),
(22, 'Adzuna', ARRAY['https://www.adzuna.co.uk']::text[], '2026-10-24 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=adzuna.co.uk&sz=128', ARRAY['/']::text[], 'adzuna', false, false),
(23, 'NHS Jobs', ARRAY['https://www.jobs.nhs.uk/candidate']::text[], '2026-10-24 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=www.jobs.nhs.uk&sz=128', ARRAY['/','/candidate','/candidate/search']::text[], 'nhsJobs', false, false),
(24, 'GOV.UK Find a Job (Work Hub)', ARRAY['https://www.jobs.service.gov.uk/jobs']::text[], '2026-10-24 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=gov.uk&sz=128', ARRAY['/','/jobs']::text[], 'workHub', false, false),
(25, 'CharityJob', ARRAY['https://www.charityjob.co.uk']::text[], '2026-10-24 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=charityjob.co.uk&sz=128', ARRAY['/']::text[], 'charityJob', false, false),
(26, 'jobs.ac.uk', ARRAY['https://www.jobs.ac.uk']::text[], '2026-10-24 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=jobs.ac.uk&sz=128', ARRAY['/']::text[], 'jobsAcUk', false, false),
-- a single employer's vacancies page (Leeds college and charity); replaced by MyNewTerm, where all its jobs are posted
(27, 'Lighthouse Futures Trust', ARRAY['https://lighthousefuturestrust.org.uk/vacancies-2/']::text[], '2026-10-26 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=lighthousefuturestrust.org.uk&sz=128', ARRAY['/']::text[], 'lighthouseFuturesTrust', true, false),
-- schools, colleges and academy trusts
(28, 'MyNewTerm', ARRAY['https://mynewterm.com/search']::text[], '2026-10-29 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=mynewterm.com&sz=128', ARRAY['/']::text[], 'myNewTerm', false, false),
(29, 'Gumtree Jobs', ARRAY['https://www.gumtree.com/jobs']::text[], '2026-10-29 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=gumtree.com&sz=128', ARRAY['/','/jobs']::text[], 'gumtree', false, false),
(30, 'SimplyHired', ARRAY['https://www.simplyhired.co.uk']::text[], '2026-10-29 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=simplyhired.co.uk&sz=128', ARRAY['/']::text[], 'simplyHired', false, false),
-- Leeds charity and voluntary sector jobs (VAL); it replaced Doing Good Leeds, whose jobs page now redirects here
(31, 'Voluntary Action Leeds', ARRAY['https://val.org.uk/jobs/']::text[], '2026-10-29 12:00:00+00', NULL, 'https://www.google.com/s2/favicons?domain=val.org.uk&sz=128', ARRAY['/','/jobs']::text[], 'doingGoodLeeds', false, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  urls = EXCLUDED.urls,
  "queryParamsToRemove" = EXCLUDED."queryParamsToRemove",
  logo_url = EXCLUDED.logo_url,
  blacklisted_paths = EXCLUDED.blacklisted_paths,
  provider = EXCLUDED.provider,
  deprecated = EXCLUDED.deprecated,
  incognito_support = EXCLUDED.incognito_support;

-- the rows above use fixed ids, so move the id counter past them
SELECT setval(pg_get_serial_sequence('public.sites', 'id'), (SELECT max(id) FROM public.sites));
