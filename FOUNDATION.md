# Foundation

Foundation is a UK-focused fork of First 2 Apply. It watches your saved job searches on UK job
boards and alerts you to new jobs.

## Everyday use (this PC)

- **Start Foundation** (Desktop / Start menu): starts Docker, the local database and the backend
  functions in the background, then opens the installed Foundation app.
- **Stop Foundation**: closes the app and stops everything.
- Developer mode (function logs, web dashboard, app from source):
  `powershell -ExecutionPolicy Bypass -File launcher\start.ps1 -Dev`

## Windows installer

`launcher\build-installer.ps1` builds `release\FoundationSetup.exe` (installs per user, no admin
rights, adds Desktop and Start menu shortcuts, uninstalls from Windows Settings > Apps).

**For other computers you need a hosted backend.** The backend address is baked in at build time.
With no parameters the installer talks to `http://localhost:54321`, which only exists on this PC.

1. Create a project at supabase.com (region: London), noting its database password.
2. Run `.\launcher\deploy-backend.ps1 -ProjectRef <ref>`. It logs in, creates the tables
   (`supabase\migrations\`) and job boards (`supabase\sites.sql`), uploads the secrets from
   `supabase\functions\.env`, deploys the functions and builds the installer against the project.
3. In the Supabase dashboard > Authentication > URL Configuration, add `foundation://**` to
   Redirect URLs (password-reset links open the app with it) and set Site URL to your website.
4. Put `release\FoundationSetup.exe` on the website as the Windows download.

`supabase\seed.sql` is the old schema and is no longer used; the tables come from the migration,
which was exported from the working local database.

The installer isn't code-signed, so Windows SmartScreen will show "Windows protected your PC"
(More info > Run anyway) until you sign it with a code-signing certificate.

## Job boards

UK boards (parsers in `apps\backend\supabase\functions\_shared\parsers\ukBoards.ts`): Reed,
Totaljobs & CWJobs, CV-Library, Adzuna, NHS Jobs, GOV.UK Find a Job (Work Hub), CharityJob,
jobs.ac.uk. Indeed, Glassdoor and Robert Half open their UK sites; LinkedIn, Remote OK,
We Work Remotely, Remotive and Hiring Cafe are kept as international boards.

US-only boards (Dice, FlexJobs, Built In, Remote.io, ZipRecruiter, USAJobs) are marked
`deprecated` in `apps\backend\supabase\sites.sql`, which hides them and stops scanning them.
Re-run that file against a database after editing it.

"Search all UK boards" (Searches page) saves one job title + location on every ticked board at
once; the search addresses are built in `apps\desktopProbe\src\lib\boardSearchUrls.ts`.

## Things still pointing at First 2 Apply / to set up yourself

- Payments are off: `apps\desktopProbe\src\server\stripeConfig.ts` has empty links (the old ones
  paid First 2 Apply's Stripe account). While empty, subscriptions never expire.
- Auto-updates are off until `UPDATE_FEED_URL` is set in `apps\desktopProbe\.env`.
- Emails are sent as `contact@first2apply.com` (`post-scan-hook`); the Help page also shows it.
- Logo source: `apps\desktopProbe\packagers\icons\foundation.svg`; regenerate every icon with
  `npx electron packagers/icons/generate-icons.js` from `apps\desktopProbe`.
