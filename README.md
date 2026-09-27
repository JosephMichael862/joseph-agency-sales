# Joseph Agency — Sales Dashboard

Vite + vanilla JS frontend, Supabase for database and auth, deployed on Vercel.

## 1. Supabase setup
1. Create a project at supabase.com.
2. In the SQL Editor, run `supabase/schema.sql` (creates `stock`, `customers`, `sales` tables with row-level security).
3. In **Authentication → Providers**, email/password is enabled by default — that's all this app uses.
4. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.

## 2. Local setup
```
cp .env.example .env
# paste your Project URL and anon key into .env
npm install
npm run dev
```

## 3. Git + GitHub
```
cd joseph-agency-sales
git init
git add .
git commit -m "Initial commit: Joseph Agency sales dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/joseph-agency-sales.git
git push -u origin main
```
(Or, with the GitHub CLI: `gh repo create joseph-agency-sales --public --source=. --remote=origin --push`)

## 4. Deploy to Vercel
Import the repo at vercel.com/new — it auto-detects Vite via `vercel.json`. Before the first deploy, add these two Environment Variables in the Vercel project settings (Production, Preview, and Development):

| Name | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |

Then deploy. No service role key is needed — the app talks to Supabase entirely from the browser, protected by the row-level security policies in `schema.sql`.
