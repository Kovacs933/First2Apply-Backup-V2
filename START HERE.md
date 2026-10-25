# Start here — Foundation

This folder is the Foundation project. Open **this folder** in Claude next time.

## Where things are

- **Desktop**
  - **Foundation**: the app.
  - **Update Foundation online**: uploads backend changes (database + functions) and can set the AI key.
  - **Upload this**: the latest installer, ready to attach to a GitHub release.
- **Old versions** (Desktop): earlier copies of the project, not used any more.
- `launcher\shortcuts`: the one-off **Set up Foundation online** shortcut, plus Start/Stop for the local backend.
- `linkedin\`: logo, banner and text for the LinkedIn page.
- Website: https://kovacs933.github.io/Foundation/ (code in `website\`, publishes when pushed to GitHub).

## Releasing a new version

1. Claude builds it: `launcher\build-installer.ps1` makes `release\FoundationSetup.exe`.
2. GitHub Desktop: **Push origin**.
3. github.com/Kovacs933/Foundation/releases: **Draft a new release**, tag `vX.Y.Z`, attach
   `FoundationSetup.exe` (keep that exact name), **Publish release**. The website's Download button
   always gives the latest release.
4. If the backend changed: double-click **Update Foundation online** on the Desktop.

## Version 1.0.9 (25 Oct 2026)

CV Builder (AI or template, LinkedIn import, CV upload, PDF), Apply assistant for Saved jobs, posted dates,
closed-job check, Key details on every job, Search again, Custom job board, gold theme, better Feedback page.

Still to do by you: run **Update Foundation online** (turns on posted dates, closed-job checks, the new duplicate
rules and AI CV writing; paste an OpenRouter key to switch on the AI features).

More detail: `FOUNDATION.md`.
