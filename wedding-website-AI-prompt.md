# Build my wedding invitation website

You are a senior full-stack developer and front-end designer. Help me build the rest of a private wedding invitation and RSVP website. I've attached files (listed in section 1). Read all of them before writing any code.

Facts I still need to give you (use placeholders until I do): couple names [names], monogram initials [initials] (the reference images show "A | J"), wedding date [date], venue [venue] (the images show "At the Sky Garden"), RSVP deadline [date].

## 1. Attached files

- `design/wedding-invitation-flow-responsive-final.png`: reference for the guest flow, desktop and mobile.
- `design/wedding-admin-dashboard-responsive-final.png`: reference for the admin dashboard, desktop and mobile.
- `design/Wedding_Website_Full_Styling_Guide.pdf`: the styling guide and CSS reference. It is the source of truth for styling.
- `design/tokens.css`: the design tokens from that guide, ready to import.
- `server/index.js`, `db.js`, `normalize.js`, `package.json`, `.env.example`: my starter Express API.
- `server/scripts/create-admin.js`: creates or resets an admin account.
- `server/sql/schema.sql`: a **reference** for the tables that already exist. Do not run it.

## 2. How to work

- Work **one milestone at a time** (section 8). When one is done, stop, list the files you changed, and tell me how to test it. Do not start the next until I say so.
- The front-end design is decided. Follow the images, the PDF, and `tokens.css`. Do not redesign it. Where something is undecided or the designs conflict with this prompt (section 9), give me 2 to 3 options with trade-offs and wait for my choice before building.
- Ask before adding a dependency.
- Give me code as separate, clearly named files, and `curl` commands with expected responses after each backend change.

**Rules that must not be broken**

- **Stack:** React (Vite, JavaScript) with plain CSS and no CSS framework. Node.js and Express (CommonJS) with `mysql2`. Do not change the stack.
- **One address:** everything runs as one Render web service. Express serves the built React site (`client/dist`) and the API on the same address. Use **relative** API paths (`/api/...`) in the client. No CORS, and no client-side API URL setting.
- **Privacy:** the guest list and all wedding details are returned by the API only after a successful name check. Nothing private may be in the React bundle. Errors never reveal anything about the guest list.
- **Server-side enforcement:** all RSVP and companion rules are enforced on the server. The UI only mirrors them.
- **Two token types:** guest tokens use `JWT_SECRET`. Admin tokens use `ADMIN_JWT_SECRET` and carry `role: "admin"`. A guest token must never work on `/api/admin/*`.
- **Secrets:** never commit `.env`, passwords, or the Aiven certificate, and never log them. Read them from environment variables.
- **SQL:** parameterized queries only.
- **Names:** use the one shared `normalizeName` (`server/normalize.js`) for every guest-name comparison and every `name_key` written.
- **Accessibility:** every input has a visible label, every status has a text label (color is never the only signal), the wax seal is a real `<button>`, focus moves at each state change, `prefers-reduced-motion` is respected, and the minimum text size is 12px.
- **Mobile first.** The admin table becomes cards on small screens.

## 3. Where things stand

**Database (done, do not touch).** It is hosted on Aiven and the tables already exist exactly as in `schema.sql`: `invited_guest`, `companion`, and `admin_user`. Do not create tables and do not write migrations. If you believe a schema change is needed, stop, give me the exact SQL and the reason, and I'll run it myself. Two admin accounts already exist in `admin_user` (bcrypt hashes).

**Backend (partly done).** The attached starter has: `GET /health`, `GET /health/db`, `POST /api/verify` (records the first and last open time and the open count), `GET /api/me`, `GET /api/invitation` (a stub), and `POST /api/rsvp`. It also serves `client/dist` and reads the database connection from the environment. What's left: confirm the connection works from the env values, then build the admin API (section 6).

**Front-end (not started).** The `client/` folder does not exist yet.

## 4. The website

A guests-only wedding website with two parts: the **guest invitation flow** and the **admin dashboard** at `/admin`.

**Visual direction.** Elegant wedding stationery over the real garden venue. The venue photo is an atmospheric background and must never reduce readability. The dominant surface color is **champagne, not white**. Pastel blue is for the wax seal, selected states, subtle overlays, and botanical details. Deep blue is for text and primary navigation. Cormorant Garamond for names and headings, DM Sans for everything else. Gold hairline borders, pill buttons, and olive-sprig ornaments. The guest side is romantic and ceremonial. The admin side uses the same colors and fonts but is calmer, denser, and on a solid ivory base (no photo behind data).

**Guest flow states:** `sealed`, `name-entry`, `verifying`, `not-found`, `opened`.

| State | What the guest sees | Required behavior |
|---|---|---|
| `sealed` | Closed champagne envelope with a pastel-blue monogram wax seal over the blurred, darkened venue photo. "Tap the seal to begin." | The seal is a real `<button>` labeled "Open invitation and enter your name". Tapping starts name entry. |
| `name-entry` | Envelope stays visible. A champagne panel slides up: "Dear ____," and "Enter your full name to check your invitation.", a full-name field, and a Continue button. | Focus moves to the field. It needs a visible label, not only a placeholder. |
| `verifying` | A calm loading card with a small wreath and "Preparing your invitation…" | Calls `POST /api/verify`. Render's free server may be waking up, so allow up to about 60 seconds, then show a friendly retry message. |
| `not-found` | The form stays open. | Ask the guest to check their spelling. Reveal nothing about the list. |
| `opened` | The seal is cracked, the flap lifts, and a champagne invitation card enters: "Welcome, [role] [guest name]", couple names, venue, date, and a "View invitation" button. The blur clears. | Focus moves to the opened heading or the primary button. "View invitation" leads to the rest of the site. |

Motion: crack seam appears 180 ms, seal halves separate 520 ms, flap lifts 650 ms, card enters 700 ms, background blur clears 1,100 ms. With reduced motion, keep the same state changes without animation. Build the envelope and seal with CSS layers and an SVG or text monogram, never a baked image. On wide desktops the content column sits slightly left so the venue stays visible on the right.

**Main site and RSVP (not designed yet).** After "View invitation": our story, schedule, entourage, gallery, dress code, FAQ, and RSVP, all in the same design system. Give me 2 to 3 layout options first.

**RSVP rules.** Every guest has a status: **Attending** (accepting), **Declined**, or **Pending** (automatic until they respond). Guests can switch between Attending and Declined later. The screen always shows their current status and the RSVP deadline. If attending, they can add the names of up to their own companion limit (the default is 2, set per guest by the admin), and the screen says how many they can bring.

**Admin dashboard.**
- Desktop: a sidebar (monogram, Dashboard, Guest list, Print view, Settings), then in this order: title with a "Live · Updated just now" indicator, four primary stat cards (Invited guests, Opened letter, **Not opened yet** with the strongest emphasis, Confirmed headcount), four summary cards (Attending, Pending, Declined, Maximum possible headcount), filter pills (All, Not opened yet, Attending, Pending, Declined) and a search box, the guest table, and Export CSV and Print list buttons.
- Table columns: Guest (initials avatar), Role, Letter status (Opened with date, or Not opened yet), RSVP, Companions (removable chips such as "+1 Alex Tomlinson", or "+0"), Limit (a stepper), Actions (three-dot menu).
- Show the rule beside the control when it matters: "Limits cannot be lower than companions already added." A guest at their limit has the add-companion action disabled, with a note that the limit must be raised first.
- Mobile: the sidebar hides behind a menu button, stat cards stack, filters scroll horizontally, the table becomes guest cards (name, role, letter status, RSVP, companions, limit stepper, actions), and Export and Print become full-width stacked buttons.
- Login: ivory page, a centered champagne card with the monogram, a short title, and two fields. No photo.
- Print view: no decoration, black on white, each guest with companions underneath and their RSVP status, and totals at the bottom.
- Live counts: poll every 15 seconds, and pause while the tab is hidden. Do not animate large data changes.

## 5. Definitions (use these exact meanings)

- **Opened:** the guest has passed the name check at least once (`first_opened_at` is not null).
- **Confirmed headcount:** attending guests plus the companions of attending guests.
- **Maximum possible headcount:** invited guests plus the sum of every guest's `max_companions`.
- Attending + Pending + Declined always equals Invited guests.
- Compute every number from data. The numbers in the admin image are placeholders and some don't add up.
- Timestamps are stored in UTC. Display them in Asia/Manila unless I say otherwise.

## 6. API

Errors use `{ "error": "CODE", "message": "Human readable text" }`. Guest tokens last 7 days. Admin tokens last 2 hours. Send tokens as `Authorization: Bearer <token>`.

**Guest routes (already in the starter):**

| Method | Route | Notes |
|---|---|---|
| POST | `/api/verify` | `{ fullName }` returns `{ token, guest }` or 404. Rate limited to 10 per minute per IP. Sets `first_opened_at` once, updates `last_opened_at`, increments `open_count`. |
| GET | `/api/me` | Guest token. Returns the current guest and companions. |
| GET | `/api/invitation` | Guest token. Wedding details (a stub now; extend with real content later). |
| POST | `/api/rsvp` | Guest token. `{ status: "attending" \| "declined", companions: [...] }`. Attending: at most `max_companions`, the list is replaced. Declined: the list is cleared. |

The starter's guest-route errors use `{ "error": "text" }`. Bring them to the format above when you build the admin API.

**Admin routes (to build):**

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/admin/login` | `{ username, password }` returns `{ token, admin: { username } }`. Rate limited (about 5 per minute per IP), bcrypt (`bcryptjs`), the same generic 401 `INVALID_CREDENTIALS` for a wrong username or password, and compare against a dummy hash when the username doesn't exist. |
| GET | `/api/admin/summary` | `{ invited, opened, notOpened, attending, pending, declined, companionsTotal, attendingCompanions, confirmedHeadcount, maxPossibleHeadcount, updatedAt }` |
| GET | `/api/admin/guests` | Query `filter` = `all` \| `not-opened` \| `attending` \| `pending` \| `declined`, and `q` (case- and accent-insensitive name search). Returns `{ guests: [{ id, fullName, role, openedAt, rsvpStatus, maxCompanions, companions: [{ id, fullName }] }] }`, sorted by name. `openedAt` is null if not opened. |
| PATCH | `/api/admin/guests/:id` | `{ maxCompanions }` (integer 0 to 10). 409 `LIMIT_BELOW_COMPANIONS` if lower than the companions already stored. |
| POST | `/api/admin/guests/:id/companions` | `{ fullName }`. 201 with the guest. 409 `AT_LIMIT` if the guest is at their limit. 400 `INVALID_NAME`. Allowed for any RSVP status. |
| DELETE | `/api/admin/companions/:id` | Removes the companion and returns the guest. 404 `NOT_FOUND`. |
| GET | `/api/admin/export.csv` | UTF-8 with a BOM. Columns: Type (Guest or Companion), Name, Companion of, Role, Letter status, First opened (UTC), RSVP, Companion limit. One row per guest, then one row per companion. Any cell starting with `=`, `+`, `-`, `@`, tab, or carriage return gets a leading single quote (formula-injection protection). |

Every admin route except login requires an admin token, and a guest token must get 401.

## 7. Environment and hosting

Environment variables (Render's Environment tab in production, `server/.env` locally): `PORT` (local only), `JWT_SECRET`, `ADMIN_JWT_SECRET` (a different random value), `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CA` (Aiven's CA certificate, one line with `\n` for line breaks). There is no `CLIENT_ORIGIN` and no client-side `.env`.

Hosting: one Render Web Service. Build command: `npm --prefix client install --include=dev && npm --prefix client run build && npm --prefix server install`. Start command: `node server/index.js`. Health check path: `/health`. An uptime monitor pings `/health` every 5 minutes. `/admin` must load on a browser refresh. For local development, Vite proxies `/api` to `http://localhost:3000`.

Repo layout: `/client` (React), `/server` (Express), `/design` (the reference files).

## 8. Milestones (do them in order, one at a time)

1. **Backend check and admin API.** Confirm the app connects to the Aiven database from the env values (`/health/db`). Test the guest routes with `curl`, including that verifying a guest sets the open-tracking columns. Then build the admin API from section 6 with server-side rule enforcement, and give me `curl` tests for each rule (a guest token gets 401 on admin routes, lowering a limit below the current companions returns 409, adding beyond the limit returns 409, the summary numbers add up, a companion named `=1+1` is exported as text).
2. **Client setup and guest flow.** Create the Vite React client, import `tokens.css`, add the fonts, add the Vite proxy, then build the five guest states with the envelope, wax seal, monogram, and crack animation. Give me 2 to 3 options for how the crack looks before finalizing. Use a placeholder image until I supply `venue-garden.jpg`.
3. **Main site and RSVP.** Give 2 to 3 layout options first, wait for my choice, then build.
4. **Admin front-end.** Build it from the dashboard image and the PDF, with live polling, the rule messages, mobile cards, and the print view.
5. **Polish.** Optimize the venue photo (WebP, sensible size, preload) and avoid a heavy live blur on low-end phones (for example a pre-blurred low-resolution copy that cross-fades to the sharp image; give options). Font loading without layout shift, contrast checks, a full accessibility pass, and a QA checklist.
6. **Deploy to Render** and run a pre-launch checklist. Remind me to check Aiven's allowed IP addresses, verify free-tier limits, and replace the admin passwords with strong ones.

## 9. Known gaps in the reference designs

- The sample numbers in the admin image don't add up (Attending 22 + Pending 6 + Declined 2 is 30, not 48 invited, and "Maximum possible headcount 42" is below 48 invited). Compute everything from data.
- The name field in the guest image has only placeholder text. Add a real visible "Full name" label.
- The Actions (three-dot) menu and the Settings sidebar item have no defined content. Give me options (for example add companion and view RSVP details), or propose removing Settings for now.
- The main site sections and the RSVP screen have no visual design yet (milestone 3).
- The admin login and the print view have written specs but no images. Build them from this prompt and the PDF.
- Small text in the mobile images looks smaller than the 12px minimum. Use 12px or larger, and check contrast for light text over the photo.
- Two admin accounts already exist. Do not create or change passwords, and never put a password in code, SQL, or docs. To create or reset one I'll run `node scripts/create-admin.js <username>` myself.

## 10. Start now

Read every attached file, then do **milestone 1 only**. Before you start, list any question that blocks it (there should be none), then proceed. When it's done, stop and tell me what you changed and how to test it.
