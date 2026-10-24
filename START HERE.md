# Start here — Foundation

This folder is the Foundation project (saved 24 Oct 2026). Open **this folder** in Claude next
time. The old `first2apply-master` folder on the Desktop is an untouched backup of the same work.

## Where we left off

Done:
- UK job boards added (Reed, Totaljobs & CWJobs, CV-Library, Adzuna, NHS Jobs, GOV.UK Work Hub,
  CharityJob, jobs.ac.uk), US-only boards hidden, Indeed/Glassdoor switched to their UK sites.
- Renamed to Foundation with a new logo; "Search all UK boards" button on the Searches page.
- Windows installer builds (`release\FoundationSetup.exe`) and works **on this PC only**.

Next step — put the backend online so the installer works on other computers:
1. Double-click **Set up Foundation online** on the Desktop.
2. Paste a Supabase access token (the window explains how, the browser opens the right page).
3. Wait for **ALL DONE** (about 10 minutes). It creates a Supabase organisation and project
   (London), the database, the functions, and rebuilds `release\FoundationSetup.exe`.
4. Tell Claude: "the setup said ALL DONE, test the installer".

Last attempt stopped because the Supabase account had no organisation; the setup now creates one
automatically.

After that, in the Supabase dashboard > Authentication > URL Configuration, add `first2apply://**`
to Redirect URLs (needed for password-reset links).

## Shortcuts on the Desktop

- **Start Foundation** — starts the local server and opens the app (this PC).
- **Stop Foundation** — closes it all.
- **Set up Foundation online** — the one-off online setup above.

More detail: `FOUNDATION.md`.
