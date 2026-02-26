# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Interactive League is a Next.js 15 fantasy football league management web app backed by a cloud-hosted Supabase instance (PostgreSQL, Auth, Storage, Edge Functions). Single-service architecture — no monorepo, no Docker.

### Running the Dev Server

```bash
npm run dev   # starts Next.js with Turbopack on port 3001
```

The app redirects `/` to `/login`. After sign-up/login, users land on `/saves` (league selection).

### Environment Variables

Four secrets are required (injected as env vars and written to `.env.local` by the update script):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (should point to the local dev server origin, port 3001)

### Linting

`npm run lint` (which runs `next lint`) currently fails with a pre-existing `FlatCompat is not a constructor` error because `@eslint/eslintrc` is pinned to `^0.1.0` in `package.json` but ESLint 9 needs `^3.0.0`. Running `npx eslint .` directly hits the same issue. This is not caused by the cloud agent setup.

### Build

`npm run build` works and compiles ~100 routes (68 API routes + pages). The `next.config.ts` emits a warning about an unrecognized `server` key — this is harmless.

### Key Gotchas

- The Supabase config (`supabase/config.toml`) references `site_url = "http://127.0.0.1:3000"` but the dev server runs on port **3001**. The cloud Supabase instance handles this correctly via its dashboard URL config.
- Email confirmation is disabled in the Supabase config (`enable_confirmations = false`), so sign-up works immediately without email verification in local/dev mode.
- The `@supabase/auth-helpers-nextjs` package is deprecated (still in dependencies). The codebase also uses `@supabase/ssr` which is the recommended replacement.
- Transfer Window must be opened via Host Controls before pack purchases, trades, or free agent signings work.
- `.env.local` is gitignored — the update script recreates it from injected environment variables on each VM startup.
