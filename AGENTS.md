# PENSO - Prancheta Eletrônica

## Overview
Static HTML/CSS/JS PWA (no build step, no package.json). Served as flat files.
Backend is Supabase (auth + data); credentials are hardcoded public anon keys in `scr/config/config.js`.
Google Apps Script (`AppScriptRel.gs`) is a legacy fallback, not used at runtime.

## Running in Base44
- `docker-compose.base44.yml` serves the repo root via `nginx:alpine` on port 3000.
- A custom `nginx.base44.conf` runs nginx as `user root;` because the sandbox repo dir is mode 0700 (root-only), which blocks nginx's default `nginx` worker user.
- Edits to any static file are immediately visible on reload (nginx reads from the bind-mounted disk each request) — no rebuild or watcher needed. Call `reload_preview` after edits if the browser cache hides the change.

## Structure
- `index.html` — single-page app, loads all scripts via `<script>` tags (no modules/bundler).
- `scr/config/config.js` — Supabase URL + anon key.
- `scr/api/api.js` — Supabase client + all data calls.
- `scr/auth/auth.js` — login/logout, role-based UI.
- `scr/modules/` — inspecao, tacografo, envio (split into base/form/actions/consulta).
- `scr/admin/admin.js` — admin panel.
- `scr/sw.js` — service worker (PWA caching).
- `styles.css` — all styling.

## Notes
- Login requires the Supabase project's `users` table to be populated (see `README_SUPABASE.md` / `SUPABASE_CONFIG.md`). The main (non-logged-in) screen renders without any backend.
- No external secrets needed — Supabase anon key is public and already in the repo.
