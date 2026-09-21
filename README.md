# Neighborhood Footprint

A community-driven (Citizen Science) environmental pollution monitoring web
system: users upload photos of pollution sources in their neighborhood, AI
automatically classifies the type of pollution, and the system displays a
live heatmap + eco points for each neighborhood.

This is the first version (MVP) — the core project structure is actually
working: upload a photo, see it on the map, and watch your neighborhood's
points change. The remaining features (periodic reports, user accounts,
admin panel) will be added step by step later — see the "Next Steps"
section below.

---

## 1) What the project is built on (Tech Stack) and why

| Part | Technology | Why we chose it |
|---|---|---|
| Frontend | React + Vite | Lets you build an interactive UI with small, clear components |
| Map | Leaflet + OpenStreetMap | 100% free, no API key, has a ready-made heatmap plugin |
| Backend | Node.js + Express | Same as what was learned with PERN, simple and widely used |
| Database + image storage | Supabase (PostgreSQL) | Same as used in the BIT4273 project, no need to install a database server on your machine |
| AI | ResNet-50 model via Hugging Face + a keyword map | A ready-made, permanently free image classification model, with a simple code layer connecting its classifications to our pollution types |

### How exactly does the AI classification work?

**⚠️ Update:** the first version was built on the CLIP model using "Zero-Shot
Classification" (comparing the image against free-text descriptions like
"black smoke from burning garbage"). When we actually tried the project, we
discovered that Hugging Face stopped hosting this type of model for free
(neither CLIP nor any other zero-shot-image model is currently available for
free on their platform). So we went back to a simpler, proven-to-work
approach:

We use the **microsoft/resnet-50** model — a well-known, permanently free
image classification model, but it's trained on a general classification of
1000 object/scene types (cats, cars, tools...) called **ImageNet** — not
trained specifically on "pollution". To connect its general classifications
to our pollution types, we build a "keyword map" in the code: if the model
returns a classification containing a word like `ashcan` (trash can) or
`volcano` (volcano/smoke), we map it to the matching pollution type. The
full code and map are in `backend/services/aiClassifier.js` with an
explanation of every step.

**Being honest for your project report:** this is an approximation, since
it's a general model not trained specifically on pollution images, so its
accuracy is limited and you should expect to see wrong classifications or
"unknown" sometimes. This is a documented future improvement point in the
"Next Steps" section (training a custom model later with real images from
users).

---

## 2) Project structure

```
neighborhood-footprint/
├── backend/                 Backend (Express API)
│   ├── server.js            Server entry point
│   ├── routes/               API routes (reports, neighborhoods, admin)
│   ├── middleware/            requireAdmin.js — protects admin panel routes
│   ├── scripts/                make-admin.js — sets an account as admin from the Terminal
│   ├── services/              Logic for connecting to Supabase + AI + points
│   └── .env.example           Template for the secret settings file
├── frontend/                 Frontend (React)
│   └── src/
│       ├── components/        MapView, UploadForm, NeighborhoodBoard, AuthPanel, AdminPanel, ReportsView
│       ├── api.js             All communication with the backend
│       └── pollutionTypes.js  Pollution type labels + colors
├── database/
│   └── schema.sql             SQL commands to create the tables on Supabase
└── README.md                  This file
```

---

## 3) Setup steps — follow them in exact order

### Step 1: Prepare the tools

- Install [Node.js](https://nodejs.org) (the LTS version) if you don't have it.
- Make sure it's working: open Command Prompt or PowerShell and type:
  ```
  node --version
  npm --version
  ```

### Step 2: Create a Supabase project (database + image storage)

1. Go to [supabase.com](https://supabase.com) and sign up for a free account (the Free plan is enough for the project).
2. Create a **New Project**. Choose a name and a database password (save it somewhere safe).
3. Once the project finishes setting up (takes a minute or two), go to **SQL Editor** from the side menu.
4. Open the `database/schema.sql` file from this project, copy all its content, paste it into the SQL Editor, and click **Run**.
   - This creates two tables for you: `neighborhoods` (neighborhoods and their points) and `reports` (the reports).
5. Go to **Storage** from the side menu, create a **New bucket**, name it exactly: `pollution-photos`, and enable the **Public bucket** option (so image links work directly in the browser).
6. Go to **Project Settings > API**. You'll need two values for the next step:
   - **Project URL**
   - **service_role key** (under API keys — **be careful not to share it with anyone or upload it to GitHub**)

### Step 3: Create a Hugging Face account (for the AI)

1. Go to [huggingface.co](https://huggingface.co/join) and sign up for a free account.
2. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).
3. Create a **New token**, and the important part here:
   - Choose the **Fine-grained** type (not the regular Read type)
   - From the permissions list, enable **"Make calls to Inference Providers"**
   - ⚠️ This specific permission is required — without it the server will give you a 401/403 error at classification time, even if the token is otherwise correct
4. Copy the token (it starts with `hf_`)

> If you previously created a Read-type token and it's not working, go back and create a new Fine-grained one with the permission mentioned above, and replace the old value in the `.env` file.

### Step 4: Run the backend

1. Open a Command Prompt/Terminal inside the `backend` folder.
2. Copy the `.env.example` file and name the copy `.env`.
3. Open `.env` and fill in the values:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from Step 2)
   - `HUGGINGFACE_API_KEY` (from Step 3)
4. Install the packages:
   ```
   npm install
   ```
5. Start the server:
   ```
   npm run dev
   ```
6. You should see the message: `🚀 Server running at http://localhost:4000`
   - Try opening the link in your browser, you should see a simple JSON message confirming the server is running.

### Step 5: Run the frontend

1. Open a **new** Command Prompt/Terminal (leave the backend server running in the old window) inside the `frontend` folder.
2. Copy the `.env.example` file and name the copy `.env` (the default value `http://localhost:4000` is fine if you didn't change the port number).
3. Install the packages:
   ```
   npm install
   ```
4. Start the frontend:
   ```
   npm run dev
   ```
5. Open the link shown in the Terminal (usually `http://localhost:5173`).

### Step 6: Try out the system

1. From the **📸 Report Pollution** tab: choose a photo (any test photo with smoke or garbage in it), click "Use my current location" or enter coordinates manually, choose a neighborhood, and click submit.
2. Wait a bit (the AI takes a few seconds, especially the first time).
3. Go to the **🗺️ Map** tab — you should see a new point where the photo was.
4. Go to the **🏆 Neighborhood Points** tab — you should see the points for the neighborhood you chose go down slightly.

**Note about classification accuracy:** since the model is general-purpose
(not trained specifically on pollution), getting "unknown" sometimes or a
classification that isn't 100% accurate is expected and not necessarily a
malfunction. What you should worry about is if you see a **red error
message** in the backend window at submission time (e.g. `401`, `403`, or
`network_error`) — that's a real problem, usually caused by the token
(check Step 3) or a wrong value in the `.env` file.

---

### Step 7: Enable login (Authentication)

This is an extra feature (optional for the end user — the site keeps
working without logging in), but enabling it on your side (the developer)
takes 3 simple steps:

1. **Update the database:** go to your project on supabase.com → **SQL Editor**,
   paste this code and click **Run** (it adds two new columns to the
   reports table: who sent it and from which email):
   ```sql
   alter table reports add column if not exists user_id uuid references auth.users(id) on delete set null;
   alter table reports add column if not exists user_email text;
   ```

2. **(Optional but recommended during development) Disable email
   confirmation:** go to **Authentication → Providers → Email**, and turn
   off the **"Confirm email"** option. This way any new account you create
   lets you log in immediately without needing to open your email and click
   a confirmation link — much easier while testing.
   (You can turn it back on later if you want more security for the final
   deployment stage.)

3. **Get the "anon" key and put it in the frontend's `.env` file:**
   - Go to **Project Settings → API**.
   - Copy the **"anon public"** value (not service_role — this key is safe to expose in the browser).
   - Open `frontend/.env` (or copy it from `.env.example` if you haven't already), and fill in:
     ```
     VITE_SUPABASE_URL=https://xxxxx.supabase.co   (same URL as in backend/.env)
     VITE_SUPABASE_ANON_KEY=eyJ...                  (the new anon key)
     ```
   - Since this is a `.env` update, you need to stop the frontend server
     (`Ctrl+C`) and start it again (`npm install` once first — for the new
     Supabase library in the frontend — then `npm run dev`) so it picks up
     the new values.

After this you'll see a small bar at the top of the site with "Log in / New
account". Any user who logs in and submits a report will have their email
saved with the report (and it will show up in the report's popup on the
map). A user who doesn't want to log in can still submit reports normally,
just without linking them to an account.

---

### Step 8: Enable the Admin Panel

This feature adds a "review" step to reports: any new report starts with
status `pending` and doesn't appear on the public map or the neighborhood
points board until an admin account approves it from a dedicated admin
panel. This lets us prevent annoying or incorrect reports from showing up
to everyone right away.

1. **Update the database:** go to your project on supabase.com → **SQL Editor**,
   create a **New query**, open the `database/schema.sql` file from this
   project again, copy **all of its content** (the entire file has been
   updated with new additions at the end), paste it, and click **Run**.
   - This adds a new table called `admins` (the list of accounts allowed to
     access the admin panel), and automatically approves any reports that
     existed before now (so they don't suddenly disappear from the map).

2. **Restart the backend:** go to the Terminal window where the backend
   (`backend`) is running. Since it uses `npm run dev` (auto-watch mode),
   it should restart on its own once it detects the new files. To be sure,
   stop it (`Ctrl+C`) and start it again manually:
   ```
   npm run dev
   ```
   and make sure there's no red error message.

3. **Make your account an admin:** inside the `backend` folder, in the same
   Terminal window (or a new one), run this command — replace the email
   with the email of the account you logged in with on the site (from Step 7):
   ```
   node scripts/make-admin.js your-email@example.com
   ```
   You should see a confirmation message that the account is now an admin.

4. **Log out and log back in** on the site (with the same account you made
   an admin in the previous step) — this is necessary so the frontend
   re-checks whether your account is an admin.

5. You should now see a new tab called **🛡️ Admin** at the top. Open it —
   you'll see all the reports (pending ones first), and next to each one
   two buttons: **Approve ✅** and **Reject ❌**. Try submitting a new
   report from the "Report Pollution" tab, and confirm that it **doesn't
   show up** on the public map before you approve it from the admin panel,
   and that it **shows up** immediately after you click "Approve".

> Security note: the real check of admin permission happens on the backend
> (`requireAdmin` middleware) regardless of what the frontend displays —
> meaning even if someone tries to "trick" the browser into showing them the
> admin tab, the server will reject any request from them because they
> aren't actually in the `admins` table.

---

### Step 9: Enable automatic periodic reports (Reports)

This feature adds a new "📊 Reports" tab (shown to admins only, next to the
"Admin" tab): the system **automatically** calculates a statistical summary
of the reports every Sunday (how many reports happened, in which
neighborhood, and what pollution type) and saves it, and the admin can also
request a report on demand with a button click (for the last week or the
last month) and print it or save it as a PDF directly from the browser (no
extra PDF library — just the regular print feature).

1. **Update the database:** go to your project on supabase.com → **SQL Editor**
   → **New query**, paste this exact code, and click **Run** (it adds a new
   table called `report_snapshots` to store the weekly reports — it doesn't
   touch any existing table, so it's completely safe to run):
   ```sql
   create table if not exists report_snapshots (
     id            uuid primary key default gen_random_uuid(),
     period_start  timestamptz not null,
     period_end    timestamptz not null,
     total_reports integer not null default 0,
     summary       jsonb not null,
     created_at    timestamptz not null default now()
   );

   alter table report_snapshots enable row level security;
   ```

2. **Restart the backend:** in the same `backend` Terminal window,
   `Ctrl+C` then `npm run dev` again, and make sure there's no red error.

3. **Log out and log back in** on the site (with your admin account) — you
   should see a new tab **"📊 Reports"** next to the "Admin" tab.

4. Open the "Reports" tab, and click **"Generate weekly report now 🔄"** —
   this generates a report on demand instead of waiting for the first
   Sunday (the system will already do the same thing automatically every
   week as long as the server is running, but this lets you try it
   immediately).

5. Once the report appears below, click **"🖨️ Print / Save as PDF"** — this
   will open the browser's normal print window, choose **"Save as PDF"**
   instead of a printer, and save it — now you have a professional PDF
   report ready to include as an appendix to your project.

> Note: the real automatic weekly report (Sunday at 6 AM) only runs as long
> as the backend is running at that moment. For your project presentation
> or your written report, use the "Generate weekly report now" button — that
> is completely sufficient to prove the feature works.

---

## 4) Important things to know (for your project report)

- **Security:** the backend is the only thing that can write to the
  database (via the service role key). The frontend never communicates
  with Supabase directly — every request goes through our API. This is a
  more secure architecture.
- **RLS (Row Level Security):** enabled on the database tables as an extra
  layer of protection.
- **Privacy:** login exists (Supabase Auth) but is optional — anyone can
  still submit a report without an account. If the user is logged in, their
  email is saved with their report.
- **Admin panel:** any new report has status `pending` and doesn't show up
  on the public map or the neighborhood points board until an admin
  approves it (see "Step 8" above). This prevents wrong/annoying reports
  from directly affecting a neighborhood's points.
- **Periodic reports:** a statistical summary (report count by
  neighborhood and pollution type + comparison with the previous period)
  is generated automatically every week (`node-cron`) and saved in the
  `report_snapshots` table, and the admin can also request it on demand and
  save it as a PDF directly from the browser (see "Step 9" above).

## 5) Next steps (suggestions for developing the project further)

Ideas for upcoming stages, ordered from easiest to hardest:

1. ~~Simple user login~~ ✅ Done (see "Step 7" above).
2. ~~Admin panel to review reports before they appear on the map~~ ✅ Done
   (see "Step 8" above).
3. ~~Automatic periodic reports~~ ✅ Done (see "Step 9" above).
4. **Real geographic boundaries for neighborhoods** (polygons) instead of
   manually selecting a neighborhood, using PostGIS or the turf.js library
   to automatically determine the neighborhood from coordinates.
5. **Improve AI classification accuracy**: short-term by expanding/editing
   the keyword map in `aiClassifier.js` (`CATEGORY_KEYWORDS`), and long-term
   by collecting real images from users and training a custom model
   (transfer learning) that recognizes our specific pollution categories
   instead of relying on a general-purpose model.

Let me know whenever you're ready to start on any of these, and we'll build it together step by step.
