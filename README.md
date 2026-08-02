# Bagh-e-Kabul — Le Jardin de Kaboul

A premium full-stack website for an Afghan restaurant: an immersive public
site (menu, ordering, story, contact) and an owner-facing admin panel
(orders, dishes, categories).

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS v4** for the design system
- **Prisma 7** + **SQLite** (via the `better-sqlite3` driver adapter) for data
- **Framer Motion** for animations, **Zustand** for the cart
- **Stripe Checkout** for optional online card payments (cash on
  delivery/pickup always works, with or without Stripe configured)

## First-Time Setup

```bash
npm install                # also runs `prisma generate` automatically
npx prisma migrate dev     # creates prisma/dev.db and applies the schema
npm run db:seed            # seeds categories, dishes, reviews, and the admin account
npm run dev                # http://localhost:3000
```

The `.env` file is already filled in with working local-dev defaults. Copy
`.env.example` if you ever need to recreate it.

### Admin login

Set by `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` (used the first time you
run `npm run db:seed`). Defaults locally to:

- URL: `http://localhost:3000/admin/login`
- Email: `owner@bagh-e-kabul.com`
- Password: `ChangeMe123!`

Change `ADMIN_PASSWORD` in `.env` and re-run `npm run db:seed` before this
ever goes to production — the seed script upserts the admin account, so
re-running it with a new password updates the existing account.

## Enabling Online Card Payments (optional)

Cash on delivery/pickup works with zero configuration. To turn on the
"Card" option at checkout:

1. Create a free [Stripe](https://stripe.com) account and switch to **test
   mode**.
2. Copy your test **Secret key** into `STRIPE_SECRET_KEY` in `.env`.
3. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the webhook signing secret it prints into `STRIPE_WEBHOOK_SECRET`
   in `.env`.
4. Restart `npm run dev`. The Card option will now be enabled at checkout.

## Adding "View on Your Table" AR to a Dish

Any dish with a 3D model gets a "View on Your Table (AR)" button on its
page and an AR badge in the menu — customers tap it, their camera opens,
and the dish appears on their table (AR Quick Look on iPhone, Scene
Viewer/WebXR on Android). No app install needed.

**How to get the 3D model**: the AR Model card in the admin panel
generates it automatically from the dish's photo using [Meshy](https://www.meshy.ai)
AI, in a couple of minutes, no scanning required.

To turn it on:

1. Create a [Meshy](https://www.meshy.ai) account and subscribe to the
   **Pro plan** ($20/month) — the free plan doesn't include API access.
2. Copy your API key (Meshy dashboard → API settings) into `MESHY_API_KEY`
   in `.env`.
3. Restart `npm run dev`. The "Take Photo & Generate 3D" / "Use Existing
   Photo" buttons appear on every dish that has a photo.

A dish with no 3D model generated simply shows no AR button — nothing
breaks, it's fully optional per dish.

### Model quality

Models are generated with Meshy 6 at **4K textures with full PBR maps**
(base colour, normal, metallic-roughness, emission) — the surface detail is
what makes food read as real, far more than polygon count.

That comes out of Meshy far too heavy to serve, so every model is
re-encoded on the way in (`src/lib/glb.ts`): base colour keeps its full 4K,
the data maps drop to 2K where nobody can tell, and everything is written
as high-quality JPEG. GPU texture compression (KTX2) would be smaller
still, but **Scene Viewer doesn't support it** and model-viewer can't read
pixels back out of it to build the iOS USDZ, so a KTX2 model shows up
untextured in AR on both platforms. JPEG is what survives the trip.

### Portion size in AR

The whole point of AR here is showing a customer how big the dish really
is, so the model is generated at a real-world size rather than whatever
size the AI reconstruction happens to land on. That size comes from the
dish's category — a side bowl is 20cm across, a kabob platter 34cm — and
lives in `src/lib/ar-scale.ts`. Edit the number there and regenerate the
model to change it.

The web preview always scales the model to fill its box, so it will *not*
show you a wrong size. The AR Model card prints the real size in
centimetres underneath for that reason; if it looks wrong for a dish,
its category is what needs fixing.

Two commands to check and repair what's on disk:

```bash
npm run glb:inspect -- uploads/models/dishes/glb/*.glb  # real size of each model
npm run ar:fix                                          # what needs fixing
npm run ar:fix -- --apply                               # resize to match the
                                                        # category, re-encode
                                                        # textures, delete
                                                        # unreferenced files
```

`ar:fix` repairs size and weight without spending Meshy credits, but it
can't add detail that was never generated — a model made before the 4K PBR
settings needs regenerating from the admin panel to look its best.

### Testing AR on a real phone

`docker-compose.lan-test.yml` serves the site over HTTPS on your LAN with
a **self-signed** certificate. That's enough for the page and the 3D
viewer, but **not** for AR itself: Scene Viewer and Quick Look download
the model file in a separate app that does not inherit the certificate
exception you accepted in the browser, so the hand-off fails and looks
like "AR can't find a surface".

To test the real camera hand-off you need a publicly trusted certificate.
The quickest way in dev is a tunnel:

```bash
npm run dev                              # in one terminal
cloudflared tunnel --url http://localhost:3000   # in another
```

Then open the `https://<something>.trycloudflare.com` URL it prints on
your phone, and add that hostname to `allowedDevOrigins` in
`next.config.ts`. Anything else with a real certificate (ngrok, or the
production stack on your own domain) works the same way.

## Table QR Codes

**Admin panel → Tables** (`/admin/tables`) is where the restaurant's tables are
defined, and where each one's QR code is printed.

Start by entering how many tables you have — that creates tables 1–N. Raising
the figure later only adds the missing numbers, so it never disturbs the tables
you already have. Each **active** table then gets a printable code below: cut it
out and put it on the table. A customer points their phone camera at it and the
menu opens — no app to install.

A table can be **deactivated** (broken, terrace closed for winter): it keeps its
number and its history, stops accepting orders, and drops out of the printed
codes. Deleting is also safe for history — past orders store the table *number*
rather than a link to the row, so last month's "Table 7" still reads "Table 7"
after table 7 is gone.

### The table list is the source of truth

Which tables exist is a database fact, so it is checked when the order is
placed, not in the request schema — the same layer, and the same reasoning, as
the "dish no longer available" check.

Before this list existed, the only bound on a table number was a constant of
100, so `?table=87` in a twelve-table restaurant produced a genuine dine-in
order for a table that does not exist — and since cash dine-in carries no name
or phone number, staff had food and nobody to trace it to. Now an order is
refused unless there is an **active** table with that number, and scanning a
code for an unknown or deactivated table simply shows the ordinary takeaway
menu.

`MAX_TABLE_COUNT` (100) survives only as a sanity bound on input, not as a
business rule.

Each code encodes `/menu?table=N`, which is what drives dine-in ordering below.

### The address matters

These codes are scanned by *phones*, so they must contain an address that other
devices on the network can reach. `http://localhost:3000` points a phone back
at itself and the menu will never load — which is a real trap, because that is
what `NEXT_PUBLIC_BASE_URL` is set to in the default `.env` (correct for Stripe
redirects, wrong for these codes).

The page therefore picks the address in this order, skipping anything a phone
can't reach:

1. `NEXT_PUBLIC_BASE_URL` — the right answer once you have a real domain.
2. **The address you're browsing the admin panel on.** Open the panel from the
   restaurant's own network (e.g. `http://192.168.1.11:3000/admin/tables`) and
   the codes pick that up automatically, including after the router hands the
   server a different IP.
3. `http://192.168.1.11:3000` as a last resort (`FALLBACK_BASE_URL` in
   `src/lib/table-qr.ts`).

The address is shown in an editable field above the codes, so you can always
override it — type your domain to print codes for production while working
locally. If you enter an unreachable one, the page says so before you waste
paper. **Check the address on the page matches how phones reach the server
before printing.**

Your server's LAN address is printed as `Network:` when `npm run dev` starts.

### Printing

Two ways, both from the page itself:

- **Print all N codes** — the whole set, two cards per row on A4. No card is
  ever split across a page break.
- **Print this one** on any card — that table only, one enlarged card on its
  own page. Use it when a single code gets torn or a new table is added,
  instead of reprinting the sheet.

A print stylesheet drops the sidebar, the controls, and the print buttons
themselves, so only the cards reach paper. Turn on "Background graphics" in the
browser's print dialog to keep the gold border.

## Dine-In Ordering

A customer who scans the QR code on their table gets the ordinary menu, but the
order they place is filed as **dine-in at that table** rather than as delivery
or pickup, and the table number shows up next to the order in the admin panel.

How the table travels from the scan to the order:

1. The code opens `/menu?table=5`. The menu page parses that parameter, confirms
   table 5 exists and is active, and renders `TableSessionCapture`, which stores
   the table in localStorage.
2. Nothing else in the flow needs the URL — the customer browses dishes, fills
   the cart, and reaches checkout several navigations later, by which point the
   query parameter is long gone. The stored session is what survives, including
   across a reload when a phone locks mid-meal.
3. Checkout sees an active table session, so **Dine-in** appears as a third
   option and is preselected. The customer can still switch to delivery or
   pickup.
4. The order is saved with `fulfillmentType = DINE_IN` and `tableNumber = 5`,
   and no delivery fee.

**Dine-in is only offered to someone who actually scanned a table.** Ordering
from home shows the usual Delivery/Pickup pair — a dine-in order with no table
number is one the kitchen can't serve, so it is rejected server-side too.

### Cash dine-in asks for nothing but the order

A dine-in customer paying cash gives **no name, email, phone, or address** —
only the table, the cart, and optional notes. The table is the identity: staff
carry the food to a table they can see, so contact details would be friction
with nothing on the other end of them.

This is enforced in the schema, not just hidden in the form. `POST /api/orders`
accepts missing contact details **only** when `fulfillmentType = DINE_IN`;
delivery and pickup still require all three, and a partially filled set is
rejected. Empty strings count as absent, so a blanked-out field behaves the same
as an omitted one.

Because the columns must allow it, `customerName`, `customerEmail`, and
`customerPhone` are nullable. Anywhere a name is displayed falls back to the
table (`orderCustomerLabel` in `src/lib/constants.ts`) — the admin list, the
dashboard, and the order page show **"Table 9"** rather than a blank, and the
order page states plainly that there are no contact details.

### Dine-in is cash only, for now

Card payment for dine-in isn't built — there's no way yet to tie a Stripe
session to a table mid-service — so the checkout form disables the Card option
for dine-in and `POST /api/checkout/session` rejects `DINE_IN` outright rather
than creating orders the floor staff can't reconcile.

The two routes validate against **different schemas** (`cashOrderSchema` and
`cardOrderSchema` in `src/lib/validators.ts`), because the rule depends on the
payment method and the payment method is a property of the route, not the
payload. They share one base schema and one set of field-format rules, so the
two can't drift apart. When dine-in card payment is built, the change is to
`cardOrderSchema`.

### The session expires after 3 hours

`TABLE_SESSION_TTL_MS` in `src/store/table-session-store.ts`. Without an expiry,
a customer who scanned table 5 on Friday and ordered delivery from home on
Sunday would have that order silently filed as dine-in at table 5, and the
kitchen would plate it for a table nobody is sitting at. Three hours covers a
long meal and is well short of a return visit. Re-scanning restarts the clock.

### Invariants

Enforced in `src/lib/validators.ts` and re-checked in `src/lib/orders.ts`:

- `DINE_IN` **requires** a table number, and that table must exist and be active
  when the order is placed.
- `DELIVERY` and `PICKUP` **must not** carry one, so a stale scan can never
  attach a table to an order going out on a bike.
- An invalid `?table=` value (non-numeric, out of range, repeated) is ignored
  entirely — the customer just gets the normal takeaway menu.

## Order Tracking

A customer can follow their order live, with no account and no sign-in.

**How they get back to it.** Order ids are kept in the browser, next to the
cart, and listed at `/orders` ("My Orders"). This is the only mechanism that
works for the primary flow: a **cash dine-in order has no name, email or phone
by design**, so there is nothing to look it up by — the device that placed it is
the only thing that knows. Opening a tracking link on a second device records it
there too.

**The list clears itself.** Once an order reaches `COMPLETED` it is dropped from
the device — live from the tracker if the customer is watching, otherwise the
next time they open the list. A phone is not an order history, and nothing is
left to follow. The tracking page says so rather than letting the entry vanish
unexplained, and the link keeps working if it was bookmarked.

Two states are deliberately *not* auto-removed: **cancelled** orders (a customer
who finds an order simply missing is worse off than one who can see it was
cancelled) and orders that fail to load. Only a real `404` marks an order gone,
so a lost signal on the walk to the counter never deletes anything; the store's
own 20-entry cap bounds whatever remains.

**How it updates.** Server-Sent Events (`/api/orders/[id]/stream`). When staff
move an order along in the admin panel, the change is pushed to every open
tracker immediately; the customer sees the kitchen's action rather than
discovering it on the next refresh. `/api/orders/[id]/status` serves the same
data as a one-shot request, for the first paint and for the order list.

**What they see.** Stages adapted to the order type — a customer at table 7 is
never shown "out for delivery":

| | | | |
| --- | --- | --- | --- |
| **Dine-in** | Order received | Being prepared | On its way to your table → Served |
| **Pickup** | Order received | Being prepared | Ready for collection → Collected |
| **Delivery** | Order received | Being prepared | Out for delivery → Delivered |

Staff can put an order into a status its type has no stage for; the tracker then
says so plainly instead of highlighting a step at random.

### The admin list updates itself

`/admin/orders` stays current without anyone refreshing. A new order appears the
moment a customer places it, a status changed on another screen updates here,
and a deleted order disappears — so two people working the same service never
see contradictory screens.

The stream (`/api/admin/orders/stream`) carries **no order data whatsoever** —
literally `event: changed`. The page then re-renders on the server. That is what
keeps sorting, filtering and the row markup written once instead of duplicated
into a client bundle that could drift from them, and it means a connection held
open for a whole service cannot leak a customer's details. It still requires an
admin session: when orders arrive is itself information about the business.

Rows that arrived since the screen was last looking are highlighted for eight
seconds. The server cannot work out which those are — it has no idea what a
given screen was already showing — so the rendered ids are diffed on the client
and the highlight applied to those rows. Bursts are coalesced, so a rush at the
start of service costs one re-render rather than one per order.

**The chime** is synthesised with the Web Audio API — no audio file to ship or
decode. Browsers refuse to start audio until the user has interacted with the
page, so it is behind an explicit **Sound on/off** toggle: the click that turns
it on is the gesture that unlocks audio. The preference is remembered, but after
a reload the browser locks audio again, so the next click anywhere on the page
resumes it.

### What the customer is allowed to see

Tracking is unauthenticated, so both endpoints serve `PUBLIC_ORDER_SELECT`
(`src/lib/order-tracking.ts`) — an explicit list, so adding a column to `Order`
can never start publishing it. **No name, email, phone, delivery address, or
Stripe session id.**

`GET /api/orders/[id]` — which used to return the whole row to anyone holding an
id — now requires an admin session. Ids travel in URLs, history and referrers,
so unguessability was never access control.

### Notes on the stream

- **The listener registry lives on `globalThis`**, like the Prisma client, and
  for the same reason: route handlers are bundled separately and can each get
  their own instance of a module. With plain module scope the admin's PATCH
  published into one registry while the stream listened on another, and nothing
  was ever delivered.
- **The client closes the stream itself** once an order is served or cancelled.
  `EventSource` cannot tell a deliberate close from a dropped one, so leaving it
  to the server meant reconnecting forever to be told the same final status.
- **Per-process**, like the rate limiter and the AR lock. A second app instance
  would only notify its own listeners — hence the 60s re-read each stream does
  anyway, which bounds how stale a tracker can get.
- **Connections are capped** (200 concurrent); beyond that clients fall back to
  the one-shot endpoint.
- **nginx** already has `proxy_buffering off`; `proxy_read_timeout` is raised to
  1h and the stream sends a heartbeat every 25s.

## Request Limits

`/api/orders`, `/api/checkout/session`, and `/api/auth/login` are reachable
without logging in, so what they accept is bounded. Without these bounds a
single unauthenticated request with 50,000 line items was accepted, wrote
50,000 rows, and held the SQLite write lock for 22 seconds — blocking every
other request in the process.

| Limit | Value | Where |
| --- | --- | --- |
| Items per order | 50 | `src/lib/validators.ts` |
| Customer name | 100 chars | `src/lib/validators.ts` |
| Delivery address | 300 chars | `src/lib/validators.ts` |
| Notes | 1000 chars | `src/lib/validators.ts` |
| Quantity per item | 20 | `src/lib/validators.ts` |
| Request body | 64 KB (orders), 4 KB (login) | `src/lib/api-limits.ts` |
| Orders per IP | 10 per 15 min | `src/lib/api-limits.ts` |
| Login attempts per IP | 10 per 15 min | `src/lib/api-limits.ts` |

Over-limit requests get `400` with a message naming the field, or `413` if the
body itself is too big; rate-limited callers get `429` with `Retry-After`.
Both checkout routes share one per-IP budget, so alternating between cash and
card doesn't buy a second allowance.

The rate limiter keeps its counters **in memory, per process** — correct for
this deployment (one app container, see `docker-compose.yml`). Running more
than one instance would give each its own counters; that setup needs the limit
in nginx or a shared store instead.

Client IP comes from `X-Real-IP`, which nginx sets from `$remote_addr` and
which `proxy_set_header` overwrites, so a caller can't forge it. This assumes
the Node server is only reachable through nginx — which the Compose file
ensures by publishing ports on the nginx service alone.

### SQLite WAL

The database runs in **WAL mode**, set on first boot by `src/lib/prisma.ts`.
The SQLite default (`journal_mode = delete`) makes a writer take an exclusive
lock on the whole file, so every read blocks for the duration of every write.
WAL lets reads continue against the last committed snapshot while a write is in
flight, which is what keeps the storefront responsive while orders are coming
in.

It is a property of the database file, not the connection, so it persists once
set — which is why it leaves `dev.db-wal` and `dev.db-shm` next to the database
(both git-ignored). Back up all three together, or checkpoint first: a `.db`
copied on its own can be missing recent commits.

## Editing Business Info

Address, phone, hours, and social links are placeholders — edit them in
one place: `src/lib/constants.ts`.

## Useful Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build |
| `npm run db:seed` | Re-run the seed script (safe to re-run, upserts) |
| `npm run db:studio` | Open Prisma Studio to browse/edit the database |

## Deploying

This is built to run fully locally out of the box (SQLite file database,
local image uploads written to `public/images/dishes/`). Before deploying
to a serverless platform (e.g. Vercel), note:

- SQLite + local file writes don't persist on serverless — swap
  `DATABASE_URL` for a hosted Postgres database (e.g. Neon, Vercel
  Postgres) and update the Prisma driver adapter accordingly.
- Dish photo uploads would need a blob storage service (e.g. Vercel Blob,
  S3) instead of writing to `public/`.

Neither change requires touching the application logic — only the
database connection and the upload route.

### Docker

Two Compose files, for two different purposes:

- **`docker-compose.dev.yml`** — local smoke-test. Runs just the app
  container, published directly on `http://localhost:3000`, reading config
  from `.env`. No domain, no nginx, no certificates needed.

  ```
  docker compose -f docker-compose.dev.yml up -d --build
  docker compose -f docker-compose.dev.yml exec app npx tsx prisma/seed.ts
  ```

- **`docker-compose.yml`** — the real deployment stack (app + nginx +
  Let's Encrypt via certbot). Requires a public domain pointed at the
  server and a filled-in `.env.production` (copy it from
  `.env.production.example`). See `nginx/init-letsencrypt.sh` for first-time
  certificate issuance.

  ```
  cp .env.production.example .env.production   # then fill in real values
  docker compose up -d
  ```
