# Architecture & Business Readiness Audit — Bagh-e-Kabul (`afghan-cyrine`)

**Date:** 2026-08-18
**Branch/commit audited:** `main` @ `e140542` ("Fix: don't throw on missing DATABASE_URL at module load")
**Method:** static read of the source tree (`src/`, `prisma/`, `docker*`, `nginx/`, `.github/`) — no running instance, no production traffic, no `npm audit` (no registry egress). Every claim below cites the file/line it came from; anything I couldn't confirm from the code is flagged as an assumption.

---

## Executive Summary

Bagh-e-Kabul is a single-restaurant ordering platform: a public menu with delivery/pickup/QR-code dine-in ordering, optional Stripe card checkout, live order tracking, and an owner-facing admin panel. Its differentiator is an AI-generated AR pipeline (Meshy) that renders a dish at true physical size on the customer's own table — a genuine attack on the "how big is this dish, really" hesitation that keeps people from ordering unfamiliar cuisine. The economics are the pitch: every order is first-party, so the restaurant keeps the full ticket instead of the 15–30% a marketplace like DoorDash or Uber Eats would take. Against that alternative, the trade this product makes is explicit and consistent throughout the code — it brings no demand generation of its own, it only lets an already-visited restaurant stop renting its own customers back.

Technically, the codebase is unusually disciplined for its stage: prices are always re-derived server-side rather than trusted from the client (`src/lib/orders.ts:50-65`), the Stripe reconciliation path is genuinely idempotent and refuses to resurrect a cancelled or already-advanced order (`src/lib/order-payments.ts:45-58`), and the public order-tracking endpoint serves an explicit allow-list projection rather than a filtered full row (`src/lib/order-tracking.ts:18-36`). What the codebase does *not* have is any operational safety net: zero test files exist anywhere in `src/`, there is no error monitoring or alerting, and the only defense against data loss is a manually-run `pg_dump` documented in the README rather than automated anywhere. The headline finding of this audit is the same shape three different ways — an unauthenticated endpoint that can be looped to exhaust Stripe's API budget, an AR pipeline state machine that can wedge itself permanently on a non-2xx from Meshy, and a delete path that silently leaks storage forever — and all three share one root cause: nothing runs to catch them before a real customer or a Friday-night kitchen does.

---

## Business Snapshot

- **Objective & value proposition.** Replace three things a small independent restaurant otherwise pays for separately — a marketplace listing, a QR-menu tool, and an order-taking system — with one first-party stack the restaurant owns outright. A diner scans a table's QR code and orders from their own phone with no app install (`src/lib/table-qr.ts`, `src/app/(site)/menu/page.tsx`); the owner watches every order — delivery, pickup, or dine-in — arrive on one live-updating screen (`src/app/api/admin/orders/stream/route.ts`). The AR feature is not decorative: model size is derived per dish category (`src/lib/ar-scale.ts`), verified after download, and corrected if the AI reconstruction came out the wrong size (`src/lib/glb.ts`, `src/lib/ar-generation.ts:151-159`).

- **End users vs. paying customer.** They are different people, and the code visibly knows it. The **customer** — who decides to run this and pays for the AR generation subscription — is the restaurant owner, evidenced by the auth model: a single `Admin` table (`prisma/schema.prisma:188-193`), one admin account seeded from `.env` (`prisma/seed.ts`), and a JWT-cookie session (`src/lib/auth.ts:28-43`) guarding `/admin/*` via `src/proxy.ts:4-27`. The **end users** are diners — anonymous, on phones, often on the restaurant's own WiFi. The code tilts toward the diner where it costs the owner something: cash dine-in orders ask for no name, email, or phone at all, because the table itself is the identity (`src/lib/validators.ts:158-173`, enforced structurally by `Order.customerName` etc. being nullable in `prisma/schema.prisma:110-112`). Where the balance tilts back, it's operational rather than commercial: the admin panel gets an audible order alert and SSE push (`src/hooks/use-order-alert-sound.ts`, `src/components/admin/OrdersLiveFeed.tsx`), while the diner-facing menu is `force-dynamic` with no caching (`src/app/(site)/menu/page.tsx:9`).

- **Market positioning (hypothesis).** Commission-free direct ordering, competing against (a) Uber Eats/DoorDash-style marketplaces at 15–30% take rate, (b) POS-bundled ordering (Toast/Square/TouchBistro) tied to a POS contract, and (c) a template site plus a separate QR-menu SaaS. This is inferred from the feature set actually built — no marketplace discovery surface exists anywhere in the app, and every ordering path assumes the customer already knows to visit this specific site — not from any marketing copy, which doesn't exist in the repo.

- **Maturity level: late MVP, pre-launch, with a split personality between code and operations.** Concrete signals:

  | Signal | Present? | Evidence |
  |---|---|---|
  | Auth | Yes | `src/lib/auth.ts` — bcrypt + `jose`-signed HttpOnly cookie |
  | Payments | Yes | Stripe Checkout + idempotent webhook, `src/app/api/stripe/webhook/route.ts` |
  | Input validation | Yes, thorough | `src/lib/validators.ts` — bounded strings, bounded arrays, per-payment-method schemas |
  | Rate limiting | Yes, two-stage | `src/lib/api-limits.ts` |
  | Migrations | Yes | `prisma/migrations/20260803202919_init/` (one squashed migration) |
  | CI | Partial | `.github/workflows/ci.yml` — typecheck, lint, `next build`, docker build; **no test step exists to run** |
  | Containerized deploy + TLS automation | Yes | `docker-compose.yml`, `nginx/init-letsencrypt.sh`, certbot renewal loop |
  | **Automated tests** | **No** | zero files matching `*.test.*`/`*.spec.*` anywhere under `src/` (verified by search) |
  | **Error monitoring/alerting** | **No** | no `instrumentation.ts`, no Sentry/OTel dependency in `package.json`; failures go to `console.error` only (e.g. `src/app/api/stripe/webhook/route.ts:90`) |
  | **Automated backups** | **No** | `docker-compose.yml:1-22` — `postgres-data` is a bare named volume; no backup service defined anywhere in compose |
  | **Real business data** | **No** | `src/lib/constants.ts:7-23` is still explicitly-labeled placeholder ("San Francisco, CA 94103", `+1 (555) 010-0100`) |
  | **Default credentials in `.env`** | **Yes (risk)** | `.env:15` — `ADMIN_PASSWORD="ChangeMe123!"`; `.env:17,30` — `SESSION_SECRET` is defined **twice** with two different values |

  The infrastructure and domain logic read as early-production. The operational practice reads as prototype. That gap is the finding this audit keeps coming back to.

- **A real usage scenario, traced through the actual code.** A customer at table 7 scans the printed QR code, which encodes `?table=7` (`src/lib/table-qr.ts`); `TableSessionCapture` (`src/components/menu/TableSessionCapture.tsx`) reads it and pins the session to that table client-side. They browse `/menu` — a fully dynamic page (`export const dynamic = "force-dynamic"`, `src/app/(site)/menu/page.tsx:9`) that runs `category.findMany` and `dish.findMany({ include: { category: true } })` on every load (`menu/page.tsx:28-41`) and ships the whole dish list into the RSC payload to drive client-side search. They add items to a Zustand cart (`src/store/cart-store.ts`) and check out with cash. `POST /api/orders` (`src/app/api/orders/route.ts:14-69`) runs the request through the coarse per-IP flood gate, parses it with `cashOrderSchema`, calls `buildOrderFromCart` — which **re-fetches the live `Dish` rows and re-prices the order from them**, never trusting the client's numbers (`src/lib/orders.ts:50-65`) — verifies the table exists and is active (`orders.ts:39-48`), *then* charges the real per-table order budget (`checkOrderBudget`, keyed by table number specifically so one shared restaurant-WiFi IP can't starve every table, `src/lib/api-limits.ts:68-101`), creates the `Order` + `OrderItem` rows, and publishes an in-process event that wakes the admin's live SSE feed and rings its alert sound (`publishOrderChanged`, `src/lib/order-events.ts:89-93`). The customer is redirected to `/orders/[id]`, which opens its own SSE stream (`src/app/api/orders/[id]/stream/route.ts`) reading the same event bus. No payment step, no webhook, nothing leaves the process — the entire order lifecycle for the dominant use case (dine-in, cash) is one request and one in-memory pub/sub hop.

---

## Architecture Overview

**Architectural style, concretely:** a Next.js 16 App Router monolith. Route Handlers under `src/app/api/**` are the entire backend — there is no separate service tier, no message queue, no external cache. React Server Components under `src/app/(site)/**` and `src/app/admin/(protected)/**` query Prisma directly (e.g. `menu/page.tsx:28-41`); this is a deliberate choice documented as such rather than a layering slip — "anything that decides something goes in `src/lib/`, anything that only fetches and renders can stay in the page" is the rule actually followed. Prisma 7 talks to Postgres through the `@prisma/adapter-pg` driver adapter (`prisma/schema.prisma:4-11`) against a Postgres container defined in `docker-compose.yml`. State that would normally live in Redis in a scaled deployment instead lives on `globalThis` inside the single Node process: the rate limiter (`src/lib/rate-limit.ts:29-33`), the SSE pub/sub bus (`src/lib/order-events.ts:33-41`), and — inconsistently, see Critical Problem Areas — the AR-generation in-flight lock (`src/lib/ar-generation.ts:185`). This single-instance assumption is explicit and load-bearing: it means no horizontal scale and no zero-downtime deploy, which is a real ceiling but the right trade for exactly one restaurant.

**Core data flow #1 — Cash order (dine-in), the dominant path:**

```
Diner's phone
   │  GET /menu?table=7
   ▼
menu/page.tsx (RSC, force-dynamic)
   │  prisma.category.findMany() + prisma.dish.findMany({include:{category}})
   ▼
Zustand cart (client) ──add/remove items, no server round-trip──
   │  POST /api/orders  { fulfillmentType:"DINE_IN", tableNumber:7, items:[...] }
   ▼
api/orders/route.ts
   ├─ guardPublicRequest(): per-IP flood gate + body-size cap + JSON parse
   ├─ cashOrderSchema.safeParse(): bounded strings, item cap=50, table/fulfillment coherence
   ├─ buildOrderFromCart():
   │     ├─ prisma.table.findUnique({number:7}) → must exist & isActive
   │     ├─ prisma.dish.findMany({id:{in:[...]}}) → server re-prices from live rows
   │     └─ throws OrderBuildError on any invalid/unavailable dish
   ├─ checkOrderBudget(): per-TABLE limiter (10 / 15 min) — charged only after the table is proven real
   ├─ createOrder(): prisma.order.create() with generateOrderNumber() retry-on-collision
   └─ publishOrderChanged(orderId) → in-process pub/sub (order-events.ts)
                                         │
                     ┌───────────────────┴────────────────────┐
                     ▼                                         ▼
        Customer's /orders/[id] SSE stream         Admin's /admin/orders SSE stream
        (order-tracking.ts PUBLIC_ORDER_SELECT)     (full row, audible alert)
```

**Core data flow #2 — Card order + async payment confirmation, the flow with the most moving parts:**

```
Diner                         Next.js app                          Stripe
  │  POST /api/checkout/session
  ▼
cardOrderSchema (refuses DINE_IN) → buildOrderFromCart (re-prices)
  → createOrder(status:PENDING, paymentStatus:UNPAID)   [Order row committed, unpaid]
  → stripe.checkout.sessions.create()  ─────────────────────────────▶  hosted Checkout page
  → prisma.order.update({stripeSessionId})
  ← { url: session.url }  (order NOT published — no cooking starts on an unpaid order)
  │
  ▼ browser redirected to Stripe, customer pays
                                                                      │
                                              ┌───────────────────────┘
                                              ▼ (async, out-of-band)
                                   POST /api/stripe/webhook
                                   checkout.session.completed
                                   → markOrderPaid(orderId, sessionId, amountTotal)
                                     • verifies sessionId matches stored order
                                     • verifies amountTotal matches order.total
                                     • updateMany(paymentStatus≠PAID → PAID)   [idempotent]
                                     • updateMany(status=PENDING → CONFIRMED) [never regresses]
                                     • publishOrderChanged()
  │
  ▼ browser redirect (in parallel, may race the webhook)
GET /checkout/success?orderId&session_id
  → if order unpaid: ALSO calls stripe.checkout.sessions.retrieve(session_id)
    and markOrderPaid() again — a same-page fallback for a webhook that hasn't landed
```

The second flow has two independent paths to the same idempotent write (webhook, and the confirmation-page fallback), which is intentional and correctly reconciled — but the confirmation-page path is publicly reachable and unauthenticated regardless of whether reconciliation can do anything, which is the P1 finding below.

**Core data flow #3 — Admin AR generation, the only long-running async job in the system:**

```
Admin uploads/selects dish photo
  → POST /api/dishes/[id]/ar-generate → startArGeneration()
    → Meshy createModelingTask() → dish.arGenerationTaskId, phase=MODELING, status=PENDING
  (admin UI polls) → GET same route → advanceArGeneration()
    → advance(): getTask(MODELING, taskId)
      • SUCCEEDED → createSizingTask() → phase=SIZING
      • SIZING SUCCEEDED → download .glb, prepareGlbForAr(), saveUpload(), clear task fields
      • FAILED/CANCELED → fail(): clears task fields, status=FAILED
      • any OTHER thrown error (network, Meshy 5xx, expired task) → propagates,
        task fields NEVER cleared → dish permanently stuck IN_PROGRESS
```

---

## Critical Problem Areas

Ranked by business impact × technical risk, calibrated to a pre-revenue, soon-to-launch, single-restaurant product — not to what a funded, multi-tenant SaaS would need.

### 1. Zero automated tests protecting invariants that are only enforced in application code

**Where:** no file under `src/` matches `*.test.*` or `*.spec.*` (verified by search); `package.json` scripts (lines 5-16) define no `test` script; `.github/workflows/ci.yml` runs `tsc --noEmit`, `eslint`, `next build`, and a docker build — none of which execute a single business rule.

**Failure scenario:** the rules that keep the money and the kitchen correct live entirely in TypeScript logic the type checker cannot see — `cardOrderSchema` must reject `DINE_IN` (`src/lib/validators.ts:193-202`), `markOrderPaid` must never drag a `COMPLETED` order back to `CONFIRMED` (`src/lib/order-payments.ts:50-56`), `checkOrderBudget` must be called *after* table existence is confirmed, not before (`src/lib/api-limits.ts:83-88`, itself documented as a fix for a real incident). A five-line refactor that inverts an `if`, reorders two calls, or drops a `where` clause passes `tsc`, passes `eslint`, passes the build, and the first signal is a customer or the kitchen.

**Why it matters at this maturity level:** this is not "add tests" as a generic best practice — the codebase's own comments document three incidents already caused by exactly this class of bug (a 50,000-item order that held a write lock for 22 seconds, referenced in `src/lib/validators.ts:9-13`; the table-budget-before-existence-check bug in `api-limits.ts`). A late-MVP about to take real payment has no regression net for any of them.

### 2. Unauthenticated Stripe API amplification on the checkout confirmation page

**Where:** `src/app/(site)/checkout/success/page.tsx:33-45`. `GET /checkout/success?orderId=<known-id>&session_id=<anything>` is a public page, unauthenticated, and outside the `/api/*` rate limiter's scope (`src/lib/api-limits.ts` guards `guardPublicRequest`, which only the `/api/*` handlers call — this RSC page never does).

**Failure scenario:** every hit to this URL with a plausible `orderId`/`session_id` pair triggers one outbound call to `stripe.checkout.sessions.retrieve()` (line 35) before the code has checked whether that session id has anything to do with the stored order. A trivial script looping this URL drives the Stripe account toward its API rate limit; `POST /api/checkout/session` (the actual revenue-creating call) shares that same account-level budget, so real checkouts start failing during the flood. The downstream check inside `markOrderPaid` (session-id and amount matching, `order-payments.ts:35-40`) is sound and prevents a forged confirmation — the problem is purely that the *outbound Stripe call itself* isn't gated on that same check first.

**Why it matters here:** this is the one finding on this list that is remotely triggerable by a stranger and degrades the actual revenue path, not just a secondary feature. Cheap to exploit, cheap to fix — the order should be loaded first, and Stripe should only be called when `order.paymentMethod === "CARD" && order.paymentStatus !== "PAID" && order.stripeSessionId === sessionId`.

### 3. AR generation can wedge permanently with no UI recovery path

**Where:** `src/lib/ar-generation.ts:101-131` (`advance()`) and the route calling it (`src/app/api/dishes/[id]/ar-generate/route.ts`). `dish.arGenerationTaskId` is cleared in exactly two places: `fail()` (line 84-94), reached only when Meshy explicitly reports `FAILED`/`CANCELED`, and the success path (line 161-169). `getTask()` (line 117) is not wrapped in a try/catch inside `advance()`.

**Failure scenario:** any transient failure from Meshy — a timeout, a 5xx, an expired task id returning 404 — throws out of `getTask`, propagates out of `advance()`, and the route returns a 500 with the task id still set on the dish. From then on every subsequent `POST` short-circuits (the existing-task branch in the route), every `GET` throws again, and `src/components/admin/ARModelUploader.tsx` has no reset affordance (confirmed by search — no reset/clear button exists). The dish's AR generation is permanently stuck without a database edit.

**Why it matters at this maturity level:** not on the money path, so it's correctly P1 rather than P0 — but it degrades the product's one genuine differentiator, and "the owner has to ask someone to run a database UPDATE" is a support burden this product's target customer (a restaurant owner, not an engineer) cannot absorb.

### 4. Dish/category delete leaks R2 storage forever

**Where:** `src/app/api/dishes/[id]/route.ts:44-53` — `DELETE` calls `prisma.dish.delete({ where: { id } })` and returns, with no call to `deleteUpload()`. The same function exists and *is* correctly called on every replace path (`dishes/[id]/image/route.ts`, `ar-generation.ts:170`) — delete is the one path that forgets it.

**Failure scenario:** every deleted dish leaks its photo (up to several MB) and, if generated, its AR model (tens of MB after re-encoding — the nginx upload cap in `nginx/conf.d/default.conf` is sized to 35MB for exactly this asset). There is no sweep job reconciling R2 objects against live rows the way `scripts/fix-ar-models.ts` does for AR files specifically, so cost grows monotonically for the life of the product with no way to detect it short of an R2 bucket audit.

**Why it matters here:** silent and compounding rather than acute — correctly ranked below the three above — but trivial to fix (read the row's URLs before deleting, delete, then best-effort clean up) and gets more expensive to notice the longer it's live.

### 5. No error monitoring, alerting, or automated backups

**Where:** no `instrumentation.ts`, no Sentry/OTel dependency anywhere in `package.json`; failures surface only as `console.error` (e.g. `src/app/api/stripe/webhook/route.ts:90`, `src/lib/ar-generation.ts` has none for its own thrown errors) into a container's stdout nobody is reading. `docker-compose.yml` defines `postgres`, `app`, `nginx`, and `certbot` services (lines 1-95) — no backup service, no scheduled job, no volume snapshot policy anywhere in the file.

**Failure scenario, concretely:** the Stripe webhook handler is correctly written to return a 500 on transient failure so Stripe retries for up to three days (`stripe/webhook/route.ts:89-92`) — but if it's still failing after those three days, or if it's the confirmation-page fallback that's broken instead, nothing surfaces that anywhere except a log stream nobody watches. On the data side, `postgres-data` (`docker-compose.yml:13,91`) is a single named Docker volume with no snapshot, no `pg_dump` cron, no off-host copy — the entire menu, every order, and the only admin account live in one place with one failure mode (disk failure, bad `docker volume prune`, a `migrate deploy` gone wrong) between them and total loss.

**Why it matters at this maturity level:** the domain logic is written like software that expects to be trusted with real transactions; the operational posture around it is written like a prototype nobody depends on yet. That's the split-personality finding from the Business Snapshot made concrete — and both fixes here are additive, hours-scale work with essentially zero risk of regressing anything else.

### 6. Placeholder business data and duplicated/default secrets, as a launch gate rather than a code defect

**Where:** `src/lib/constants.ts:7-23` renders "123 Kabul Street, San Francisco, CA 94103" and a fake phone/social links directly onto the public site's footer and contact page. `.env:15` has `ADMIN_PASSWORD="ChangeMe123!"` — the exact value documented in the README as the default to change before going live. `.env:17` and `.env:30` define `SESSION_SECRET` **twice** with two different values in the same file, so which one actually signs the live admin session is not obvious from reading it.

**Failure scenario:** the seed script upserts the admin account straight from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`prisma/seed.ts`), so if `.env.production` is created by copying `.env` — the natural path the README's own setup flow invites — the live admin panel ships with a publicly documented password behind a login limited only to 10 attempts per 15 minutes per IP (`src/lib/api-limits.ts:28`), which a known password walks straight through. Separately worth flagging: the seed data is explicitly sourced from a Washington DC restaurant's public menu ("Sourced from Afghania's public dinner menu," `prisma/seed.ts:17`), while the placeholder address is San Francisco (`constants.ts:9`) — whichever city the real restaurant is actually in, at least one of these needs correcting before launch, and if it's outside the US at all, currency (`CURRENCY = "usd"`, `constants.ts:26`) and tax handling need a look too.

**Why it matters:** zero engineering effort, pure launch-checklist diligence — but it's the kind of thing that's invisible until a stranger notices the admin login uses the README's own documented password.

---

## Clean Architecture Target

The current shape is already close to right for a single-restaurant product — this is what it should converge on, not a redesign:

```
┌───────────────────────────────────────────────────────────┐
│ PRESENTATION                                               │
│ src/app/(site)/**   public pages (RSC, Prisma read-only)   │
│ src/app/admin/**    admin pages (RSC, guarded by proxy.ts) │
│ src/components/**, src/store/**                            │
└──────────────────────┬──────────────────────────────────────┘
┌──────────────────────▼──────────────────────────────────────┐
│ HTTP BOUNDARY — src/app/api/**                              │
│ parse → rate-limit → authenticate → delegate → serialize.   │
│ No business rules live here.                                │
└──────────────────────┬──────────────────────────────────────┘
┌──────────────────────▼──────────────────────────────────────┐
│ DOMAIN — src/lib/{orders,order-state,order-payments,        │
│ order-tracking,validators,table-qr,ar-scale,ar-generation}  │
│ Pure where possible; this is the layer that needs tests.    │
└──────────────────────┬──────────────────────────────────────┘
┌──────────────────────▼──────────────────────────────────────┐
│ DATA + INTEGRATIONS                                          │
│ prisma.ts → Postgres | r2.ts/uploads.ts → Cloudflare R2      │
│ stripe.ts → Stripe   | meshy.ts/glb.ts → Meshy AI            │
│ order-events.ts — in-process pub/sub (single-instance)       │
└───────────────────────────────────────────────────────────────┘
```

Two things worth stating as choices, not gaps:

- **RSC pages querying Prisma directly is correct here.** Introducing a repository/service layer purely to satisfy a diagram would add indirection with no consumer at this scale. The rule already being followed — decisions go in `src/lib/`, fetch-and-render stays in the page — is the right one to keep enforcing.
- **The single-process, `globalThis`-pinned state (rate limiter, SSE bus, AR lock) is a correct and explicitly-documented trade for one restaurant, one container.** It should not be "fixed" with Redis pre-emptively — that buys nothing today and adds an operational dependency. It becomes mandatory the day a second restaurant is onboarded, and every site that uses this pattern already documents that trigger in its own comments — which is worth preserving, not refactoring away.

The one structural inconsistency worth closing: `src/lib/ar-generation.ts:185` pins its in-flight lock to module scope instead of `globalThis`, breaking the exact pattern `rate-limit.ts` and `order-events.ts` document at length (module-scoped state gets duplicated across bundled route chunks). It works today only because one route imports it; bring it in line with its own codebase's convention before it silently breaks the same way those two already did once.

---

## Refactor Strategy

Strangler-fig, not a rewrite — nothing found here justifies one. Sequenced by risk-adjusted payoff; each phase is independently shippable and nothing in a later phase blocks on an earlier one being "done," only on it being safe to build on.

**Phase 0 — Launch gate (days).** Real business data in `constants.ts`; a single freshly-generated `SESSION_SECRET` (delete the duplicate line in `.env`) and a generated `ADMIN_PASSWORD` in `.env.production`; confirm the restaurant's actual city/currency against the seed data and `CURRENCY`. Zero code risk — pure configuration.

**Phase 1 — Make the invariants defensible (1–2 weeks, highest payoff-to-effort on this list).** Unit tests for the pure domain modules first — `order-state.ts`, `order-tracking.ts`, `table-qr.ts`, `validators.ts` need no database and no mocks, and they cover most of the rules currently enforced only by hand-read code. Then integration tests for `buildOrderFromCart` and `order-payments.ts` against the existing dev Postgres container. Wire `npm test` into `ci.yml` alongside the existing typecheck/lint/build so it actually gates merges. **Nothing else in this list should regress an untested code path — this phase is what makes every later phase safe.**

**Phase 2 — Close what's exploitable and what leaks (days, low risk, all local changes).** Gate the Stripe call on `/checkout/success` behind the same session-id/amount check `markOrderPaid` already does internally. Add `deleteUpload()` calls to the dish and category `DELETE` handlers. Add a staleness timeout plus a reset affordance to the AR generation state machine. Move `ar-generation.ts`'s in-flight lock onto `globalThis` to match the rest of the codebase. Each of these is covered by Phase 1's tests by the time it ships.

**Phase 3 — Operational safety net (parallel to Phase 1, similarly cheap).** Sentry (or equivalent) via `instrumentation.ts`; alert on any webhook 500, any health-check failure, any `markOrderPaid` returning `ok: false`. A daily `pg_dump` to R2 with retention, **and one verified restore into a scratch database** — an unrestored backup is not a backup.

**Phase 4 — Polish, only once the above ships.** Content-Security-Policy starting in report-only mode; tag-based caching on the menu queries (`unstable_cache`, revalidated from the dish/category mutation routes); delete the unused `GET /api/dishes`, `GET /api/dishes/[id]`, `GET /api/categories` handlers and add a `take` cap to `GET /api/orders`, which is currently an unbounded `findMany` with `include: { items: true }` (`src/app/api/orders/route.ts:82-86`) reachable by any authenticated admin session.

**Deliberately leave alone:** the per-process architecture (rate limiter, SSE bus) — correct for one restaurant and already documents its own scaling trigger. RSC-reads-Prisma-directly. The Docker/nginx/certbot deployment shape, which is already well beyond typical MVP quality (multi-stage build, non-root user, health-checked dependency ordering, an nginx reload loop specifically fixing the "renewed cert, still serving the expired one" failure mode).

---

## Production-Readiness Checklist

Tailored to *a single-restaurant, pre-revenue, owner-operated product about to take its first real orders* — not a generic enterprise checklist.

**Must do before accepting real payments:**
- [ ] Replace placeholder business data in `src/lib/constants.ts` (address, phone, social links) and confirm currency/locale against the real restaurant's location
- [ ] Generate a fresh `SESSION_SECRET` (remove the duplicate in `.env`) and a fresh `ADMIN_PASSWORD` for `.env.production`; never derive `.env.production` by copying `.env`
- [ ] Gate the Stripe API call in `checkout/success/page.tsx` on the order/session-id match happening *before* the outbound call, not after
- [ ] Add error monitoring (Sentry or equivalent) with alerts on: webhook 500s, health-check failures, `markOrderPaid` returning `ok:false`
- [ ] Automated daily `pg_dump` to R2 with retention, plus one verified restore into a scratch database

**Must do before the first menu/dish edit at scale (i.e., soon after launch):**
- [ ] Unit tests for `order-state.ts`, `order-tracking.ts`, `table-qr.ts`, `validators.ts`
- [ ] Integration tests for `buildOrderFromCart` and `order-payments.ts`
- [ ] `npm test` wired into `ci.yml`
- [ ] Fix R2 leak on dish/category delete
- [ ] AR generation staleness timeout + reset control

**Should do, not blocking:**
- [ ] Content-Security-Policy (report-only, then enforced)
- [ ] `npm audit` + Dependabot (unassessed in this audit — no registry egress available)
- [ ] Cap `GET /api/orders`; delete the three unused dead GET handlers
- [ ] Cache the menu queries with tag-based revalidation
- [ ] Tag Docker images by commit SHA instead of `:latest` so rollback doesn't require a rebuild

**Explicitly not needed yet, and would be premature:**
- Redis/shared state for the rate limiter or SSE bus — revisit only when a second restaurant is onboarded
- A service/repository layer between RSC pages and Prisma
- Multi-tenancy of any kind
- Horizontal scaling or zero-downtime deploy

**Legal/compliance, unresolved by the code and worth a deliberate decision rather than silence:** no privacy policy or data-retention policy exists for `customerName`/`customerEmail`/`customerPhone`/`deliveryAddress`, which the schema retains indefinitely (`prisma/schema.prisma:110-112`, no purge job anywhere). This is a jurisdiction-dependent must (GDPR, and in France specifically *mentions légales*) or a should (US, at this scale) — resolve which one applies before launch, not after.
