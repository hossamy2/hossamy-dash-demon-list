# Hossamy Dash Demon List

A community leaderboard site for Hossamy Dash, built with Next.js and Supabase. Players can create accounts and submit completion videos; moderators can add levels and approve or reject records. Approved records award the level's points to a player's total.

## Run locally

1. Install Node.js (20 or newer).
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and **anon/public** key.
3. Run `npm install` and then `npm run dev`.
4. Open http://localhost:3000.

## Supabase setup

1. Create a Supabase project at https://supabase.com/dashboard.
2. In the project, open **SQL Editor → New query**.
3. Copy and run all of [`supabase/setup.sql`](supabase/setup.sql).
4. Open **Project Settings → API** and copy the Project URL and `anon`/publishable key into `.env.local` locally. For Vercel, add them as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables.
5. Create your player account on the website. In Supabase **SQL Editor**, grant that account moderator access by replacing the email below and running:

```sql
update public.profiles
set role = 'moderator'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

Only trusted people should be moderators. Do **not** put a Supabase `service_role` secret in frontend environment variables or commit it to GitHub. The browser uses the public anon key; Supabase Row Level Security enforces who can approve records or manage levels.

## Deploy at a public URL

Import `hossamy2/hossamy-dash-demon-list` from GitHub into Vercel, set the two `NEXT_PUBLIC_...` environment variables in the Vercel project settings, and deploy. Vercel will provide a `*.vercel.app` address. Each time you push a change to `main`, Vercel can redeploy automatically.

## Notes

- This app intentionally starts with no sample levels; moderators add real levels from the Moderation tab.
- To make an account a moderator, use the SQL command above. Never let players self-assign moderator access.
- The first approved record for a player and level is unique. If a level's points change, leaderboard totals recalculate using its current points.
