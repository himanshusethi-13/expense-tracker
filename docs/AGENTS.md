<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# Additional rules for Agensts

All project documentation created by the developer is located in /docs except README, which is located in the root folder.

## Before building a feature

Before implementing this feature, read:
- docs/SECURITY.md
- docs/CODE_STYLE.md
- docs/DATABASE.md
- docs/API.md

Then inspect the existing codebase for relevant patterns.

Build the feature using the existing project conventions. Do not invent
new database models, API patterns, dependencies or security rules unless
they are required. If the documentation conflicts with the existing
implementation, flag the conflict before making a major change.

## When changing the database

Read DATABASE.md and SECURITY.md first.

I need to add [FEATURE].

Before coding:
1. Identify which models/tables need to change.
2. Explain the proposed relationship and constraints.
3. Identify whether a migration is required.
4. Check whether the change affects authorization or sensitive data.
5. Then implement it using the existing database conventions.

## When adding an API endpoint

Read API.md and SECURITY.md first.

Create an endpoint for [FEATURE].
Follow the existing response/error format.
Validate all inputs.
Apply authentication and authorization where required.
Do not expose internal errors or secrets.
Update API.md if this introduces a new public project convention.


<!-- END:nextjs-agent-rules -->
